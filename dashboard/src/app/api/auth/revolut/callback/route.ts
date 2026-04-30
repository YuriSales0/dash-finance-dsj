import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getApiBase } from "@/lib/revolut/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const redirectTo = `${url.origin}/admin/integrations/revolut`;

  if (error) {
    return NextResponse.redirect(`${redirectTo}?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectTo}?error=missing_params`);
  }

  try {
    const sb = createServerClient();

    // Validar state
    const { data: stateRow, error: stateErr } = await sb
      .from("revolut_oauth_state")
      .select("bank_account_id, expires_at")
      .eq("state", state)
      .single();

    if (stateErr || !stateRow) {
      return NextResponse.redirect(`${redirectTo}?error=invalid_state`);
    }

    const sr = stateRow as any;
    if (new Date(sr.expires_at) < new Date()) {
      return NextResponse.redirect(`${redirectTo}?error=state_expired`);
    }

    const bank_account_id = sr.bank_account_id;

    // Buscar credenciais draft
    const { data: creds, error: credsErr } = await sb
      .from("revolut_credentials")
      .select("*")
      .eq("bank_account_id", bank_account_id)
      .single();

    if (credsErr || !creds) {
      return NextResponse.redirect(`${redirectTo}?error=credentials_not_found`);
    }

    const c = creds as any;

    // Trocar code por tokens
    let tokenData;
    try {
      tokenData = await exchangeCodeForTokens({
        client_id: c.client_id,
        issuer: c.issuer,
        private_key: c.private_key,
        code,
        sandbox: c.sandbox,
      });
    } catch (err: any) {
      const errMsg = `Falha ao trocar code: ${err.message}`;
      // Log detalhado pra diagnostico
      console.error("Revolut code exchange error:", {
        error: err.message,
        client_id_len: c.client_id?.length,
        issuer: c.issuer,
        private_key_first_30: c.private_key?.slice(0, 30),
        private_key_last_30: c.private_key?.slice(-30),
        sandbox: c.sandbox,
      });
      // Persistir o erro pra UI mostrar de forma persistente (nao so na URL)
      await sb
        .from("revolut_credentials")
        .update({
          last_sync_error: errMsg,
          last_sync_at: new Date().toISOString(),
        })
        .eq("bank_account_id", bank_account_id);
      return NextResponse.redirect(`${redirectTo}?error=${encodeURIComponent(errMsg)}`);
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Salvar tokens
    await sb
      .from("revolut_credentials")
      .update({
        access_token: tokenData.access_token,
        access_token_expires_at: expiresAt,
        refresh_token: tokenData.refresh_token,
        active: true,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("bank_account_id", bank_account_id);

    // Marcar conta como sync via API
    await sb
      .from("bank_accounts")
      .update({ manual_balance: false, api_provider: "revolut" })
      .eq("id", bank_account_id);

    // Limpar state
    await sb.from("revolut_oauth_state").delete().eq("state", state);

    // Tentar auto-selecionar sub-conta:
    //  - se so tem 1, seleciona ela
    //  - se tem N e uma bate com a moeda do bank_account, seleciona ela
    let autoPickedAccount: string | null = null;
    try {
      const accountsRes = await fetch(`${getApiBase(c.sandbox)}/accounts`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (accountsRes.ok) {
        const accs: Array<{ id: string; currency: string; state: string }> = await accountsRes.json();
        const active = accs.filter((a) => a.state === "active");
        const { data: bankAccount } = await sb
          .from("bank_accounts")
          .select("currency")
          .eq("id", bank_account_id)
          .single();
        const targetCurrency = (bankAccount as any)?.currency?.toUpperCase();

        if (active.length === 1) {
          autoPickedAccount = active[0].id;
        } else if (targetCurrency) {
          const matches = active.filter((a) => a.currency.toUpperCase() === targetCurrency);
          if (matches.length === 1) {
            autoPickedAccount = matches[0].id;
          }
        }

        if (autoPickedAccount) {
          await sb
            .from("revolut_credentials")
            .update({ revolut_account_id: autoPickedAccount, updated_at: new Date().toISOString() })
            .eq("bank_account_id", bank_account_id);
        }
      }
    } catch {
      // nao critico — usuario pode escolher manualmente
    }

    const successFlag = autoPickedAccount ? "connected_ready" : "connected";
    return NextResponse.redirect(`${redirectTo}?success=${successFlag}&account=${bank_account_id}`);
  } catch (e: any) {
    return NextResponse.redirect(`${redirectTo}?error=${encodeURIComponent(e.message)}`);
  }
}

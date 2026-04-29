import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/revolut/auth";

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
      return NextResponse.redirect(
        `${redirectTo}?error=${encodeURIComponent("Falha ao trocar code: " + err.message)}`
      );
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

    return NextResponse.redirect(`${redirectTo}?success=connected&account=${bank_account_id}`);
  } catch (e: any) {
    return NextResponse.redirect(`${redirectTo}?error=${encodeURIComponent(e.message)}`);
  }
}

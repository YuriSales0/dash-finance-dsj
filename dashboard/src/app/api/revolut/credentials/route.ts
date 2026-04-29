import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { refreshAccessToken, normalizePrivateKey } from "@/lib/revolut/auth";

// Salvar credenciais Revolut
// Modo "draft": cert + client_id (sem refresh_token) - para autorizar via OAuth
// Modo "complete": tudo, valida refresh_token via API
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      bank_account_id,
      client_id,
      issuer,
      private_key,
      refresh_token,
      sandbox = false,
    } = body;

    if (!bank_account_id || !client_id || !issuer || !private_key) {
      return NextResponse.json(
        { error: "client_id, issuer e private_key sao obrigatorios" },
        { status: 400 }
      );
    }

    const sb = createServerClient();

    // Normalizar a private_key ANTES de salvar para evitar problemas de formato no DB
    let normalizedKey: string;
    try {
      normalizedKey = normalizePrivateKey(private_key);
    } catch (err: any) {
      return NextResponse.json(
        { error: `Chave privada invalida: ${err.message}` },
        { status: 400 }
      );
    }

    console.log("Saving Revolut credentials:", {
      bank_account_id,
      client_id_len: client_id.length,
      input_key_len: private_key.length,
      input_key_first_30: private_key.slice(0, 30),
      normalized_key_len: normalizedKey.length,
      normalized_key_first_30: normalizedKey.slice(0, 30),
      issuer,
      sandbox,
    });

    // Se tem refresh_token, validar
    let access_token: string | null = null;
    let access_token_expires_at: string | null = null;

    if (refresh_token) {
      try {
        const tokenData = await refreshAccessToken({
          client_id,
          issuer,
          private_key: normalizedKey,
          refresh_token,
          sandbox,
        });
        access_token = tokenData.access_token;
        access_token_expires_at = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      } catch (err: any) {
        return NextResponse.json(
          { error: `Falha ao testar credenciais: ${err.message}` },
          { status: 400 }
        );
      }
    }

    const { error } = await sb.from("revolut_credentials").upsert(
      {
        bank_account_id,
        client_id,
        issuer,
        private_key: normalizedKey,
        refresh_token: refresh_token || null,
        access_token,
        access_token_expires_at,
        sandbox,
        active: !!refresh_token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bank_account_id" }
    );

    if (error) throw error;

    if (refresh_token) {
      await sb
        .from("bank_accounts")
        .update({ manual_balance: false, api_provider: "revolut" })
        .eq("id", bank_account_id);
    }

    return NextResponse.json({
      ok: true,
      status: refresh_token ? "active" : "draft",
      message: refresh_token
        ? "Credenciais validadas e ativadas"
        : "Credenciais salvas. Clique em Autorizar para ativar.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  const sb = createServerClient();
  const { data } = await sb
    .from("revolut_credentials")
    .select(
      "id, bank_account_id, client_id, issuer, sandbox, last_sync_at, last_sync_count, last_sync_error, active, access_token_expires_at, refresh_token"
    );
  const masked = (data || []).map((c: any) => ({
    ...c,
    has_refresh_token: !!c.refresh_token,
    refresh_token: undefined,
  }));
  return NextResponse.json(masked);
}

export async function DELETE(request: Request) {
  const { bank_account_id } = await request.json();
  const sb = createServerClient();
  await sb.from("revolut_credentials").delete().eq("bank_account_id", bank_account_id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { refreshAccessToken } from "@/lib/revolut/auth";

// Salvar credenciais Revolut + testar refresh token
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

    if (!bank_account_id || !client_id || !issuer || !private_key || !refresh_token) {
      return NextResponse.json({ error: "Todos os campos sao obrigatorios" }, { status: 400 });
    }

    // Testar credenciais
    let tokenData;
    try {
      tokenData = await refreshAccessToken({
        client_id,
        issuer,
        private_key,
        refresh_token,
        sandbox,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: `Falha ao testar credenciais: ${err.message}` },
        { status: 400 }
      );
    }

    const sb = createServerClient();
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Upsert
    const { error } = await sb.from("revolut_credentials").upsert(
      {
        bank_account_id,
        client_id,
        issuer,
        private_key,
        refresh_token: tokenData.refresh_token || refresh_token,
        access_token: tokenData.access_token,
        access_token_expires_at: expiresAt,
        sandbox,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bank_account_id" }
    );

    if (error) throw error;

    // Marcar conta como nao manual
    await sb.from("bank_accounts").update({ manual_balance: false, api_provider: "revolut" }).eq("id", bank_account_id);

    return NextResponse.json({ ok: true, message: "Credenciais salvas e validadas" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Listar credenciais (sem expor private key)
export async function GET() {
  const sb = createServerClient();
  const { data } = await sb
    .from("revolut_credentials")
    .select("id, bank_account_id, client_id, issuer, sandbox, last_sync_at, last_sync_count, last_sync_error, active, access_token_expires_at");
  return NextResponse.json(data || []);
}

// Desativar
export async function DELETE(request: Request) {
  const { bank_account_id } = await request.json();
  const sb = createServerClient();
  await sb.from("revolut_credentials").update({ active: false }).eq("bank_account_id", bank_account_id);
  return NextResponse.json({ ok: true });
}

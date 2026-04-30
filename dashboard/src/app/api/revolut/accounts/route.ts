import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/revolut/client";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/revolut/accounts?bank_account_id=...
// Lista as sub-contas Revolut disponiveis na OAuth ativa
// Usado para o usuario escolher qual sub-conta mapeia para o bank_account local
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bankAccountId = url.searchParams.get("bank_account_id");

    if (!bankAccountId) {
      return NextResponse.json({ error: "bank_account_id obrigatorio" }, { status: 400 });
    }

    const sb = createServerClient();
    const { data: creds } = await sb
      .from("revolut_credentials")
      .select("revolut_account_id, active")
      .eq("bank_account_id", bankAccountId)
      .single();

    if (!creds) {
      return NextResponse.json({ error: "Credenciais nao encontradas" }, { status: 404 });
    }

    const c = creds as any;
    if (!c.active) {
      return NextResponse.json({ error: "OAuth ainda nao foi autorizado" }, { status: 400 });
    }

    const accounts = await listAccounts(bankAccountId);

    return NextResponse.json({
      selected: c.revolut_account_id || null,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        balance: a.balance,
        state: a.state,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const maxDuration = 30;

// Recalcula balance_current de cada conta como soma das transacoes + saldo inicial
// Opcoes:
//   initial_balances: { account_id: number } - saldo antes do periodo importado
//   exclude_intercompany: bool - exclui transferencias intercompany (saldo "operacional")
export async function POST(request: Request) {
  try {
    if (isDemoMode) {
      return NextResponse.json({ ok: true, demo: true });
    }

    const body = await request.json().catch(() => ({}));
    const initial_balances: Record<string, number> = body.initial_balances || {};
    const exclude_intercompany: boolean = !!body.exclude_intercompany;

    const sb = createServerClient();

    const { data: accounts } = await sb
      .from("bank_accounts")
      .select("id, currency")
      .eq("active", true);

    const results: any[] = [];

    for (const acc of (accounts as any[]) || []) {
      let q = sb
        .from("transactions")
        .select("amount_original, is_intercompany")
        .eq("bank_account_id", acc.id);

      if (exclude_intercompany) {
        q = q.eq("is_intercompany", false);
      }

      const { data: txs } = await q;

      const list = (txs as any[]) || [];
      const sum = list.reduce((s, t) => s + Number(t.amount_original || 0), 0);
      const intercompanyCount = list.filter((t) => t.is_intercompany).length;

      const initial = initial_balances[acc.id] || 0;
      const newBalance = initial + sum;

      await sb
        .from("bank_accounts")
        .update({
          balance_current: newBalance,
          balance_available: newBalance,
        })
        .eq("id", acc.id);

      results.push({
        id: acc.id,
        currency: acc.currency,
        transactions_sum: sum,
        intercompany_count: intercompanyCount,
        initial_balance: initial,
        new_balance: newBalance,
        transactions_count: list.length,
      });
    }

    return NextResponse.json({ ok: true, exclude_intercompany, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

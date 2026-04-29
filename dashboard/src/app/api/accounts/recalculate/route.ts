import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const maxDuration = 30;

// Recalcula balance_current de cada conta como soma das transacoes + saldo inicial (opcional)
// initial_balance permite definir saldo antes do periodo importado
export async function POST(request: Request) {
  try {
    if (isDemoMode) {
      return NextResponse.json({ ok: true, demo: true });
    }

    const body = await request.json().catch(() => ({}));
    const { initial_balances }: { initial_balances?: Record<string, number> } = body;

    const sb = createServerClient();

    const { data: accounts } = await sb
      .from("bank_accounts")
      .select("id, currency")
      .eq("active", true);

    const results: any[] = [];

    for (const acc of (accounts as any[]) || []) {
      // Somar todas as transacoes da conta
      const { data: txs } = await sb
        .from("transactions")
        .select("amount_original")
        .eq("bank_account_id", acc.id);

      const sum = ((txs as any[]) || []).reduce(
        (s, t) => s + Number(t.amount_original || 0),
        0
      );

      const initial = initial_balances?.[acc.id] || 0;
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
        initial_balance: initial,
        new_balance: newBalance,
        transactions_count: txs?.length || 0,
      });
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

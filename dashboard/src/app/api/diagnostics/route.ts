import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({ demo: true });
  }

  const sb = createServerClient();

  // Contagem por conta
  const { data: accounts } = await sb
    .from("bank_accounts")
    .select("id, bank_name, currency, entity_id, last_synced_at")
    .eq("active", true);

  const accountStats = await Promise.all(
    ((accounts as any[]) || []).map(async (a) => {
      const { count } = await sb
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("bank_account_id", a.id);
      return {
        ...a,
        transaction_count: count,
      };
    })
  );

  // Contagem total
  const { count: totalCount } = await sb
    .from("transactions")
    .select("*", { count: "exact", head: true });

  const { count: needsReviewCount } = await sb
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("needs_review", true);

  // Ultimas 5 transacoes
  const { data: recent } = await sb
    .from("transactions")
    .select("id, external_id, bank_account_id, timestamp, description, counterparty, amount_original, currency_original, category_id, classified_by, needs_review, import_batch_id, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Imports recentes
  const { data: imports } = await sb
    .from("import_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  // P&L da consolidacao
  const { data: pnl } = await sb
    .from("monthly_pnl")
    .select("month, revenue, total_costs, net_profit")
    .eq("entity_id", "consolidated")
    .order("month", { ascending: false })
    .limit(6);

  // Recebiveis
  const { count: receivablesCount } = await sb
    .from("receivables")
    .select("*", { count: "exact", head: true });
  const { data: recentReceivables } = await sb
    .from("receivables")
    .select("id, entity_id, description, counterparty, amount_total, currency, status, due_date, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Dividas
  const { count: debtsCount } = await sb
    .from("debts")
    .select("*", { count: "exact", head: true });
  const { data: recentDebts } = await sb
    .from("debts")
    .select("id, entity_id, description, creditor, amount_total, currency, status, due_date, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    total_transactions: totalCount,
    needs_review: needsReviewCount,
    accounts: accountStats,
    recent_transactions: recent,
    recent_imports: imports,
    consolidated_pnl_recent: pnl,
    total_receivables: receivablesCount,
    recent_receivables: recentReceivables,
    total_debts: debtsCount,
    recent_debts: recentDebts,
  });
}

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({ demo: true });
  }

  const sb = createServerClient();

  // Contagem por conta + balance breakdown
  const { data: accounts } = await sb
    .from("bank_accounts")
    .select("id, bank_name, currency, entity_id, last_synced_at, balance_current, opening_balance")
    .eq("active", true);

  const accountStats = await Promise.all(
    ((accounts as any[]) || []).map(async (a) => {
      const { count, data: txs } = await sb
        .from("transactions")
        .select("amount_original", { count: "exact" })
        .eq("bank_account_id", a.id);

      const txList = (txs as any[]) || [];
      const inflowsSum = txList
        .filter((t) => Number(t.amount_original) > 0)
        .reduce((s, t) => s + Number(t.amount_original), 0);
      const outflowsSum = txList
        .filter((t) => Number(t.amount_original) < 0)
        .reduce((s, t) => s + Number(t.amount_original), 0);
      const netSum = inflowsSum + outflowsSum;
      const opening = Number(a.opening_balance) || 0;
      const computed = opening + netSum;

      return {
        ...a,
        transaction_count: count,
        opening_balance: opening,
        sum_inflows: Math.round(inflowsSum * 100) / 100,
        sum_outflows: Math.round(outflowsSum * 100) / 100,
        net: Math.round(netSum * 100) / 100,
        computed_balance: Math.round(computed * 100) / 100,
        stored_balance: Number(a.balance_current),
        match: Math.abs(computed - Number(a.balance_current)) < 0.01,
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

  // P&L por empresa
  const { data: entitiesList } = await sb.from("entities").select("id, name");
  const pnlByEntity: any[] = [];
  for (const e of (entitiesList as any[]) || []) {
    const { data: rows } = await sb
      .from("monthly_pnl")
      .select("month, revenue, total_costs, net_profit, cost_other")
      .eq("entity_id", e.id)
      .order("month", { ascending: false })
      .limit(3);
    pnlByEntity.push({
      entity_id: e.id,
      entity_name: e.name,
      months_with_data: ((rows as any[]) || []).filter((r) => r.revenue > 0 || r.total_costs > 0).length,
      total_rows: (rows as any[])?.length || 0,
      recent: rows,
    });
  }

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
    pnl_by_entity: pnlByEntity,
    total_receivables: receivablesCount,
    recent_receivables: recentReceivables,
    total_debts: debtsCount,
    recent_debts: recentDebts,
  });
}

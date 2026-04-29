import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (isDemoMode) {
    return NextResponse.json({ demo: true, accounts: [], categories: [], monthly: [] });
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const accountFilter = url.searchParams.get("account");

  // Default: do dia 1 do ano atual ate hoje
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const from = fromParam || defaultFrom;
  const to = toParam || now.toISOString().slice(0, 10);

  const sb = createServerClient();

  let query = sb
    .from("transactions")
    .select("id, bank_account_id, entity_id, timestamp, description, counterparty, amount_original, currency_original, amount_usd, category_id, is_intercompany")
    .gte("timestamp", `${from}T00:00:00`)
    .lte("timestamp", `${to}T23:59:59`);

  if (accountFilter) {
    query = query.eq("bank_account_id", accountFilter);
  }

  // Pegar todas (ate 5000)
  const { data: txs, error } = await query.limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transactions = (txs as any[]) || [];

  // Por conta: entrada / saida / net (em moeda original)
  const byAccount: Record<string, any> = {};
  for (const t of transactions) {
    const k = t.bank_account_id;
    if (!byAccount[k]) {
      byAccount[k] = {
        bank_account_id: k,
        entity_id: t.entity_id,
        currency: t.currency_original,
        entrada_count: 0,
        saida_count: 0,
        intercompany_count: 0,
        entrada_total: 0,
        saida_total: 0,
        intercompany_total: 0,
        entrada_total_usd: 0,
        saida_total_usd: 0,
        net: 0,
        net_usd: 0,
        count: 0,
      };
    }
    const a = byAccount[k];
    a.count++;
    if (t.is_intercompany) {
      a.intercompany_count++;
      a.intercompany_total += Number(t.amount_original);
    } else if (Number(t.amount_original) > 0) {
      a.entrada_count++;
      a.entrada_total += Number(t.amount_original);
      a.entrada_total_usd += Number(t.amount_usd);
    } else {
      a.saida_count++;
      a.saida_total += Number(t.amount_original);
      a.saida_total_usd += Number(t.amount_usd);
    }
    a.net += Number(t.amount_original);
    a.net_usd += Number(t.amount_usd);
  }

  // Por categoria (em USD)
  const byCategory: Record<string, any> = {};
  for (const t of transactions) {
    const k = t.category_id || "uncategorized";
    if (!byCategory[k]) {
      byCategory[k] = {
        category_id: k,
        count: 0,
        total_usd: 0,
        total_abs_usd: 0,
        entrada_usd: 0,
        saida_usd: 0,
      };
    }
    const c = byCategory[k];
    c.count++;
    c.total_usd += Number(t.amount_usd);
    c.total_abs_usd += Math.abs(Number(t.amount_usd));
    if (Number(t.amount_usd) > 0) c.entrada_usd += Number(t.amount_usd);
    else c.saida_usd += Number(t.amount_usd);
  }

  // Por mes (USD consolidado)
  const byMonth: Record<string, any> = {};
  for (const t of transactions) {
    if (t.is_intercompany) continue;
    const d = new Date(t.timestamp);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[k]) {
      byMonth[k] = { month: k, entrada_usd: 0, saida_usd: 0, net_usd: 0, count: 0 };
    }
    const m = byMonth[k];
    m.count++;
    m.net_usd += Number(t.amount_usd);
    if (Number(t.amount_usd) > 0) m.entrada_usd += Number(t.amount_usd);
    else m.saida_usd += Number(t.amount_usd);
  }

  // Top 10 maiores transacoes em valor absoluto
  const topTransactions = transactions
    .map((t) => ({
      ...t,
      abs_usd: Math.abs(Number(t.amount_usd)),
    }))
    .sort((a, b) => b.abs_usd - a.abs_usd)
    .slice(0, 20);

  return NextResponse.json({
    period: { from, to },
    total_transactions: transactions.length,
    accounts: Object.values(byAccount),
    categories: Object.values(byCategory).sort((a: any, b: any) => b.total_abs_usd - a.total_abs_usd),
    monthly: Object.values(byMonth).sort((a: any, b: any) => a.month.localeCompare(b.month)),
    top_transactions: topTransactions,
  });
}

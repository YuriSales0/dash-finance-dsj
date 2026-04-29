import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Auditoria: compara delta de saldo (sum transactions) vs P&L
// Para cada empresa: as duas devem bater (delta = revenue - costs, excluindo intercompany)
export async function GET() {
  if (isDemoMode) return NextResponse.json({ demo: true });

  const sb = createServerClient();

  // Buscar todas transacoes
  const { data: txs } = await sb
    .from("transactions")
    .select("entity_id, bank_account_id, amount_usd, category_id, is_intercompany");

  const transactions = (txs as any[]) || [];

  // Buscar P&L de todos os meses
  const { data: pnls } = await sb
    .from("monthly_pnl")
    .select("entity_id, revenue, total_costs, net_profit")
    .neq("entity_id", "consolidated");

  const pnlByEntity: Record<string, { revenue: number; costs: number; net: number }> = {};
  for (const p of (pnls as any[]) || []) {
    if (!pnlByEntity[p.entity_id]) {
      pnlByEntity[p.entity_id] = { revenue: 0, costs: 0, net: 0 };
    }
    pnlByEntity[p.entity_id].revenue += Number(p.revenue);
    pnlByEntity[p.entity_id].costs += Number(p.total_costs);
    pnlByEntity[p.entity_id].net += Number(p.net_profit);
  }

  // Calcular delta esperado por empresa (transactions, em USD)
  const stats: Record<string, any> = {};
  for (const t of transactions) {
    if (!stats[t.entity_id]) {
      stats[t.entity_id] = {
        entity_id: t.entity_id,
        total_transactions: 0,
        sum_all_usd: 0,
        sum_uncategorized_usd: 0,
        sum_intercompany_usd: 0,
        sum_revenue_usd: 0,
        sum_costs_usd: 0,
        sum_transfers_usd: 0,
        count_uncategorized: 0,
        count_intercompany: 0,
        count_revenue: 0,
        count_costs: 0,
      };
    }
    const s = stats[t.entity_id];
    s.total_transactions++;
    s.sum_all_usd += Number(t.amount_usd);

    if (t.is_intercompany) {
      s.sum_intercompany_usd += Number(t.amount_usd);
      s.count_intercompany++;
    } else if (!t.category_id) {
      s.sum_uncategorized_usd += Number(t.amount_usd);
      s.count_uncategorized++;
    } else if (t.category_id?.startsWith("revenue")) {
      s.sum_revenue_usd += Number(t.amount_usd);
      s.count_revenue++;
    } else if (t.category_id?.startsWith("cost")) {
      s.sum_costs_usd += Number(t.amount_usd);
      s.count_costs++;
    } else if (t.category_id?.startsWith("transfer")) {
      s.sum_transfers_usd += Number(t.amount_usd);
    }
  }

  // Comparar com P&L: delta esperado (sem intercompany) vs P&L net
  const audit = Object.values(stats).map((s: any) => {
    const pnl = pnlByEntity[s.entity_id] || { revenue: 0, costs: 0, net: 0 };

    // Delta SEM intercompany (deveria igualar P&L net + transfers internos + uncategorized)
    const delta_excluding_intercompany =
      s.sum_revenue_usd + s.sum_costs_usd + s.sum_uncategorized_usd + s.sum_transfers_usd;

    // O P&L deveria refletir apenas categorizadas (revenue + costs)
    // Diferenca eh culpa de: uncategorized + transfers (interbank/fx)
    const expected_pnl = s.sum_revenue_usd + s.sum_costs_usd;
    const pnl_diff = pnl.net - expected_pnl;

    return {
      ...s,
      pnl_revenue: pnl.revenue,
      pnl_costs: pnl.costs,
      pnl_net: pnl.net,
      delta_excluding_intercompany,
      expected_pnl,
      pnl_diff,
      // Insights
      missing_classification_impact: s.sum_uncategorized_usd,
      issues: buildIssues(s, pnl),
    };
  });

  return NextResponse.json({
    audit,
    summary: {
      total_transactions: transactions.length,
      total_uncategorized: transactions.filter((t) => !t.category_id && !t.is_intercompany).length,
      total_intercompany: transactions.filter((t) => t.is_intercompany).length,
      sum_all: transactions.reduce((s, t) => s + Number(t.amount_usd), 0),
      sum_uncategorized: transactions
        .filter((t) => !t.category_id && !t.is_intercompany)
        .reduce((s, t) => s + Number(t.amount_usd), 0),
    },
  });
}

function buildIssues(stats: any, pnl: any): string[] {
  const issues: string[] = [];

  if (stats.count_uncategorized > 0) {
    issues.push(
      `${stats.count_uncategorized} transacoes SEM CATEGORIA (impacto: ${stats.sum_uncategorized_usd.toFixed(2)} USD) — afetam saldo mas NAO o P&L`
    );
  }

  if (stats.count_intercompany > 0 && stats.sum_intercompany_usd !== 0) {
    issues.push(
      `Intercompany nao zerado: ${stats.sum_intercompany_usd.toFixed(2)} USD (deveria ser zero ou proximo)`
    );
  }

  if (Math.abs(stats.sum_transfers_usd) > 100) {
    issues.push(
      `Transferencias internas: ${stats.sum_transfers_usd.toFixed(2)} USD (interbank/FX) — afetam saldo mas nao P&L`
    );
  }

  return issues;
}

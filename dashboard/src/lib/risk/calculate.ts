import { repository } from "@/lib/data/repository";
import type { RiskMetric, RiskLevel } from "@/types/database";
import { convertToUsd } from "@/lib/fx/rates";
import { getAnthropicKey } from "@/lib/anthropic/key";

// ============================================================
// Calculadora do Indice de Risco
// Combina: caixa, recebiveis, dividas, ad spend, runway
// Retorna score 0-100 (0 seguro, 100 critico) + breakdown
// ============================================================

async function toUsd(amount: number, currency: string): Promise<number> {
  if (currency === "USD") return amount;
  const result = await convertToUsd(amount, currency);
  return result.amount_usd;
}

export interface RiskCalculation {
  cash_balance_usd: number;
  receivables_pending: number;
  receivables_overdue: number;
  debts_pending: number;
  debts_overdue: number;
  daily_ad_spend: number;
  monthly_revenue: number;
  monthly_costs: number;
  avg_days_to_receive: number;
  avg_days_to_pay: number;
  burn_rate: number;
  runway_days: number;
  cash_after_obligations: number;
  risk_score: number;
  risk_level: RiskLevel;
  factors: Record<string, number>;
  scenarios: Record<string, { cash_impact: number; runway_impact_days: number; risk_level?: RiskLevel }>;
}

export async function computeRisk(): Promise<RiskCalculation> {
  const [accounts, receivables, debts, pnl12m] = await Promise.all([
    repository.getBankAccounts(),
    repository.getReceivables(),
    repository.getDebts(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 6 }),
  ]);

  // Caixa em USD
  let cash_balance_usd = 0;
  for (const a of accounts) {
    cash_balance_usd += await toUsd(a.balance_current, a.currency);
  }

  const today = new Date();

  // Recebiveis
  let receivables_pending = 0;
  let receivables_overdue = 0;
  for (const r of receivables) {
    if (r.status === "paid") continue;
    const usd = await toUsd(r.amount_total - r.amount_received, r.currency);
    receivables_pending += usd;
    if (new Date(r.due_date) < today) receivables_overdue += usd;
  }

  // Dividas
  let debts_pending = 0;
  let debts_overdue = 0;
  for (const d of debts) {
    if (d.status === "paid") continue;
    const usd = await toUsd(d.amount_total - d.amount_paid, d.currency);
    debts_pending += usd;
    if (new Date(d.due_date) < today) debts_overdue += usd;
  }

  // Operacao (medias 3 meses)
  const last3 = pnl12m.slice(-3);
  const monthly_revenue = last3.length
    ? last3.reduce((s, p) => s + p.revenue, 0) / last3.length
    : 0;
  const monthly_costs = last3.length
    ? last3.reduce((s, p) => s + p.total_costs, 0) / last3.length
    : 0;
  const burn_rate = monthly_costs;

  // Ad spend diario (estimativa: cost_ads do ultimo mes / 30)
  const lastMonth = pnl12m[pnl12m.length - 1];
  const daily_ad_spend = lastMonth ? lastMonth.cost_ads / 30 : 0;

  // Tempos medios (heuristica baseada nos dados)
  const pendingRecvs = receivables.filter((r) => r.status !== "paid");
  const avg_days_to_receive =
    pendingRecvs.length > 0
      ? pendingRecvs.reduce((s, r) => {
          const days = (new Date(r.due_date).getTime() - new Date(r.issue_date).getTime()) / 86400000;
          return s + days;
        }, 0) / pendingRecvs.length
      : 0;

  const pendingDebts = debts.filter((d) => d.status !== "paid");
  const avg_days_to_pay =
    pendingDebts.length > 0
      ? pendingDebts.reduce((s, d) => {
          const days = (new Date(d.due_date).getTime() - new Date(d.issue_date).getTime()) / 86400000;
          return s + days;
        }, 0) / pendingDebts.length
      : 0;

  const runway_days = burn_rate > 0 ? (cash_balance_usd / burn_rate) * 30 : 999;
  const cash_after_obligations = cash_balance_usd + receivables_pending - debts_pending;

  // Fatores de risco (cada um 0-1, peso ajustavel)
  const f_burn_to_cash = Math.min(burn_rate / Math.max(cash_balance_usd, 1), 2) / 2; // 0-1
  const f_runway = runway_days < 30 ? 1 : runway_days < 60 ? 0.6 : runway_days < 120 ? 0.3 : 0.1;
  const f_overdue_recv = receivables_pending > 0 ? receivables_overdue / receivables_pending : 0;
  const f_overdue_debts = debts_pending > 0 ? debts_overdue / debts_pending : 0;
  const f_ad_pct_revenue = monthly_revenue > 0
    ? Math.min((daily_ad_spend * 30) / monthly_revenue, 1)
    : 0;
  const f_recv_concentration = await (async () => {
    if (receivables_pending === 0) return 0;
    let top = 0;
    for (const r of pendingRecvs) {
      const usd = await toUsd(r.amount_total - r.amount_received, r.currency);
      if (usd > top) top = usd;
    }
    return top / receivables_pending;
  })();

  // Score ponderado
  const weights = {
    burn_to_cash: 0.25,
    runway: 0.25,
    overdue_recv: 0.10,
    overdue_debts: 0.15,
    ad_pct: 0.10,
    recv_concentration: 0.15,
  };
  const score =
    (f_burn_to_cash * weights.burn_to_cash +
      f_runway * weights.runway +
      f_overdue_recv * weights.overdue_recv +
      f_overdue_debts * weights.overdue_debts +
      f_ad_pct_revenue * weights.ad_pct +
      f_recv_concentration * weights.recv_concentration) *
    100;

  const risk_level: RiskLevel =
    score < 25 ? "low" : score < 50 ? "medium" : score < 75 ? "high" : "critical";

  // Cenarios "what-if"
  const scenarios = {
    stripe_freeze_7d: (() => {
      const impact = -daily_ad_spend * 7 - (monthly_revenue / 30) * 7 * 0.5;
      return {
        cash_impact: Math.round(impact),
        runway_impact_days: Math.round((impact / burn_rate) * 30),
      };
    })(),
    stripe_freeze_30d: (() => {
      const impact = -daily_ad_spend * 30 - monthly_revenue * 0.5;
      const newRunway = burn_rate > 0 ? ((cash_balance_usd + impact) / burn_rate) * 30 : 0;
      return {
        cash_impact: Math.round(impact),
        runway_impact_days: Math.round((impact / burn_rate) * 30),
        risk_level: (newRunway < 30 ? "critical" : "high") as RiskLevel,
      };
    })(),
    revenue_drop_50pct: (() => {
      const impact = -monthly_revenue * 0.5;
      return {
        cash_impact: Math.round(impact),
        runway_impact_days: Math.round((impact / burn_rate) * 30),
      };
    })(),
    receivables_default_top: await (async () => {
      let top = 0;
      for (const r of pendingRecvs) {
        const usd = await toUsd(r.amount_total - r.amount_received, r.currency);
        if (usd > top) top = usd;
      }
      return {
        cash_impact: -Math.round(top),
        runway_impact_days: Math.round((-top / burn_rate) * 30),
      };
    })(),
  };

  return {
    cash_balance_usd: Math.round(cash_balance_usd),
    receivables_pending: Math.round(receivables_pending),
    receivables_overdue: Math.round(receivables_overdue),
    debts_pending: Math.round(debts_pending),
    debts_overdue: Math.round(debts_overdue),
    daily_ad_spend: Math.round(daily_ad_spend),
    monthly_revenue: Math.round(monthly_revenue),
    monthly_costs: Math.round(monthly_costs),
    avg_days_to_receive: Math.round(avg_days_to_receive * 10) / 10,
    avg_days_to_pay: Math.round(avg_days_to_pay * 10) / 10,
    burn_rate: Math.round(burn_rate),
    runway_days: Math.round(runway_days * 10) / 10,
    cash_after_obligations: Math.round(cash_after_obligations),
    risk_score: Math.round(score * 10) / 10,
    risk_level,
    factors: {
      burn_to_cash_ratio: Math.round(f_burn_to_cash * 100) / 100,
      runway_factor: Math.round(f_runway * 100) / 100,
      overdue_receivables_pct: Math.round(f_overdue_recv * 100) / 100,
      overdue_debts_pct: Math.round(f_overdue_debts * 100) / 100,
      ad_spend_pct_revenue: Math.round(f_ad_pct_revenue * 100) / 100,
      receivables_concentration: Math.round(f_recv_concentration * 100) / 100,
    },
    scenarios,
  };
}

export async function generateAIAnalysis(calc: RiskCalculation): Promise<{
  analysis: string;
  recommendations: string;
}> {
  const apiKey = await getAnthropicKey();

  if (!apiKey) {
    // Fallback sem AI: gerar analise heuristica
    return generateHeuristicAnalysis(calc);
  }

  const prompt = `Voce e um analista financeiro de uma empresa de e-commerce. Analise os dados abaixo e gere:
1. Uma analise concisa do estado financeiro (max 3 frases).
2. 3 recomendacoes acionaveis numeradas.

Dados:
- Caixa: USD ${calc.cash_balance_usd.toLocaleString()}
- Recebiveis a receber: USD ${calc.receivables_pending.toLocaleString()} (${calc.receivables_overdue.toLocaleString()} atrasados)
- Dividas a pagar: USD ${calc.debts_pending.toLocaleString()} (${calc.debts_overdue.toLocaleString()} atrasadas)
- Receita media (3m): USD ${calc.monthly_revenue.toLocaleString()}/mes
- Burn rate: USD ${calc.burn_rate.toLocaleString()}/mes
- Runway: ${calc.runway_days} dias
- Gasto diario em ads: USD ${calc.daily_ad_spend.toLocaleString()}
- Tempo medio recebimento: ${calc.avg_days_to_receive} dias
- Score de risco: ${calc.risk_score}/100 (${calc.risk_level})

Cenarios criticos:
- Travamento Stripe 30d: USD ${calc.scenarios.stripe_freeze_30d.cash_impact.toLocaleString()} (${calc.scenarios.stripe_freeze_30d.runway_impact_days}d runway)
- Queda receita 50%: USD ${calc.scenarios.revenue_drop_50pct.cash_impact.toLocaleString()}

Responda em portugues, formato JSON: {"analysis": "...", "recommendations": "1. ...\\n2. ...\\n3. ..."}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const text = data.content[0].text as string;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON nao encontrado");
    const parsed = JSON.parse(match[0]);
    return {
      analysis: parsed.analysis || "",
      recommendations: parsed.recommendations || "",
    };
  } catch (err) {
    console.error("Risk AI failed:", err);
    return generateHeuristicAnalysis(calc);
  }
}

function generateHeuristicAnalysis(calc: RiskCalculation) {
  const parts: string[] = [];
  const recs: string[] = [];

  if (calc.runway_days < 60) {
    parts.push(`Runway critico de ${calc.runway_days} dias.`);
    recs.push("Reduzir burn rate ou acelerar recebimento de payouts.");
  } else if (calc.runway_days < 120) {
    parts.push(`Runway moderado de ${calc.runway_days} dias - acompanhar mensalmente.`);
  } else {
    parts.push(`Runway saudavel de ${calc.runway_days} dias.`);
  }

  if (calc.factors.receivables_concentration > 0.5) {
    parts.push("Alta concentracao em um unico recebivel.");
    recs.push("Diversificar processadores: nao concentrar mais de 50% em um.");
  }

  if (calc.factors.overdue_debts_pct > 0.1) {
    parts.push("Dividas em atraso podem gerar juros adicionais.");
    recs.push("Renegociar prazos de dividas em atraso.");
  }

  if (calc.factors.ad_spend_pct_revenue > 0.6) {
    recs.push("Reduzir dependencia de ads pagos: investir em CRM e LTV.");
  } else {
    recs.push("Manter mix saudavel de canais de aquisicao.");
  }

  if (recs.length < 3) {
    recs.push("Manter reserva de 30 dias de burn rate em conta liquida.");
  }

  return {
    analysis: parts.join(" "),
    recommendations: recs.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join("\n"),
  };
}

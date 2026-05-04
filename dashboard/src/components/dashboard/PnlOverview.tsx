"use client";

import { useState, useMemo } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { MonthlyPnl, MonthlyCashflow } from "@/types/database";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// new Date("2026-01-01") em UTC-3 vira 31/dez/2025 23:00 local → getMonth()=11.
// Parsear YYYY-MM-DD como local date evita o shift de timezone.
function parseLocalDate(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1 }; // month 0-indexed
}

interface PnlOverviewProps {
  pnl: MonthlyPnl[];
  cashflow?: MonthlyCashflow[];
}

export function PnlOverview({ pnl, cashflow = [] }: PnlOverviewProps) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const p of pnl) set.add(parseLocalDate(p.month).year);
    for (const c of cashflow) set.add(parseLocalDate(c.month).year);
    return Array.from(set).sort((a, b) => b - a);
  }, [pnl, cashflow]);

  const [selectedYear, setSelectedYear] = useState(() => years[0] || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return pnl.filter((p) => {
      const { year, month } = parseLocalDate(p.month);
      if (year !== selectedYear) return false;
      if (selectedMonth !== null && month !== selectedMonth) return false;
      return true;
    });
  }, [pnl, selectedYear, selectedMonth]);

  const filteredCashflow = useMemo(() => {
    return cashflow.filter((c) => {
      const { year, month } = parseLocalDate(c.month);
      if (year !== selectedYear) return false;
      if (selectedMonth !== null && month !== selectedMonth) return false;
      return true;
    });
  }, [cashflow, selectedYear, selectedMonth]);

  const cashTotals = useMemo(() => {
    return {
      cash_delta: filteredCashflow.reduce((s, c) => s + c.cash_delta, 0),
      revenue_flow: filteredCashflow.reduce((s, c) => s + c.revenue_flow, 0),
      cost_flow: filteredCashflow.reduce((s, c) => s + c.cost_flow, 0),
      intercompany_flow: filteredCashflow.reduce((s, c) => s + c.intercompany_flow, 0),
      transfer_flow: filteredCashflow.reduce((s, c) => s + c.transfer_flow, 0),
      uncategorized_flow: filteredCashflow.reduce((s, c) => s + c.uncategorized_flow, 0),
      investment_flow: filteredCashflow.reduce((s, c) => s + c.investment_flow, 0),
    };
  }, [filteredCashflow]);

  const totals = useMemo(() => {
    const revenue = filtered.reduce((s, p) => s + p.revenue, 0);
    const costs = filtered.reduce((s, p) => s + p.total_costs, 0);
    const profit = revenue - costs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    const costBreakdown = {
      ads: filtered.reduce((s, p) => s + p.cost_ads, 0),
      products: filtered.reduce((s, p) => s + p.cost_products, 0),
      shipping: filtered.reduce((s, p) => s + p.cost_shipping, 0),
      gateway: filtered.reduce((s, p) => s + p.cost_gateway, 0),
      chargebacks: filtered.reduce((s, p) => s + p.cost_chargebacks, 0),
      refunds: filtered.reduce((s, p) => s + p.cost_refunds, 0),
      team: filtered.reduce((s, p) => s + p.cost_team, 0),
      saas: filtered.reduce((s, p) => s + p.cost_saas, 0),
      infra: filtered.reduce((s, p) => s + p.cost_infra, 0),
      legal: filtered.reduce((s, p) => s + p.cost_legal, 0),
      other: filtered.reduce((s, p) => s + p.cost_other, 0),
    };

    return { revenue, costs, profit, margin, costBreakdown };
  }, [filtered]);

  const periodLabel = selectedMonth !== null
    ? `${MONTH_NAMES[selectedMonth]} ${selectedYear}`
    : `${selectedYear}`;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Ano:</label>
          <div className="flex gap-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 text-xs rounded-full transition ${
                  selectedYear === y
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Mes:</label>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setSelectedMonth(null)}
              className={`px-3 py-1 text-xs rounded-full transition ${
                selectedMonth === null
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos
            </button>
            {MONTH_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => setSelectedMonth(i)}
                className={`px-2 py-1 text-xs rounded-full transition ${
                  selectedMonth === i
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Receita */}
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Receita</p>
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp size={18} className="text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(totals.revenue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{periodLabel}</p>
        </div>

        {/* Despesas */}
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Despesas</p>
            <div className="p-2 bg-red-50 rounded-lg">
              <TrendingDown size={18} className="text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(totals.costs)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{periodLabel}</p>
        </div>

        {/* Lucro/Prejuízo */}
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Lucro / Prejuizo</p>
            <div className={`p-2 rounded-lg ${totals.profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              {totals.profit >= 0 ? (
                <ArrowUpRight size={18} className="text-green-600" />
              ) : (
                <ArrowDownRight size={18} className="text-red-600" />
              )}
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(totals.profit)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-400">Margem: {formatPercent(totals.margin)}</p>
          </div>
        </div>
      </div>

      {/* Reconciliacao P&L vs Caixa */}
      {filteredCashflow.length > 0 && (
        <ReconciliationCard
          pnlNet={totals.profit}
          cashflow={cashTotals}
          periodLabel={periodLabel}
        />
      )}

      {/* Breakdown de custos */}
      {totals.costs > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">Composicao de Despesas — {periodLabel}</h3>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {[
                { label: "Produtos", value: totals.costBreakdown.products },
                { label: "Ads (Meta + TikTok + Google)", value: totals.costBreakdown.ads },
                { label: "Frete", value: totals.costBreakdown.shipping },
                { label: "Gateway/Processador", value: totals.costBreakdown.gateway },
                { label: "Reembolsos", value: totals.costBreakdown.refunds },
                { label: "Chargebacks", value: totals.costBreakdown.chargebacks },
                { label: "Team", value: totals.costBreakdown.team },
                { label: "SaaS", value: totals.costBreakdown.saas },
                { label: "Infraestrutura", value: totals.costBreakdown.infra },
                { label: "Legal", value: totals.costBreakdown.legal },
                { label: "Outros", value: totals.costBreakdown.other },
              ]
                .filter((item) => item.value > 0)
                .sort((a, b) => b.value - a.value)
                .map((item) => {
                  const pct = totals.costs > 0 ? (item.value / totals.costs) * 100 : 0;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-40 shrink-0">{item.label}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-700 w-24 text-right">
                        {formatCurrency(item.value)}
                      </span>
                      <span className="text-[10px] text-slate-400 w-10 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Sem dados */}
      {filtered.length === 0 && (
        <div className="card card-body text-center py-8 text-slate-400 text-sm">
          Sem dados de P&L para {periodLabel}. Importe transacoes e regenere o P&L.
        </div>
      )}
    </div>
  );
}

interface ReconciliationCardProps {
  pnlNet: number;
  cashflow: {
    cash_delta: number;
    revenue_flow: number;
    cost_flow: number;
    intercompany_flow: number;
    transfer_flow: number;
    uncategorized_flow: number;
    investment_flow: number;
  };
  periodLabel: string;
}

function ReconciliationCard({ pnlNet, cashflow, periodLabel }: ReconciliationCardProps) {
  const [expanded, setExpanded] = useState(false);

  const leakage = cashflow.cash_delta - pnlNet;

  // Movimentos EXPLICADOS (nao-operacionais — esperados, nao sao problema)
  const explained =
    cashflow.intercompany_flow +
    cashflow.transfer_flow +
    cashflow.investment_flow;

  // Movimentos INEXPLICADOS = uncategorized (problema real)
  const unexplained = cashflow.uncategorized_flow;
  const hasProblems = Math.abs(unexplained) > 1;
  const isHealthy = !hasProblems;

  const items = [
    {
      label: "Transferencias FX / interbank",
      value: cashflow.transfer_flow,
      hint: "Movimentos entre suas contas e conversoes cambiais. Esperado em operacao multi-moeda.",
      ok: true,
    },
    {
      label: "Capital de investidores (SCP)",
      value: cashflow.investment_flow,
      hint: "Aportes e retornos de investidores. Nao e receita operacional — e capital.",
      ok: true,
    },
    {
      label: "Intercompany (entre empresas)",
      value: cashflow.intercompany_flow,
      hint: "Transferencias entre suas empresas. No consolidado deveria ser ~0.",
      ok: Math.abs(cashflow.intercompany_flow) < 100,
    },
    {
      label: "Sem categoria",
      value: cashflow.uncategorized_flow,
      hint: "ATENCAO: afetam o caixa mas NAO entram no P&L. Classifique em /admin/transactions.",
      ok: Math.abs(cashflow.uncategorized_flow) <= 1,
    },
  ];

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full card-header flex items-center justify-between hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <Scale size={16} className={isHealthy ? "text-green-600" : "text-amber-600"} />
          <h3 className="font-semibold text-sm">
            Reconciliacao P&L vs Caixa — {periodLabel}
          </h3>
          {isHealthy ? (
            <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              OK — movimentos nao-operacionais: {formatCurrency(Math.abs(explained))}
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {formatCurrency(Math.abs(unexplained))} sem categoria
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="card-body space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded p-3">
              <p className="text-xs text-slate-500">P&L (Lucro Liquido)</p>
              <p className={`text-lg font-bold ${pnlNet >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(pnlNet)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Receita - Despesas (operacional)
              </p>
            </div>
            <div className="bg-slate-50 rounded p-3">
              <p className="text-xs text-slate-500">Variacao de Caixa</p>
              <p className={`text-lg font-bold ${cashflow.cash_delta >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(cashflow.cash_delta)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Soma de TODAS as transacoes
              </p>
            </div>
            <div className={`rounded p-3 ${isHealthy ? "bg-green-50" : "bg-amber-50"}`}>
              <p className="text-xs text-slate-500">Movimentos nao-operacionais</p>
              <p className={`text-lg font-bold ${isHealthy ? "text-green-700" : "text-amber-700"}`}>
                {formatCurrency(Math.abs(leakage))}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {isHealthy
                  ? "100% explicados (FX + investimentos + intercompany)"
                  : `${formatCurrency(Math.abs(unexplained))} inexplicados (sem categoria)`}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Composicao dos movimentos nao-operacionais:
            </p>
            <div className="space-y-2">
              {items.filter((i) => Math.abs(i.value) > 0.5).map((item) => (
                <div
                  key={item.label}
                  className={`flex items-start gap-3 p-2 rounded ${
                    !item.ok ? "bg-amber-50 border border-amber-200" : "bg-slate-50"
                  }`}
                >
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${!item.ok ? "text-amber-900" : "text-slate-700"}`}>
                      {item.ok ? "✓" : "⚠"} {item.label}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{item.hint}</p>
                  </div>
                  <span
                    className={`font-mono text-sm shrink-0 ${
                      item.value >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

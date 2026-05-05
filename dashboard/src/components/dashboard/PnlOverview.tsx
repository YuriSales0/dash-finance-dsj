"use client";

import { useState, useMemo } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { MonthlyPnl, MonthlyCashflow, MonthlyCashflowByCurrency } from "@/types/database";
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

// Ordem preferida das moedas (mais relevantes primeiro)
const CURRENCY_ORDER = ["USD", "GBP", "EUR", "BRL"];

// new Date("2026-01-01") em UTC-3 vira 31/dez/2025 23:00 local → getMonth()=11.
// Parsear YYYY-MM-DD como local date evita o shift de timezone.
function parseLocalDate(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1 }; // month 0-indexed
}

interface PnlOverviewProps {
  pnl: MonthlyPnl[];
  cashflow?: MonthlyCashflow[];
  cashflowByCurrency?: MonthlyCashflowByCurrency[];
}

interface CurrencyTotals {
  currency: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  intercompany_flow: number;
  transfer_flow: number;
  uncategorized_flow: number;
  investment_flow: number;
}

export function PnlOverview({ pnl, cashflow = [], cashflowByCurrency = [] }: PnlOverviewProps) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const p of pnl) set.add(parseLocalDate(p.month).year);
    for (const c of cashflow) set.add(parseLocalDate(c.month).year);
    for (const c of cashflowByCurrency) set.add(parseLocalDate(c.month).year);
    return Array.from(set).sort((a, b) => b - a);
  }, [pnl, cashflow, cashflowByCurrency]);

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

  const filteredByCurrency = useMemo(() => {
    return cashflowByCurrency.filter((c) => {
      const { year, month } = parseLocalDate(c.month);
      if (year !== selectedYear) return false;
      if (selectedMonth !== null && month !== selectedMonth) return false;
      return true;
    });
  }, [cashflowByCurrency, selectedYear, selectedMonth]);

  // Agrupar por moeda (Receita / Despesa / Lucro / Reconciliacao)
  const byCurrency = useMemo<CurrencyTotals[]>(() => {
    const map: Record<string, CurrencyTotals> = {};
    for (const c of filteredByCurrency) {
      const cur = c.currency || "UNKNOWN";
      if (!map[cur]) {
        map[cur] = {
          currency: cur,
          revenue: 0,
          costs: 0,
          profit: 0,
          margin: 0,
          intercompany_flow: 0,
          transfer_flow: 0,
          uncategorized_flow: 0,
          investment_flow: 0,
        };
      }
      const t = map[cur];
      t.revenue += c.revenue_flow;
      // cost_flow vem negativo — convertemos pra positivo no campo costs
      t.costs += -c.cost_flow;
      t.intercompany_flow += c.intercompany_flow;
      t.transfer_flow += c.transfer_flow;
      t.uncategorized_flow += c.uncategorized_flow;
      t.investment_flow += c.investment_flow;
    }
    for (const t of Object.values(map)) {
      t.profit = t.revenue - t.costs;
      t.margin = t.revenue > 0 ? (t.profit / t.revenue) * 100 : 0;
    }
    return Object.values(map).sort((a, b) => {
      const ai = CURRENCY_ORDER.indexOf(a.currency);
      const bi = CURRENCY_ORDER.indexOf(b.currency);
      const ax = ai === -1 ? 99 : ai;
      const bx = bi === -1 ? 99 : bi;
      if (ax !== bx) return ax - bx;
      return a.currency.localeCompare(b.currency);
    });
  }, [filteredByCurrency]);

  // Cost breakdown vem do MonthlyPnl (consolidado em USD-equivalente — view mantida como referencia)
  const costBreakdown = useMemo(() => {
    return {
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
  }, [filtered]);

  const totalCostsBreakdown = Object.values(costBreakdown).reduce((s, v) => s + v, 0);

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

      {/* Aviso multi-moeda */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
        <strong>P&amp;L por moeda:</strong> as empresas operam em USD, GBP, EUR e BRL sem
        conversao cambial automatica. Cada moeda e mostrada separadamente — somar moedas
        diferentes nao gera um numero util.
      </div>

      {/* P&L por moeda */}
      {byCurrency.length === 0 ? (
        <div className="card card-body text-center py-8 text-slate-400 text-sm">
          Sem dados de cashflow para {periodLabel}. Importe transacoes.
        </div>
      ) : (
        <div className="space-y-4">
          {byCurrency.map((t) => (
            <CurrencyBlock key={t.currency} totals={t} periodLabel={periodLabel} />
          ))}
        </div>
      )}

      {/* Breakdown de custos (consolidado, referencia) */}
      {totalCostsBreakdown > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">
              Composicao de Despesas — {periodLabel}{" "}
              <span className="text-[10px] text-slate-400 font-normal">
                (consolidado USD-equivalente, somente referencia)
              </span>
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {[
                { label: "Produtos", value: costBreakdown.products },
                { label: "Ads (Meta + TikTok + Google)", value: costBreakdown.ads },
                { label: "Frete", value: costBreakdown.shipping },
                { label: "Gateway/Processador", value: costBreakdown.gateway },
                { label: "Reembolsos", value: costBreakdown.refunds },
                { label: "Chargebacks", value: costBreakdown.chargebacks },
                { label: "Team", value: costBreakdown.team },
                { label: "SaaS", value: costBreakdown.saas },
                { label: "Infraestrutura", value: costBreakdown.infra },
                { label: "Legal", value: costBreakdown.legal },
                { label: "Outros", value: costBreakdown.other },
              ]
                .filter((item) => item.value > 0)
                .sort((a, b) => b.value - a.value)
                .map((item) => {
                  const pct = totalCostsBreakdown > 0 ? (item.value / totalCostsBreakdown) * 100 : 0;
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
    </div>
  );
}

interface CurrencyBlockProps {
  totals: CurrencyTotals;
  periodLabel: string;
}

function CurrencyBlock({ totals, periodLabel }: CurrencyBlockProps) {
  const { currency, revenue, costs, profit, margin } = totals;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
          {currency}
        </span>
        <span className="text-xs text-slate-500">{periodLabel}</span>
      </div>

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
            {formatCurrency(revenue, currency)}
          </p>
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
            {formatCurrency(costs, currency)}
          </p>
        </div>

        {/* Lucro / Prejuizo */}
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Lucro / Prejuizo</p>
            <div className={`p-2 rounded-lg ${profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              {profit >= 0 ? (
                <ArrowUpRight size={18} className="text-green-600" />
              ) : (
                <ArrowDownRight size={18} className="text-red-600" />
              )}
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(profit, currency)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-400">Margem: {formatPercent(margin)}</p>
          </div>
        </div>
      </div>

      <ReconciliationCard totals={totals} periodLabel={periodLabel} />
    </div>
  );
}

interface ReconciliationCardProps {
  totals: CurrencyTotals;
  periodLabel: string;
}

function ReconciliationCard({ totals, periodLabel }: ReconciliationCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Caixa OPERACIONAL: Receita - Despesas + Uncategorized (sem FX/intercompany/investimentos)
  // (estes sao movimentos legitimos mas nao operacionais — nao deveriam afetar o P&L)
  const operationalCash = totals.revenue - totals.costs + totals.uncategorized_flow;
  const pnlNet = totals.revenue - totals.costs;
  const diff = operationalCash - pnlNet;
  const hasProblems = Math.abs(totals.uncategorized_flow) > 1 || Math.abs(diff) > 1;
  const isHealthy = !hasProblems;

  const infoItems = [
    {
      label: "Transferencias FX / interbank",
      value: totals.transfer_flow,
      hint: "Conversoes entre moedas e movimentos entre suas contas. Esperado em operacao multi-moeda.",
    },
    {
      label: "Capital de investidores (SCP)",
      value: totals.investment_flow,
      hint: "Aportes e retornos de investidores. E capital, nao receita operacional.",
    },
    {
      label: "Intercompany (entre empresas)",
      value: totals.intercompany_flow,
      hint: "Transferencias entre suas proprias empresas. No consolidado deveria ser ~0.",
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
            Reconciliacao P&amp;L vs Caixa ({totals.currency})
          </h3>
          {isHealthy ? (
            <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              OK — bate com P&amp;L
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {formatCurrency(Math.abs(totals.uncategorized_flow), totals.currency)} sem categoria
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="card-body space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded p-3">
              <p className="text-xs text-slate-500">P&amp;L (Lucro Liquido)</p>
              <p className={`text-lg font-bold ${pnlNet >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(pnlNet, totals.currency)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Receita - Despesas (operacional)
              </p>
            </div>
            <div className="bg-slate-50 rounded p-3">
              <p className="text-xs text-slate-500">Caixa operacional</p>
              <p className={`text-lg font-bold ${operationalCash >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(operationalCash, totals.currency)}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Receitas + Custos + Uncategorized (sem FX/intercompany/investimentos)
              </p>
            </div>
            <div className={`rounded p-3 ${isHealthy ? "bg-green-50" : "bg-amber-50"}`}>
              <p className="text-xs text-slate-500">Diferenca (deveria ser 0)</p>
              <p className={`text-lg font-bold ${isHealthy ? "text-green-700" : "text-amber-700"}`}>
                {formatCurrency(Math.abs(diff), totals.currency)}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {isHealthy
                  ? "P&L espelha o caixa operacional"
                  : `${formatCurrency(Math.abs(totals.uncategorized_flow), totals.currency)} sem categoria — classifique`}
              </p>
            </div>
          </div>

          {Math.abs(totals.uncategorized_flow) > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
              <p className="font-semibold text-amber-900">
                ⚠ Uncategorized: {formatCurrency(totals.uncategorized_flow, totals.currency)}
              </p>
              <p className="text-amber-700 mt-1">
                Estas transacoes afetam o caixa mas NAO entram no P&amp;L.{" "}
                <a href="/admin/transactions" className="underline">
                  Classifique em Transacoes
                </a>
                .
              </p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Movimentos nao-operacionais (informativos, nao afetam diferenca):
            </p>
            <div className="space-y-2">
              {infoItems.filter((i) => Math.abs(i.value) > 0.5).map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-3 p-2 rounded bg-slate-50"
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-700">{item.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{item.hint}</p>
                  </div>
                  <span className="font-mono text-sm shrink-0 text-slate-700">
                    {formatCurrency(item.value, totals.currency)}
                  </span>
                </div>
              ))}
              {infoItems.every((i) => Math.abs(i.value) < 0.5) && (
                <p className="text-xs text-slate-400 italic">Nenhum movimento nao-operacional</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

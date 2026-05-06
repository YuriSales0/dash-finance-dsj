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

const CURRENCY_ORDER = ["USD", "GBP", "EUR", "BRL"];

// new Date("2026-01-01") em UTC-3 vira 31/dez/2025 23:00 local → getMonth()=11.
// Parsear YYYY-MM-DD como local date evita o shift de timezone.
function parseLocalDate(dateStr: string): { year: number; month: number } {
  const [y, m] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1 };
}

interface PnlOverviewProps {
  pnl: MonthlyPnl[];
  cashflow?: MonthlyCashflow[];
  cashflowByCurrency?: MonthlyCashflowByCurrency[];
}

interface MonthRow {
  month: string;
  // P&L = caixa: receita = tudo que entrou, despesa = tudo que saiu
  receita: number;       // inflow (todas as positivas)
  despesa: number;       // outflow absoluto (todas as negativas)
  lucro: number;         // receita - despesa = cash_delta
  // decomposicao por categoria (pra detalhamento)
  operacional: number;   // revenue_flow + cost_flow (operacional)
  transfer_flow: number;
  intercompany_flow: number;
  investment_flow: number;
  uncategorized_flow: number;
  cash_delta: number;
}

interface CurrencyData {
  currency: string;
  totals: {
    receita: number;
    despesa: number;
    lucro: number;
    margin: number;
    operacional: number;
    transfer_flow: number;
    intercompany_flow: number;
    investment_flow: number;
    uncategorized_flow: number;
    cash_delta: number;
  };
  monthly: MonthRow[];
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

  // Agrupar por moeda + manter linhas mensais
  // Receita = tudo que entrou (inflow). Despesa = tudo que saiu (outflow).
  // Lucro = Receita - Despesa = cash_delta (variacao real do saldo).
  const byCurrency = useMemo<CurrencyData[]>(() => {
    const map: Record<string, CurrencyData> = {};
    for (const c of filteredByCurrency) {
      const cur = c.currency || "UNKNOWN";
      if (!map[cur]) {
        map[cur] = {
          currency: cur,
          totals: {
            receita: 0,
            despesa: 0,
            lucro: 0,
            margin: 0,
            operacional: 0,
            transfer_flow: 0,
            intercompany_flow: 0,
            investment_flow: 0,
            uncategorized_flow: 0,
            cash_delta: 0,
          },
          monthly: [],
        };
      }
      const x = map[cur];
      const operacional = c.revenue_flow + c.cost_flow; // cost_flow ja negativo
      x.totals.receita += c.inflow;
      x.totals.despesa += c.outflow;
      x.totals.operacional += operacional;
      x.totals.transfer_flow += c.transfer_flow;
      x.totals.intercompany_flow += c.intercompany_flow;
      x.totals.investment_flow += c.investment_flow;
      x.totals.uncategorized_flow += c.uncategorized_flow;
      x.totals.cash_delta += c.cash_delta;
      x.monthly.push({
        month: c.month,
        receita: c.inflow,
        despesa: c.outflow,
        lucro: c.inflow - c.outflow,
        operacional,
        transfer_flow: c.transfer_flow,
        intercompany_flow: c.intercompany_flow,
        investment_flow: c.investment_flow,
        uncategorized_flow: c.uncategorized_flow,
        cash_delta: c.cash_delta,
      });
    }
    for (const x of Object.values(map)) {
      x.totals.lucro = x.totals.receita - x.totals.despesa;
      x.totals.margin = x.totals.receita > 0 ? (x.totals.lucro / x.totals.receita) * 100 : 0;
      x.monthly.sort((a, b) => a.month.localeCompare(b.month));
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

      {/* Aviso multi-moeda + disclaimer cash basis */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900">
        <strong>P&amp;L em regime de caixa:</strong> Receita = tudo que entrou,
        Despesa = tudo que saiu (incluindo FX/interbank, intercompany e
        investidores). Lucro = Receita − Despesa = variação real do saldo no
        período. Cada moeda é mostrada separadamente (sem conversão automática).
        <span className="block mt-1 text-[10px] text-blue-700">
          Este P&amp;L usa <strong>regime de caixa</strong> (cash basis) — reflete quando
          o dinheiro entrou/saiu da conta, não quando foi faturado. Difere de P&amp;L
          por competência (accrual) usado em contabilidade formal.
        </span>
      </div>

      {/* P&L por moeda */}
      {byCurrency.length === 0 ? (
        <div className="card card-body text-center py-8 text-slate-400 text-sm">
          Sem dados de cashflow para {periodLabel}. Importe transacoes.
        </div>
      ) : (
        <div className="space-y-4">
          {byCurrency.map((d) => (
            <CurrencyBlock key={d.currency} data={d} periodLabel={periodLabel} />
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
  data: CurrencyData;
  periodLabel: string;
}

function CurrencyBlock({ data, periodLabel }: CurrencyBlockProps) {
  const { currency, totals } = data;
  const { receita, despesa, lucro, margin } = totals;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
          {currency}
        </span>
        <span className="text-xs text-slate-500">{periodLabel}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-body">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Receita</p>
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp size={18} className="text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(receita, currency)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Tudo que entrou no periodo</p>
        </div>

        <div className="card card-body">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Despesa</p>
            <div className="p-2 bg-red-50 rounded-lg">
              <TrendingDown size={18} className="text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(despesa, currency)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Tudo que saiu no periodo</p>
        </div>

        <div className="card card-body">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Lucro / Prejuizo</p>
            <div className={`p-2 rounded-lg ${lucro >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              {lucro >= 0 ? (
                <ArrowUpRight size={18} className="text-green-600" />
              ) : (
                <ArrowDownRight size={18} className="text-red-600" />
              )}
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(lucro, currency)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-400">
              Margem: {formatPercent(margin)} · = variacao do saldo
            </p>
          </div>
        </div>
      </div>

      <ReconciliationCard data={data} periodLabel={periodLabel} />
    </div>
  );
}

interface ReconciliationCardProps {
  data: CurrencyData;
  periodLabel: string;
}

function ReconciliationCard({ data, periodLabel }: ReconciliationCardProps) {
  // Decomposicao SEMPRE visivel pra deixar claro o que compoe o lucro.
  // Tabela mensal e opcional (toggle).
  const [showMonthly, setShowMonthly] = useState(false);
  const { currency, totals, monthly } = data;

  // Lucro = totals.lucro = receita - despesa = cash_delta (variacao do saldo)
  const lucro = totals.lucro;

  // Saude do balanco: SO depende de uncategorized (mesmo agora que entra no lucro,
  // sinaliza pendencia de classificacao).
  const hasUncategorized = Math.abs(totals.uncategorized_flow) > 1;
  const isHealthy = !hasUncategorized;

  const components = [
    {
      label: "Operacional (revenue - cost)",
      value: totals.operacional,
      color: totals.operacional >= 0 ? "text-green-700" : "text-red-700",
      hint: "Receitas operacionais menos custos operacionais",
    },
    {
      label: "FX / interbank",
      value: totals.transfer_flow,
      color: "text-slate-700",
      hint: "Conversoes cambiais e transferencias entre suas contas",
    },
    {
      label: "Intercompany",
      value: totals.intercompany_flow,
      color: "text-slate-700",
      hint: "Movimentos entre suas empresas",
    },
    {
      label: "Capital de investidores (SCP)",
      value: totals.investment_flow,
      color: "text-slate-700",
      hint: "Aportes recebidos / retornos pagos",
    },
    {
      label: "Sem categoria",
      value: totals.uncategorized_flow,
      color: hasUncategorized ? "text-amber-700" : "text-slate-400",
      hint: "Transacoes ainda nao classificadas",
    },
  ];

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={16} className={isHealthy ? "text-green-600" : "text-amber-600"} />
          <h3 className="font-semibold text-sm">
            Composicao do Lucro ({currency})
          </h3>
          {isHealthy ? (
            <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              OK — tudo classificado
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {formatCurrency(Math.abs(totals.uncategorized_flow), currency)} sem categoria
            </span>
          )}
        </div>
      </div>

      <div className="card-body space-y-4 text-sm">
          {/* Decomposicao do lucro — SEMPRE visivel */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Como o Lucro/Prejuizo e formado no periodo:
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              {components.map((c, i) => (
                <div
                  key={c.label}
                  className={`flex items-start gap-3 px-3 py-2 ${
                    i % 2 === 0 ? "bg-slate-50" : "bg-white"
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-700">{c.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{c.hint}</p>
                  </div>
                  <span className={`font-mono text-sm shrink-0 ${c.color}`}>
                    {c.value >= 0 ? "+" : ""}
                    {formatCurrency(c.value, currency)}
                  </span>
                </div>
              ))}
              <div className="flex items-start gap-3 px-3 py-2 bg-slate-100 border-t-2 border-slate-300">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-900">= Lucro / Prejuizo do periodo</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    Receita - Despesa = variacao real do saldo em {currency}
                  </p>
                </div>
                <span className={`font-mono text-base font-bold shrink-0 ${
                  lucro >= 0 ? "text-green-700" : "text-red-700"
                }`}>
                  {lucro >= 0 ? "+" : ""}
                  {formatCurrency(lucro, currency)}
                </span>
              </div>
            </div>
          </div>

          {hasUncategorized && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
              <p className="font-semibold text-amber-900">
                ⚠ {formatCurrency(Math.abs(totals.uncategorized_flow), currency)} sem categoria
              </p>
              <p className="text-amber-700 mt-1">
                Estas transacoes movimentam o caixa mas nao tem categoria.{" "}
                <a href="/admin/transactions" className="underline">
                  Classifique em Transacoes
                </a>{" "}
                pra fechar a reconciliacao.
              </p>
            </div>
          )}

          {/* Tabela mes a mes */}
          {monthly.length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <button
                onClick={() => setShowMonthly(!showMonthly)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                {showMonthly ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Detalhamento mes a mes ({monthly.length})
              </button>
              {showMonthly && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium text-slate-600">Mes</th>
                        <th className="text-right px-2 py-1.5 font-medium text-slate-600">Receita</th>
                        <th className="text-right px-2 py-1.5 font-medium text-slate-600">Despesa</th>
                        <th className="text-right px-2 py-1.5 font-medium text-slate-600 border-l border-slate-200">
                          Lucro
                        </th>
                        <th className="text-right px-2 py-1.5 font-medium text-slate-600">Operac.</th>
                        <th className="text-right px-2 py-1.5 font-medium text-slate-600">FX</th>
                        <th className="text-right px-2 py-1.5 font-medium text-slate-600">Inter</th>
                        <th className="text-right px-2 py-1.5 font-medium text-slate-600">Invest</th>
                        <th className="text-right px-2 py-1.5 font-medium text-slate-600">Uncat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.map((m) => {
                        const { year, month } = parseLocalDate(m.month);
                        const label = `${MONTH_NAMES[month]}/${String(year).slice(-2)}`;
                        return (
                          <tr key={m.month} className="border-t border-slate-100">
                            <td className="px-2 py-1.5 font-medium text-slate-700">{label}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-green-700">
                              {m.receita > 0 ? formatCurrency(m.receita, currency) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-red-600">
                              {m.despesa > 0 ? formatCurrency(m.despesa, currency) : "—"}
                            </td>
                            <td className={`px-2 py-1.5 text-right font-mono font-bold border-l border-slate-200 ${
                              m.lucro >= 0 ? "text-green-700" : "text-red-700"
                            }`}>
                              {formatCurrency(m.lucro, currency)}
                            </td>
                            <td className={`px-2 py-1.5 text-right font-mono ${
                              m.operacional >= 0 ? "text-slate-700" : "text-slate-700"
                            }`}>
                              {Math.abs(m.operacional) > 0.5 ? formatCurrency(m.operacional, currency) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-600">
                              {Math.abs(m.transfer_flow) > 0.5 ? formatCurrency(m.transfer_flow, currency) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-600">
                              {Math.abs(m.intercompany_flow) > 0.5 ? formatCurrency(m.intercompany_flow, currency) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-slate-600">
                              {Math.abs(m.investment_flow) > 0.5 ? formatCurrency(m.investment_flow, currency) : "—"}
                            </td>
                            <td className={`px-2 py-1.5 text-right font-mono ${
                              Math.abs(m.uncategorized_flow) > 0.5 ? "text-amber-700" : "text-slate-400"
                            }`}>
                              {Math.abs(m.uncategorized_flow) > 0.5 ? formatCurrency(m.uncategorized_flow, currency) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                      <tr>
                        <td className="px-2 py-1.5 font-bold text-slate-700">Total {periodLabel}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-green-700">
                          {formatCurrency(totals.receita, currency)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-red-600">
                          {formatCurrency(totals.despesa, currency)}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-mono font-bold border-l border-slate-300 ${
                          lucro >= 0 ? "text-green-700" : "text-red-700"
                        }`}>
                          {formatCurrency(lucro, currency)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-700">
                          {formatCurrency(totals.operacional, currency)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-700">
                          {formatCurrency(totals.transfer_flow, currency)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-700">
                          {formatCurrency(totals.intercompany_flow, currency)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-slate-700">
                          {formatCurrency(totals.investment_flow, currency)}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-mono ${
                          hasUncategorized ? "text-amber-700 font-bold" : "text-slate-400"
                        }`}>
                          {formatCurrency(totals.uncategorized_flow, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { MonthlyPnl } from "@/types/database";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

interface PnlOverviewProps {
  data: MonthlyPnl[];
}

export function PnlOverview({ data }: PnlOverviewProps) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const p of data) {
      set.add(new Date(p.month).getFullYear());
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);

  const [selectedYear, setSelectedYear] = useState(() => years[0] || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = all

  const filtered = useMemo(() => {
    return data.filter((p) => {
      const d = new Date(p.month);
      if (d.getFullYear() !== selectedYear) return false;
      if (selectedMonth !== null && d.getMonth() !== selectedMonth) return false;
      return true;
    });
  }, [data, selectedYear, selectedMonth]);

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

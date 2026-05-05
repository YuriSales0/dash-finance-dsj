"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  X,
} from "lucide-react";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";

export interface CalendarInflow {
  receivable_id: number;
  description: string;
  counterparty: string | null;
  entity_id: string;
  amount: number;
  currency: string;
}

export interface CalendarOutflow {
  debt_id: number;
  description: string;
  creditor: string | null;
  entity_id: string;
  amount: number;
  currency: string;
  kind: string;
  occurrence_index?: number;
  total_occurrences?: number;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  inflows: CalendarInflow[];
  outflows: CalendarOutflow[];
}

interface Props {
  weekStart: string; // YYYY-MM-DD (Monday)
  days: CalendarDay[]; // 7 entries
  todayIso: string; // YYYY-MM-DD
}

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const CURRENCY_ORDER = ["USD", "GBP", "EUR", "BRL"];

export function WeeklyCalendar({ weekStart, days, todayIso }: Props) {
  const router = useRouter();
  const [filterCurrency, setFilterCurrency] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");
  const [openDay, setOpenDay] = useState<string | null>(null);

  // Lista todas as moedas + entidades nos dados pra popular filtros
  const allCurrencies = useMemo(() => {
    const set = new Set<string>();
    days.forEach((d) => {
      d.inflows.forEach((i) => set.add(i.currency));
      d.outflows.forEach((o) => set.add(o.currency));
    });
    return Array.from(set).sort((a, b) => {
      const ai = CURRENCY_ORDER.indexOf(a);
      const bi = CURRENCY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [days]);

  function applyFilter(d: CalendarDay): CalendarDay {
    let inflows = d.inflows;
    let outflows = d.outflows;
    if (filterCurrency !== "all") {
      inflows = inflows.filter((i) => i.currency === filterCurrency);
      outflows = outflows.filter((o) => o.currency === filterCurrency);
    }
    if (filterType === "in") outflows = [];
    if (filterType === "out") inflows = [];
    return { ...d, inflows, outflows };
  }

  const filteredDays = days.map(applyFilter);

  // Navegacao
  function shiftWeek(deltaDays: number) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + deltaDays);
    const newStart = start.toISOString().slice(0, 10);
    router.push(`/admin/calendar?week=${newStart}`);
  }

  const weekStartDate = new Date(weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekLabel = `${formatDate(weekStartDate.toISOString())} – ${formatDate(
    weekEndDate.toISOString()
  )}`;

  // Encontrar o dia "hoje" se estiver na semana
  const todayInWeek = filteredDays.find((d) => d.date === todayIso);

  // Totais da semana
  const weekTotals = useMemo(() => {
    const t: Record<string, { in: number; out: number }> = {};
    for (const d of filteredDays) {
      for (const i of d.inflows) {
        if (!t[i.currency]) t[i.currency] = { in: 0, out: 0 };
        t[i.currency].in += i.amount;
      }
      for (const o of d.outflows) {
        if (!t[o.currency]) t[o.currency] = { in: 0, out: 0 };
        t[o.currency].out += o.amount;
      }
    }
    return t;
  }, [filteredDays]);

  const openDayData = openDay ? filteredDays.find((d) => d.date === openDay) : null;

  return (
    <div className="space-y-6">
      {/* Filtros + Nav */}
      <div className="card card-body flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => shiftWeek(-7)}
            className="btn-secondary inline-flex items-center gap-1"
          >
            <ChevronLeft size={16} /> Semana anterior
          </button>
          <button
            onClick={() => router.push("/admin/calendar")}
            className="btn-secondary text-sm"
          >
            Hoje
          </button>
          <button
            onClick={() => shiftWeek(7)}
            className="btn-secondary inline-flex items-center gap-1"
          >
            Proxima semana <ChevronRight size={16} />
          </button>
          <span className="text-sm font-medium text-slate-700 ml-2">
            <Calendar size={14} className="inline mr-1" />
            {weekLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCurrency}
            onChange={(e) => setFilterCurrency(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="all">Todas as moedas</option>
            {allCurrencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="input text-sm py-1.5"
          >
            <option value="all">Entradas + Saidas</option>
            <option value="in">Apenas entradas</option>
            <option value="out">Apenas saidas</option>
          </select>
        </div>
      </div>

      {/* Today highlight */}
      {todayInWeek && (
        <TodayCard day={todayInWeek} />
      )}

      {/* Week grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {filteredDays.map((d, idx) => {
          const dt = new Date(d.date + "T00:00:00");
          const isToday = d.date === todayIso;
          const isPast = d.date < todayIso;
          const totalIn = d.inflows.reduce((s, i) => s + i.amount, 0);
          const totalOut = d.outflows.reduce((s, o) => s + o.amount, 0);
          const totalCount = d.inflows.length + d.outflows.length;

          return (
            <button
              key={d.date}
              onClick={() => totalCount > 0 && setOpenDay(d.date)}
              disabled={totalCount === 0}
              className={`text-left rounded-lg p-3 border transition disabled:cursor-default
                ${
                  isToday
                    ? "bg-brand-50 border-brand-300 ring-2 ring-brand-200"
                    : isPast
                    ? "bg-slate-50 border-slate-200 opacity-70"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }
                ${totalCount > 0 && !isToday ? "hover:shadow-md" : ""}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  {WEEKDAY_NAMES[idx]}
                </span>
                <span
                  className={`text-xs font-bold ${
                    isToday ? "text-brand-700" : "text-slate-700"
                  }`}
                >
                  {dt.getDate().toString().padStart(2, "0")}/
                  {(dt.getMonth() + 1).toString().padStart(2, "0")}
                </span>
              </div>
              {totalCount === 0 ? (
                <p className="text-[10px] text-slate-400 italic">sem movimentos</p>
              ) : (
                <div className="space-y-1">
                  {d.inflows.length > 0 && (
                    <SumPill type="in" value={totalIn} count={d.inflows.length} />
                  )}
                  {d.outflows.length > 0 && (
                    <SumPill type="out" value={totalOut} count={d.outflows.length} />
                  )}
                  <p className="text-[9px] text-slate-400 mt-1">
                    {totalCount} item{totalCount === 1 ? "" : "s"} · clique
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Totais da semana */}
      {Object.keys(weekTotals).length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">Totais da semana</h3>
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(weekTotals)
              .sort(([a], [b]) => {
                const ai = CURRENCY_ORDER.indexOf(a);
                const bi = CURRENCY_ORDER.indexOf(b);
                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
              })
              .map(([cur, t]) => {
                const net = t.in - t.out;
                return (
                  <div key={cur} className="bg-slate-50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                        {cur}
                      </span>
                      <span
                        className={`text-sm font-mono font-bold ${
                          net >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {net >= 0 ? "+" : ""}
                        {formatCurrency(net, cur)}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-xs font-mono">
                      <p className="text-green-700">
                        + {formatCurrency(t.in, cur)} entradas
                      </p>
                      <p className="text-red-700">
                        - {formatCurrency(t.out, cur)} saidas
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Modal de dia */}
      {openDayData && (
        <DayDetailModal day={openDayData} onClose={() => setOpenDay(null)} />
      )}
    </div>
  );
}

function SumPill({
  type,
  value,
  count,
}: {
  type: "in" | "out";
  value: number;
  count: number;
}) {
  const isIn = type === "in";
  return (
    <div
      className={`flex items-center justify-between rounded px-1.5 py-0.5 text-[10px] font-mono ${
        isIn ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
      }`}
    >
      <span className="flex items-center gap-1">
        {isIn ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
        {count}
      </span>
      <span className="font-bold">
        {isIn ? "+" : "-"}
        {formatCompact(value)}
      </span>
    </div>
  );
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function TodayCard({ day }: { day: CalendarDay }) {
  const totalIn = day.inflows.reduce((s, i) => s + i.amount, 0);
  const totalOut = day.outflows.reduce((s, o) => s + o.amount, 0);
  const dt = new Date(day.date + "T00:00:00");
  const dayName = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"][
    dt.getDay()
  ];

  return (
    <div className="card border-2 border-brand-300 bg-brand-50/40">
      <div className="card-header bg-brand-50 border-brand-200">
        <h3 className="font-bold flex items-center gap-2 text-brand-900">
          <Calendar size={16} className="text-brand-600" />
          Pagamentos de hoje · {dayName} {formatDate(day.date)}
        </h3>
      </div>
      <div className="card-body">
        {day.inflows.length === 0 && day.outflows.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-4">
            Nenhum movimento programado pra hoje.
          </p>
        ) : (
          <DayItems day={day} />
        )}
      </div>
    </div>
  );
}

function DayDetailModal({
  day,
  onClose,
}: {
  day: CalendarDay;
  onClose: () => void;
}) {
  const dt = new Date(day.date + "T00:00:00");
  const dayName = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"][
    dt.getDay()
  ];
  const totalIn = day.inflows.reduce((s, i) => s + i.amount, 0);
  const totalOut = day.outflows.reduce((s, o) => s + o.amount, 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Calendar size={16} className="text-brand-600" />
              {dayName}, {formatDate(day.date)}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {day.inflows.length} entrada(s) · {day.outflows.length} saida(s)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <DayItems day={day} />
        </div>
      </div>
    </div>
  );
}

function DayItems({ day }: { day: CalendarDay }) {
  return (
    <div className="space-y-3">
      {day.inflows.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
            <ArrowUpRight size={12} />
            Entradas ({day.inflows.length})
          </p>
          <div className="space-y-1.5">
            {day.inflows.map((i) => (
              <div
                key={`in-${i.receivable_id}`}
                className="bg-green-50 border border-green-100 rounded p-2.5 flex justify-between items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    Recebivel #{i.receivable_id}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {i.counterparty || "—"} ·{" "}
                    {entityNames[i.entity_id] || i.entity_id}
                  </p>
                </div>
                <p className="font-mono font-semibold text-green-700 shrink-0">
                  + {formatCurrency(i.amount, i.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {day.outflows.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
            <ArrowDownRight size={12} />
            Saidas ({day.outflows.length})
          </p>
          <div className="space-y-1.5">
            {day.outflows.map((o, idx) => (
              <div
                key={`out-${o.debt_id}-${idx}`}
                className="bg-red-50 border border-red-100 rounded p-2.5 flex justify-between items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{o.description}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {o.creditor && <span>{o.creditor}</span>}
                    {o.creditor && <span>·</span>}
                    <span>{entityNames[o.entity_id] || o.entity_id}</span>
                    <span className="bg-white px-1 py-0.5 rounded text-[9px]">
                      {o.kind}
                      {o.occurrence_index && o.total_occurrences
                        ? ` ${o.occurrence_index}/${o.total_occurrences}`
                        : ""}
                    </span>
                  </p>
                </div>
                <p className="font-mono font-semibold text-red-700 shrink-0">
                  - {formatCurrency(o.amount, o.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

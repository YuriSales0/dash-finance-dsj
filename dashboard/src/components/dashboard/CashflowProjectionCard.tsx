"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Scale, X, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import type { Receivable } from "@/types/database";
import type { DebtOccurrence } from "@/components/debts/TermCardWithDetails";

const CURRENCY_ORDER = ["USD", "GBP", "EUR", "BRL"];

export interface ReceivableEntry {
  receivable_id: number;
  description: string;
  counterparty: string | null;
  entity_id: string;
  amount: number;
  currency: string;
  due_date: string;
  days_from_today: number;
}

interface BucketCurrencyData {
  currency: string;
  entradas: number;
  saidas: number;
  liquido: number;
  receivables: ReceivableEntry[];
  debtOccurrences: DebtOccurrence[];
}

interface BucketData {
  label: string;
  sublabel: string;
  byCurrency: BucketCurrencyData[];
}

interface Props {
  curto: BucketData;
  medio: BucketData;
}

export function CashflowProjectionCard({ curto, medio }: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-sm">Projecao de Fluxo de Caixa por Prazo</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Entradas (recebiveis) - Saidas (dividas de capital) por moeda. Clique nos valores pra detalhar.
        </p>
        <p className="text-[10px] text-slate-400 mt-1 italic">
          Saidas incluem apenas emprestimos, aportes de investidor (juros/balloon) e outros
          compromissos de capital. Custos operacionais recorrentes (salarios, ads, SaaS, frete,
          etc.) ficam de fora — sao pagos pela receita corrente que ainda nao esta nos recebiveis.
        </p>
      </div>
      <div className="card-body space-y-4">
        <BucketSection bucket={curto} />
        <BucketSection bucket={medio} />
      </div>
    </div>
  );
}

function BucketSection({ bucket }: { bucket: BucketData }) {
  const sortedCurrencies = [...bucket.byCurrency].sort((a, b) => {
    const ai = CURRENCY_ORDER.indexOf(a.currency);
    const bi = CURRENCY_ORDER.indexOf(b.currency);
    const ax = ai === -1 ? 99 : ai;
    const bx = bi === -1 ? 99 : bi;
    return ax !== bx ? ax - bx : a.currency.localeCompare(b.currency);
  });

  if (sortedCurrencies.length === 0) {
    return (
      <div>
        <div className="flex items-baseline gap-2 mb-2">
          <h4 className="text-sm font-semibold text-slate-700">{bucket.label}</h4>
          <span className="text-[10px] text-slate-400">{bucket.sublabel}</span>
        </div>
        <p className="text-xs text-slate-400 italic">Sem movimentacao no periodo</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-700">{bucket.label}</h4>
        <span className="text-[10px] text-slate-400">{bucket.sublabel}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-slate-600">
              <th className="text-left px-3 py-2 font-medium">Moeda</th>
              <th className="text-right px-3 py-2 font-medium">Entradas</th>
              <th className="text-right px-3 py-2 font-medium">Saidas</th>
              <th className="text-right px-3 py-2 font-medium border-l border-slate-200">
                Liquido
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCurrencies.map((c) => (
              <CurrencyRow key={c.currency} data={c} bucketLabel={bucket.label} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CurrencyRow({ data, bucketLabel }: { data: BucketCurrencyData; bucketLabel: string }) {
  const [openSide, setOpenSide] = useState<"entradas" | "saidas" | null>(null);
  const liquido = data.entradas - data.saidas;

  return (
    <>
      <tr className="border-t border-slate-100">
        <td className="px-3 py-2">
          <span className="text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
            {data.currency}
          </span>
        </td>
        <td className="px-3 py-2 text-right">
          {data.entradas > 0 ? (
            <button
              onClick={() => setOpenSide("entradas")}
              className="font-mono text-green-700 hover:underline"
              title="Clique pra detalhar"
            >
              + {formatCurrency(data.entradas, data.currency)}
            </button>
          ) : (
            <span className="font-mono text-slate-400">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {data.saidas > 0 ? (
            <button
              onClick={() => setOpenSide("saidas")}
              className="font-mono text-red-700 hover:underline"
              title="Clique pra detalhar"
            >
              - {formatCurrency(data.saidas, data.currency)}
            </button>
          ) : (
            <span className="font-mono text-slate-400">—</span>
          )}
        </td>
        <td className={`px-3 py-2 text-right font-mono font-bold border-l border-slate-200 ${
          liquido >= 0 ? "text-green-700" : "text-red-700"
        }`}>
          {liquido >= 0 ? "+" : ""}
          {formatCurrency(liquido, data.currency)}
        </td>
      </tr>
      {openSide && (
        <SideModal
          side={openSide}
          bucketLabel={bucketLabel}
          currency={data.currency}
          total={openSide === "entradas" ? data.entradas : data.saidas}
          receivables={openSide === "entradas" ? data.receivables : []}
          debtOccurrences={openSide === "saidas" ? data.debtOccurrences : []}
          onClose={() => setOpenSide(null)}
        />
      )}
    </>
  );
}

interface SideModalProps {
  side: "entradas" | "saidas";
  bucketLabel: string;
  currency: string;
  total: number;
  receivables: ReceivableEntry[];
  debtOccurrences: DebtOccurrence[];
  onClose: () => void;
}

function SideModal({
  side,
  bucketLabel,
  currency,
  total,
  receivables,
  debtOccurrences,
  onClose,
}: SideModalProps) {
  const isEntrada = side === "entradas";
  const sortedReceivables = [...receivables].sort((a, b) => a.days_from_today - b.days_from_today);
  const sortedOccurrences = [...debtOccurrences].sort((a, b) => a.days_from_today - b.days_from_today);

  return (
    <tr>
      <td colSpan={4} className="p-0">
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
                <div className="flex items-center gap-2">
                  {isEntrada ? (
                    <ArrowUpRight size={16} className="text-green-600" />
                  ) : (
                    <ArrowDownRight size={16} className="text-red-600" />
                  )}
                  <h3 className="font-semibold">
                    {isEntrada ? "Entradas" : "Saidas"} — {currency} — {bucketLabel}
                  </h3>
                </div>
                <p className={`text-xl font-bold mt-1 ${isEntrada ? "text-green-700" : "text-red-700"}`}>
                  {isEntrada ? "+" : "-"}
                  {formatCurrency(total, currency)}
                </p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {isEntrada && sortedReceivables.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Sem entradas no periodo</p>
              )}
              {!isEntrada && sortedOccurrences.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Sem saidas no periodo</p>
              )}
              {isEntrada && sortedReceivables.map((r) => (
                <div key={r.receivable_id} className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{r.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 flex-wrap">
                        {r.counterparty && <span>{r.counterparty}</span>}
                        {r.counterparty && <span>·</span>}
                        <span>{entityNames[r.entity_id] || r.entity_id}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <Calendar size={11} />
                        <span>
                          Vence {formatDate(r.due_date)} ({Math.round(r.days_from_today)}d)
                        </span>
                      </div>
                    </div>
                    <p className="font-mono font-semibold text-green-700 shrink-0">
                      + {formatCurrency(r.amount, r.currency)}
                    </p>
                  </div>
                </div>
              ))}
              {!isEntrada && sortedOccurrences.map((o, idx) => (
                <div key={`${o.debt_id}-${idx}`} className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{o.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 flex-wrap">
                        {o.creditor && <span>{o.creditor}</span>}
                        {o.creditor && <span>·</span>}
                        <span>{entityNames[o.entity_id] || o.entity_id}</span>
                        {o.kind === "recorrente" && (
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px]">
                            Recorrente
                          </span>
                        )}
                        {o.kind === "emprestimo_parcela" && (
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                            Parcela {o.occurrence_index}/{o.total_occurrences}
                          </span>
                        )}
                        {o.kind === "aporte_juros" && (
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                            Juros aporte
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <Calendar size={11} />
                        <span>
                          Vence {formatDate(o.payment_date)} ({Math.round(o.days_from_today)}d)
                        </span>
                      </div>
                    </div>
                    <p className="font-mono font-semibold text-red-700 shrink-0">
                      - {formatCurrency(o.amount, o.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

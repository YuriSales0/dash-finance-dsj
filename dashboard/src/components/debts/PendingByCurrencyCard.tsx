"use client";

import { useState } from "react";
import { CreditCard, X, Calendar } from "lucide-react";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import type { Debt } from "@/types/database";

interface Props {
  debts: Debt[];
  pendingByCurrency: Record<string, number>;
  next30ByCurrency: Record<string, number>;
}

export function PendingByCurrencyCard({ debts, pendingByCurrency, next30ByCurrency }: Props) {
  const [openCurrency, setOpenCurrency] = useState<string | null>(null);

  function debtsForCurrency(cur: string): Array<{ debt: Debt; remaining: number }> {
    const list: Array<{ debt: Debt; remaining: number }> = [];
    for (const d of debts) {
      if (d.currency !== cur) continue;
      if (d.status !== "pending" && d.status !== "partial") continue;
      const remaining = d.amount_total - d.amount_paid;
      if (remaining <= 0) continue;
      list.push({ debt: d, remaining });
    }
    list.sort((a, b) => new Date(a.debt.due_date).getTime() - new Date(b.debt.due_date).getTime());
    return list;
  }

  return (
    <>
      <div className="card card-body">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-50 rounded-lg"><CreditCard className="text-red-600" size={20} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">A pagar</p>
            {Object.entries(pendingByCurrency).length === 0 ? (
              <p className="text-xl font-bold">$0.00</p>
            ) : (
              Object.entries(pendingByCurrency).map(([cur, val]) => (
                <div key={cur} className="mb-1 last:mb-0">
                  <button
                    onClick={() => setOpenCurrency(cur)}
                    className="text-lg font-bold text-slate-900 hover:text-brand-600 hover:underline transition text-left"
                    title="Clique para ver o detalhe"
                  >
                    {formatCurrency(val, cur)}
                  </button>
                  <p className="text-[10px] text-slate-400">obrigacoes imediatas (35 dias)</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalhe */}
      {openCurrency && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpenCurrency(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h3 className="font-semibold">A pagar em {openCurrency}</h3>
                <p className="text-sm text-slate-500">
                  Total: <strong>{formatCurrency(pendingByCurrency[openCurrency] || 0, openCurrency)}</strong>
                </p>
              </div>
              <button
                onClick={() => setOpenCurrency(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {debtsForCurrency(openCurrency).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Nenhuma dívida pendente</p>
              ) : (
                debtsForCurrency(openCurrency).map(({ debt, remaining }) => {
                  const isOverdue = new Date(debt.due_date) < new Date();
                  return (
                    <div
                      key={debt.id}
                      className={`border rounded-lg p-3 ${
                        isOverdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{debt.description}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                            {debt.creditor && <span>{debt.creditor}</span>}
                            {debt.creditor && <span>·</span>}
                            <span>{entityNames[debt.entity_id] || debt.entity_id}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                            <Calendar size={11} />
                            <span className={isOverdue ? "text-red-700 font-medium" : ""}>
                              {isOverdue ? "Atrasado: " : "Vence "}
                              {formatDate(debt.due_date)}
                            </span>
                          </div>
                          {debt.is_recurring && (
                            <span className="inline-block mt-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                              {debt.recurrence_interval === "weekly" ? "Semanal" :
                               debt.recurrence_interval === "biweekly" ? "Quinzenal" :
                               debt.recurrence_interval === "monthly" ? "Mensal" :
                               debt.recurrence_interval === "quarterly" ? "Trimestral" :
                               debt.recurrence_interval === "yearly" ? "Anual" : "Recorrente"}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-semibold">
                            {formatCurrency(remaining, debt.currency)}
                          </p>
                          {debt.amount_paid > 0 && (
                            <p className="text-[10px] text-slate-500">
                              de {formatCurrency(debt.amount_total, debt.currency)}
                            </p>
                          )}
                          {debt.status === "partial" && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                              Parcial
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

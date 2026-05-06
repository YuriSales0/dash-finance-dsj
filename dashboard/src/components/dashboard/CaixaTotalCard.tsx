"use client";

import { useState } from "react";
import { Wallet, X, Calendar, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import type { Receivable, Debt } from "@/types/database";
import type { DebtOccurrence } from "@/components/debts/TermCardWithDetails";

interface Props {
  balanceByCurrency: Record<string, number>;
  receivables: Receivable[];
  debts: Debt[];
  // Ocorrencias imediatas (atrasadas + curto prazo) ja calculadas no servidor
  immediateOccurrences: DebtOccurrence[];
}

const CURRENCY_ORDER = ["USD", "GBP", "EUR", "BRL"];

export function CaixaTotalCard({
  balanceByCurrency,
  receivables,
  debts,
  immediateOccurrences,
}: Props) {
  const [openReceivablesCurrency, setOpenReceivablesCurrency] = useState<string | null>(null);
  const [openDebtsCurrency, setOpenDebtsCurrency] = useState<string | null>(null);

  // Recebiveis pendentes por moeda (saldo restante)
  const receivablesByCurrency: Record<string, number> = {};
  for (const r of receivables) {
    if (r.status === "paid" || !r.currency) continue;
    const remaining = r.amount_total - r.amount_received;
    if (remaining <= 0) continue;
    receivablesByCurrency[r.currency] = (receivablesByCurrency[r.currency] || 0) + remaining;
  }

  // Dividas IMEDIATAS por moeda (atrasadas + curto prazo, alinhado com /admin/debts)
  const debtsByCurrency: Record<string, number> = {};
  for (const o of immediateOccurrences) {
    debtsByCurrency[o.currency] = (debtsByCurrency[o.currency] || 0) + o.amount;
  }

  const allCurrencies = Array.from(
    new Set([
      ...Object.keys(balanceByCurrency),
      ...Object.keys(receivablesByCurrency),
      ...Object.keys(debtsByCurrency),
    ])
  )
    .filter((c) => c)
    .sort((a, b) => {
      const ai = CURRENCY_ORDER.indexOf(a);
      const bi = CURRENCY_ORDER.indexOf(b);
      const ax = ai === -1 ? 99 : ai;
      const bx = bi === -1 ? 99 : bi;
      return ax !== bx ? ax - bx : a.localeCompare(b);
    });

  function receivablesForCurrency(cur: string) {
    return receivables
      .filter((r) => r.status !== "paid" && r.currency === cur)
      .map((r) => ({ r, remaining: r.amount_total - r.amount_received }))
      .filter((x) => x.remaining > 0)
      .sort((a, b) => new Date(a.r.due_date).getTime() - new Date(b.r.due_date).getTime());
  }

  function occurrencesForCurrency(cur: string) {
    return immediateOccurrences
      .filter((o) => o.currency === cur)
      .sort((a, b) => a.days_from_today - b.days_from_today);
  }

  return (
    <>
      <div className="card card-body bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-brand-50 rounded-lg">
            <Wallet size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Caixa Total</p>
            <p className="text-xs text-slate-500">
              Saldos bancarios + recebiveis em aberto - dividas imediatas (atrasadas + ≤35d), por moeda
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {allCurrencies.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma conta com saldo</p>
          ) : (
            allCurrencies.map((currency) => {
              const bal = balanceByCurrency[currency] || 0;
              const recv = receivablesByCurrency[currency] || 0;
              const debt = debtsByCurrency[currency] || 0;
              return (
                <div key={currency} className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                      {currency}
                    </span>
                  </div>
                  <p className={`text-xl font-bold ${bal >= 0 ? "text-slate-900" : "text-red-600"}`}>
                    {formatCurrency(bal, currency)}
                  </p>
                  <div className="mt-1.5 space-y-0.5 text-[11px]">
                    {recv > 0 && (
                      <button
                        onClick={() => setOpenReceivablesCurrency(currency)}
                        className="text-green-600 hover:text-green-800 hover:underline transition cursor-pointer text-left block"
                        title="Clique pra ver detalhamento"
                      >
                        + {formatCurrency(recv, currency)} a receber
                      </button>
                    )}
                    {debt > 0 && (
                      <button
                        onClick={() => setOpenDebtsCurrency(currency)}
                        className="text-red-600 hover:text-red-800 hover:underline transition cursor-pointer text-left block"
                        title="Clique pra ver detalhamento"
                      >
                        - {formatCurrency(debt, currency)} a pagar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: detalhe de recebiveis */}
      {openReceivablesCurrency && (
        <DetailModal
          title={`A receber em ${openReceivablesCurrency}`}
          subtitle="Recebiveis em aberto, ordenados por vencimento"
          total={receivablesByCurrency[openReceivablesCurrency] || 0}
          currency={openReceivablesCurrency}
          color="green"
          onClose={() => setOpenReceivablesCurrency(null)}
        >
          {receivablesForCurrency(openReceivablesCurrency).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhum recebível pendente</p>
          ) : (
            receivablesForCurrency(openReceivablesCurrency).map(({ r, remaining }) => {
              const isOverdue = new Date(r.due_date) < new Date();
              return (
                <div
                  key={r.id}
                  className={`border rounded-lg p-3 ${
                    isOverdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
                  }`}
                >
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
                        <span className={isOverdue ? "text-red-700 font-medium" : ""}>
                          {isOverdue ? "Atrasado: " : "Vence "}
                          {formatDate(r.due_date)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-semibold">{formatCurrency(remaining, r.currency)}</p>
                      {r.amount_received > 0 && (
                        <p className="text-[10px] text-slate-500">
                          de {formatCurrency(r.amount_total, r.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div className="mt-3 text-[10px] text-slate-500 italic">
            Soma de (amount_total - amount_received) de todos os recebiveis nao pagos com saldo &gt; 0.
          </div>
        </DetailModal>
      )}

      {/* Modal: detalhe de dividas imediatas */}
      {openDebtsCurrency && (
        <DetailModal
          title={`A pagar em ${openDebtsCurrency}`}
          subtitle="Obrigacoes imediatas (atrasadas + ≤ 35 dias)"
          total={debtsByCurrency[openDebtsCurrency] || 0}
          currency={openDebtsCurrency}
          color="red"
          onClose={() => setOpenDebtsCurrency(null)}
        >
          {occurrencesForCurrency(openDebtsCurrency).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhuma dívida imediata</p>
          ) : (
            occurrencesForCurrency(openDebtsCurrency).map((o, idx) => {
              const isOverdue = o.days_from_today < 0;
              return (
                <div
                  key={`${o.debt_id}-${idx}`}
                  className={`border rounded-lg p-3 ${
                    isOverdue ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
                  }`}
                >
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
                        <span className={isOverdue ? "text-red-700 font-medium" : ""}>
                          {isOverdue ? "Atrasada: " : "Vence "}
                          {formatDate(o.payment_date)}
                          {" "}({Math.round(o.days_from_today)}d)
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-semibold">{formatCurrency(o.amount, o.currency)}</p>
                      {o.partial_paid_on_this > 0 && (
                        <p className="text-[10px] text-blue-600">
                          {formatCurrency(o.partial_paid_on_this, o.currency)} ja pago
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div className="mt-3 text-[10px] text-slate-500 italic">
            Soma do saldo restante das ocorrencias atrasadas + ≤35 dias (mesma logica do card "A pagar
            (imediato)" em /admin/debts). Recorrentes com parcelas futuras alem de 35 dias nao entram
            aqui — veja medio/longo prazo na pagina de dividas.
          </div>
        </DetailModal>
      )}
    </>
  );
}

interface DetailModalProps {
  title: string;
  subtitle: string;
  total: number;
  currency: string;
  color: "green" | "red";
  onClose: () => void;
  children: React.ReactNode;
}

function DetailModal({
  title,
  subtitle,
  total,
  currency,
  color,
  onClose,
  children,
}: DetailModalProps) {
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
            <div className="flex items-center gap-2">
              {color === "green" ? (
                <ArrowUpRight size={16} className="text-green-600" />
              ) : (
                <ArrowDownRight size={16} className="text-red-600" />
              )}
              <h3 className="font-semibold">{title}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            <p className={`text-xl font-bold mt-1 ${color === "green" ? "text-green-700" : "text-red-700"}`}>
              {formatCurrency(total, currency)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">{children}</div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, X, Check, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";

export interface DebtOccurrence {
  debt_id: number;
  description: string;
  creditor: string | null;
  entity_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  days_from_today: number;
  kind: "pontual" | "recorrente" | "aporte_juros" | "aporte_balloon" | "emprestimo_parcela";
  occurrence_index?: number;
  total_occurrences?: number;
  per_occurrence_amount: number;
  amount_paid: number;
  amount_total: number;
  // Flag: e a proxima ocorrencia cronologica nao paga desta divida?
  // Mark paid so e habilitado nesta — pra evitar confusao com out-of-order.
  is_next_unpaid: boolean;
  // Recorrente sem end_date nunca vira "paid", so "partial".
  is_perpetual_recurring: boolean;
}

interface Props {
  label: string;
  sublabel: string;
  color: "amber" | "blue" | "slate" | "red";
  occurrences: DebtOccurrence[];
}

const TERM_COLORS: Record<string, { bg: string; icon: string; text: string }> = {
  amber: { bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-700" },
  blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-700" },
  slate: { bg: "bg-slate-100", icon: "text-slate-500", text: "text-slate-700" },
  red: { bg: "bg-red-50", icon: "text-red-600", text: "text-red-700" },
};

const KIND_LABEL: Record<DebtOccurrence["kind"], string> = {
  pontual: "Pontual",
  recorrente: "Recorrente",
  aporte_juros: "Juros (aporte)",
  aporte_balloon: "Principal (aporte)",
  emprestimo_parcela: "Parcela",
};

export function TermCardWithDetails({ label, sublabel, color, occurrences }: Props) {
  const [open, setOpen] = useState(false);

  const c = TERM_COLORS[color] || TERM_COLORS.slate;

  // Totais por moeda
  const totals: Record<string, number> = {};
  for (const o of occurrences) {
    totals[o.currency] = (totals[o.currency] || 0) + o.amount;
  }
  const entries = Object.entries(totals);

  return (
    <>
      <button
        onClick={() => entries.length > 0 && setOpen(true)}
        disabled={entries.length === 0}
        className="card card-body text-left hover:shadow-md transition disabled:cursor-default disabled:hover:shadow-none w-full"
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${c.bg}`}>
            <Calendar className={c.icon} size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-[10px] text-slate-400">{sublabel}</p>
            {entries.length === 0 ? (
              <p className="text-lg font-bold text-slate-300 mt-0.5">—</p>
            ) : (
              <>
                {entries.map(([cur, val]) => (
                  <p key={cur} className={`text-lg font-bold mt-0.5 ${c.text} hover:underline`}>
                    {formatCurrency(val, cur)}
                  </p>
                ))}
                <p className="text-[10px] text-slate-400 mt-1">
                  {occurrences.length} {occurrences.length === 1 ? "obrigacao" : "obrigacoes"} · clique pra detalhar
                </p>
              </>
            )}
          </div>
        </div>
      </button>

      {open && (
        <DetailModal
          label={label}
          sublabel={sublabel}
          totals={totals}
          occurrences={occurrences}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface DetailModalProps {
  label: string;
  sublabel: string;
  totals: Record<string, number>;
  occurrences: DebtOccurrence[];
  onClose: () => void;
}

function DetailModal({ label, sublabel, totals, occurrences, onClose }: DetailModalProps) {
  const router = useRouter();
  const [filterCurrency, setFilterCurrency] = useState<string | null>(null);
  const [marking, setMarking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currencies = Object.keys(totals);
  const filtered = occurrences
    .filter((o) => !filterCurrency || o.currency === filterCurrency)
    .sort((a, b) => a.days_from_today - b.days_from_today);

  async function markPaid(occ: DebtOccurrence) {
    setMarking(occ.debt_id);
    setError(null);
    setSuccess(null);
    const newAmountPaid = Math.round((occ.amount_paid + occ.per_occurrence_amount) * 100) / 100;
    // Recorrente perpetua nunca vira "paid" (sempre tem proxima ocorrencia)
    const wouldBePaid = newAmountPaid >= occ.amount_total && !occ.is_perpetual_recurring;
    const newStatus = wouldBePaid ? "paid" : "partial";
    const res = await fetch("/api/debts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: occ.debt_id,
        amount_paid: newAmountPaid,
        status: newStatus,
      }),
    });
    setMarking(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro" }));
      setError(data.error || `Erro ${res.status}`);
      return;
    }
    setSuccess(`Marcado: ${formatCurrency(occ.per_occurrence_amount, occ.currency)} pago em "${occ.description}"`);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold">{label}</h3>
            <p className="text-xs text-slate-500">{sublabel} · {occurrences.length} obrigacao(oes)</p>
            <div className="mt-2 flex gap-3 flex-wrap">
              {Object.entries(totals).map(([cur, val]) => (
                <span key={cur} className="text-sm font-mono">
                  <span className="text-xs font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded mr-1">
                    {cur}
                  </span>
                  <strong>{formatCurrency(val, cur)}</strong>
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </button>
        </div>

        {currencies.length > 1 && (
          <div className="px-4 py-2 border-b border-slate-100 flex gap-1 flex-wrap">
            <button
              onClick={() => setFilterCurrency(null)}
              className={`px-3 py-1 text-xs rounded-full ${
                filterCurrency === null
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todas
            </button>
            {currencies.map((cur) => (
              <button
                key={cur}
                onClick={() => setFilterCurrency(cur)}
                className={`px-3 py-1 text-xs rounded-full ${
                  filterCurrency === cur
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mx-4 mt-2 bg-red-50 text-red-700 rounded p-2 text-xs flex justify-between gap-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X size={12} />
            </button>
          </div>
        )}

        {success && (
          <div className="mx-4 mt-2 bg-green-50 text-green-800 rounded p-2 text-xs flex justify-between gap-2">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-700 hover:text-green-900">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhuma obrigacao</p>
          ) : (
            filtered.map((o, idx) => {
              const isOverdue = o.days_from_today < 0;
              // So permitir marcar pago na PROXIMA cronologica nao paga (evita
              // confusao com out-of-order — clicar na 5a parcela ignoraria as 1-4)
              const canMarkPaid =
                (o.kind === "recorrente" ||
                  o.kind === "emprestimo_parcela" ||
                  o.kind === "aporte_juros") &&
                o.is_next_unpaid;
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
                        <span>·</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                          {KIND_LABEL[o.kind]}
                          {o.occurrence_index && o.total_occurrences
                            ? ` ${o.occurrence_index}/${o.total_occurrences}`
                            : ""}
                        </span>
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
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="font-mono font-semibold">
                        {formatCurrency(o.amount, o.currency)}
                      </p>
                      {canMarkPaid && (
                        <button
                          onClick={() => markPaid(o)}
                          disabled={marking === o.debt_id}
                          className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                          title={`Marca esta ocorrencia como paga (incrementa amount_paid em ${formatCurrency(o.per_occurrence_amount, o.currency)})`}
                        >
                          {marking === o.debt_id ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Check size={10} />
                          )}
                          Marcar pago
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500">
          <strong>Marcar pago:</strong> incrementa amount_paid no valor da ocorrencia.
          A proxima ocorrencia recorrente continua aparecendo em meses subsequentes.
          Quando o CSV for importado e a transacao real for classificada, a reconciliacao
          confirma o pagamento.
        </div>
      </div>
    </div>
  );
}

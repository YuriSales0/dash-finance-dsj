"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Receivable } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { Edit3, Loader2, X, Save, AlertTriangle, Trash2 } from "lucide-react";

interface Props {
  receivables: Receivable[];
}

export function ReceivablesTable({ receivables }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Receivable | null>(null);
  const [form, setForm] = useState({
    amount_total: "",
    amount_received: "",
    status: "pending",
    chargeback_amount: "",
    refund_amount: "",
    notes: "",
    open_for_financing: false,
    financing_interest_rate_pct: "",
    financing_min_amount: "",
    financing_max_amount: "",
    financing_redemption_days: "",
    financing_terms: "",
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(r: Receivable) {
    setEditing(r);
    setForm({
      amount_total: r.amount_total.toString(),
      amount_received: r.amount_received.toString(),
      status: r.status,
      chargeback_amount: "",
      refund_amount: "",
      notes: r.notes || "",
      open_for_financing: !!r.open_for_financing,
      financing_interest_rate_pct: r.financing_interest_rate_pct != null ? String(r.financing_interest_rate_pct) : "",
      financing_min_amount: r.financing_min_amount != null ? String(r.financing_min_amount) : "",
      financing_max_amount: r.financing_max_amount != null ? String(r.financing_max_amount) : "",
      financing_redemption_days: r.financing_redemption_days != null ? String(r.financing_redemption_days) : "",
      financing_terms: r.financing_terms || "",
    });
    setError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setLoading(true);
    setError(null);

    // L20: preservar financing_* mesmo se toggle off — facilita reativar depois
    // sem perder a config (taxa, min, max, prazo, termos). open_for_financing
    // e o flag que controla visibilidade ao investidor.
    const updates: any = {
      id: editing.id,
      amount_total: Number(form.amount_total),
      amount_received: Number(form.amount_received),
      status: form.status,
      notes: form.notes || null,
      open_for_financing: form.open_for_financing,
      financing_interest_rate_pct: form.financing_interest_rate_pct
        ? Number(form.financing_interest_rate_pct) : null,
      financing_min_amount: form.financing_min_amount
        ? Number(form.financing_min_amount) : null,
      financing_max_amount: form.financing_max_amount
        ? Number(form.financing_max_amount) : null,
      financing_redemption_days: form.financing_redemption_days
        ? Number(form.financing_redemption_days) : null,
      financing_terms: form.financing_terms || null,
    };

    // Se ouve chargeback ou reembolso, deduzir do amount_total
    const cb = Number(form.chargeback_amount) || 0;
    const rf = Number(form.refund_amount) || 0;
    if (cb > 0 || rf > 0) {
      updates.amount_total = Number(form.amount_total) - cb - rf;
      const noteAddition = `${editing.notes ? editing.notes + "\n" : ""}${new Date().toISOString().slice(0, 10)}: ${cb > 0 ? `chargeback ${formatCurrency(cb, editing.currency)}` : ""}${cb > 0 && rf > 0 ? ", " : ""}${rf > 0 ? `reembolso ${formatCurrency(rf, editing.currency)}` : ""}`;
      updates.notes = noteAddition;
    }

    const res = await fetch("/api/receivables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erro");
      return;
    }

    setEditing(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!editing) return;
    if (!confirm(`Deletar o recebivel "${editing.description}"? Esta acao nao pode ser desfeita.`)) return;
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/receivables", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id }),
    });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro" }));
      setError(data.error || `Erro ${res.status}`);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="card-header"><h3 className="font-semibold">Recebiveis</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Descricao</th>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Empresa</th>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Vencimento</th>
              <th className="text-right py-2 px-4 font-medium text-slate-500">Total</th>
              <th className="text-right py-2 px-4 font-medium text-slate-500">Recebido</th>
              <th className="text-right py-2 px-4 font-medium text-slate-500">Captado</th>
              <th className="text-center py-2 px-4 font-medium text-slate-500">Status</th>
              <th className="text-right py-2 px-4 font-medium text-slate-500">Acao</th>
            </tr>
          </thead>
          <tbody>
            {receivables.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-400">Nenhum recebivel</td></tr>
            ) : receivables.map((r) => {
              const remaining = r.amount_total - r.amount_received;
              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-3 px-4">
                    <div className="font-medium">{r.description}</div>
                    <div className="text-xs text-slate-500">{r.counterparty}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">{entityNames[r.entity_id]}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{formatDate(r.due_date)}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(r.amount_total, r.currency)}</td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatCurrency(r.amount_received, r.currency)}
                    {remaining > 0 && (
                      <div className="text-xs text-slate-500">
                        falta {formatCurrency(remaining, r.currency)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    {r.open_for_financing
                      ? <span className="text-brand-600">{formatCurrency(r.financing_raised || 0, r.currency)}</span>
                      : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={
                      r.status === "paid" ? "success" :
                      r.status === "overdue" || r.status === "defaulted" ? "danger" :
                      r.open_for_financing ? "info" : "neutral"
                    }>
                      {r.status === "paid" ? "Pago" :
                       r.status === "overdue" ? "Atrasado" :
                       r.status === "defaulted" ? "Default" :
                       r.status === "partial" ? "Parcial" :
                       r.open_for_financing ? "Aberto" : "Pendente"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-brand-600 hover:underline text-xs inline-flex items-center gap-1"
                    >
                      <Edit3 size={12} />
                      {r.status === "paid" ? "Editar" : "Atualizar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de edicao */}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={`Atualizar recebivel #${editing.id}`}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
              <div><strong>{editing.description}</strong></div>
              <div className="text-slate-500">{editing.counterparty} - venc. {formatDate(editing.due_date)}</div>
            </div>

            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-900">
              <p className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Use os campos de chargeback/reembolso para reduzir o valor total automaticamente.
                Isso preserva o historico de ajustes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valor total ({editing.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-sm"
                  value={form.amount_total}
                  onChange={(e) => setForm({ ...form, amount_total: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Ja recebido ({editing.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-sm"
                  value={form.amount_received}
                  onChange={(e) => setForm({ ...form, amount_received: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Chargeback (deduzir)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-sm"
                  value={form.chargeback_amount}
                  onChange={(e) => setForm({ ...form, chargeback_amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reembolso (deduzir)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input text-sm"
                  value={form.refund_amount}
                  onChange={(e) => setForm({ ...form, refund_amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  className="input text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="pending">Pendente</option>
                  <option value="partial">Parcial</option>
                  <option value="paid">Pago integralmente</option>
                  <option value="overdue">Atrasado</option>
                  <option value="defaulted">Default (nao vai pagar)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Notas</label>
                <textarea
                  className="input text-sm"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ex: Chargeback de cliente X em 15/04"
                />
              </div>
            </div>

            {/* Financiamento por investidores (SCP) */}
            <div className="border-t pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.open_for_financing}
                  onChange={(e) => setForm({ ...form, open_for_financing: e.target.checked })}
                  className="rounded"
                />
                <span className="font-medium text-sm">
                  Abrir para financiamento por investidores (SCP)
                </span>
              </label>
              {form.open_for_financing && (
                <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Taxa de juros (% no periodo)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input text-sm"
                      value={form.financing_interest_rate_pct}
                      onChange={(e) =>
                        setForm({ ...form, financing_interest_rate_pct: e.target.value })
                      }
                      placeholder="Ex: 3"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Periodo (dias para resgate)
                    </label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={form.financing_redemption_days}
                      onChange={(e) =>
                        setForm({ ...form, financing_redemption_days: e.target.value })
                      }
                      placeholder="Ex: 30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Minimo por investidor
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input text-sm"
                      value={form.financing_min_amount}
                      onChange={(e) =>
                        setForm({ ...form, financing_min_amount: e.target.value })
                      }
                      placeholder="Ex: 1000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Maximo por investidor (opcional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input text-sm"
                      value={form.financing_max_amount}
                      onChange={(e) =>
                        setForm({ ...form, financing_max_amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Termos visiveis para o investidor
                    </label>
                    <textarea
                      className="input text-sm"
                      rows={2}
                      value={form.financing_terms}
                      onChange={(e) => setForm({ ...form, financing_terms: e.target.value })}
                      placeholder="Ex: Antecipacao de payout Shopify ja capturado em 15/04..."
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 rounded p-2 text-xs flex items-center gap-2">
                <AlertTriangle size={12} />
                {error}
              </div>
            )}

            <div className="flex justify-between gap-2">
              <button
                onClick={handleDelete}
                disabled={loading || deleting}
                className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded transition disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Deletar
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="btn-secondary inline-flex items-center gap-1">
                  <X size={14} /> Cancelar
                </button>
                <button onClick={handleSave} disabled={loading || deleting} className="btn-primary inline-flex items-center gap-2">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

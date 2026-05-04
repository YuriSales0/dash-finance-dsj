"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import type { Debt } from "@/types/database";

interface EntityOption {
  id: string;
  name: string;
  currency_default: string;
}

const DEBT_CATEGORIES = [
  { value: "", label: "Selecione..." },
  { value: "aporte_investidor", label: "Aporte de investidor (SCP)" },
  { value: "emprestimo", label: "Emprestimo / financiamento" },
  { value: "cost_products", label: "Produtos / fornecedores" },
  { value: "cost_team", label: "Equipe / salarios" },
  { value: "cost_saas", label: "SaaS / ferramentas" },
  { value: "cost_infra", label: "Infraestrutura" },
  { value: "cost_legal", label: "Legal / contabil / tributos" },
  { value: "cost_office", label: "Escritorio" },
  { value: "cost_ads_meta", label: "Meta Ads" },
  { value: "cost_ads_tiktok", label: "TikTok Ads" },
  { value: "cost_ads_google", label: "Google Ads" },
  { value: "outros", label: "Outros" },
];

interface Props {
  entities: EntityOption[];
  editDebt?: Debt | null;       // se passado, vira modo edicao
  onClose?: () => void;          // callback de fechamento (modo edicao)
  forceOpen?: boolean;           // forcar form aberto (usado em modo edicao)
}

export function DebtForm({ entities, editDebt = null, onClose, forceOpen = false }: Props) {
  const router = useRouter();
  const isEdit = !!editDebt;
  const [open, setOpen] = useState(forceOpen || isEdit);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultEntity = entities[0]?.id || "";
  const defaultCurrency = entities[0]?.currency_default || "USD";

  const [form, setForm] = useState({
    entity_id: editDebt?.entity_id || defaultEntity,
    description: editDebt?.description || "",
    creditor: editDebt?.creditor || "",
    amount_total: editDebt ? String(editDebt.amount_total) : "",
    amount_paid: editDebt ? String(editDebt.amount_paid) : "0",
    currency: editDebt?.currency || defaultCurrency,
    issue_date: editDebt?.issue_date || new Date().toISOString().slice(0, 10),
    due_date: editDebt?.due_date || "",
    interest_rate_pct: editDebt?.interest_rate_pct != null ? String(editDebt.interest_rate_pct) : "0",
    fixed_commission: editDebt?.fixed_commission != null ? String(editDebt.fixed_commission) : "0",
    iof_pct: editDebt?.iof_pct != null ? String(editDebt.iof_pct) : "0",
    is_recurring: !!editDebt?.is_recurring,
    recurrence_interval: (editDebt?.recurrence_interval || "monthly") as string,
    recurrence_end_date: editDebt?.recurrence_end_date || "",
    pays_interest_in_installments: !!editDebt?.interest_payment_interval,
    interest_payment_interval: (editDebt?.interest_payment_interval || "monthly") as string,
    category: editDebt?.category || "",
    status: editDebt?.status || "pending",
    notes: editDebt?.notes || "",
  });

  const isAporte = form.category === "aporte_investidor";
  const showCommission = isAporte || form.is_recurring;
  const principal = Number(form.amount_total) || 0;
  const ratePct = Number(form.interest_rate_pct) || 0;
  const commission = Number(form.fixed_commission) || 0;
  const iofPct = Number(form.iof_pct) || 0;
  const iofAmount = principal * iofPct / 100;
  const totalReturn = isAporte && principal > 0
    ? principal * (1 + ratePct / 100) + commission + iofAmount
    : null;
  const recurringTotal = form.is_recurring && principal > 0
    ? principal + commission
    : null;
  // Plano de pagamento de juros parcelado (interest-only com balloon)
  const installmentInterest = isAporte && form.pays_interest_in_installments && principal > 0
    ? principal * ratePct / 100
    : 0;
  // Numero de parcelas entre issue_date e due_date
  function calcInstallmentCount(): number {
    if (!installmentInterest || !form.issue_date || !form.due_date) return 0;
    const start = new Date(form.issue_date);
    const end = new Date(form.due_date);
    if (end <= start) return 0;
    const days = (end.getTime() - start.getTime()) / 86400000;
    const intervalDays =
      form.interest_payment_interval === "weekly" ? 7 :
      form.interest_payment_interval === "biweekly" ? 14 :
      form.interest_payment_interval === "monthly" ? 30 :
      form.interest_payment_interval === "quarterly" ? 90 :
      365;
    return Math.floor(days / intervalDays);
  }
  const installmentCount = calcInstallmentCount();
  const intervalLabel =
    form.interest_payment_interval === "weekly" ? "semana" :
    form.interest_payment_interval === "biweekly" ? "quinzena" :
    form.interest_payment_interval === "monthly" ? "mes" :
    form.interest_payment_interval === "quarterly" ? "trimestre" : "ano";

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "entity_id") {
        const ent = entities.find((e) => e.id === value);
        if (ent) next.currency = ent.currency_default;
      }
      if (key === "category" && value === "aporte_investidor") {
        const commerce = entities.find((e) => e.name.toLowerCase().includes("commerce"));
        if (commerce) {
          next.entity_id = commerce.id;
          next.currency = commerce.currency_default;
        }
      }
      return next;
    });
  }

  function close() {
    setOpen(false);
    setError(null);
    if (onClose) onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: any = {
      entity_id: form.entity_id,
      description: form.description,
      creditor: form.creditor || null,
      amount_total: Number(form.amount_total),
      currency: form.currency,
      issue_date: form.issue_date,
      due_date: form.due_date,
      interest_rate_pct: Number(form.interest_rate_pct),
      fixed_commission: Number(form.fixed_commission) || 0,
      iof_pct: Number(form.iof_pct) || 0,
      is_recurring: form.is_recurring,
      recurrence_interval: form.is_recurring ? form.recurrence_interval : null,
      recurrence_end_date: form.is_recurring && form.recurrence_end_date ? form.recurrence_end_date : null,
      interest_payment_interval: isAporte && form.pays_interest_in_installments ? form.interest_payment_interval : null,
      category: form.category || null,
      notes: form.notes || null,
    };

    if (isEdit) {
      payload.id = editDebt!.id;
      payload.amount_paid = Number(form.amount_paid) || 0;
      payload.status = form.status;
    }

    const res = await fetch("/api/debts", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
      setError(data.error || `Erro ${res.status}`);
      return;
    }

    if (!isEdit) {
      setForm((f) => ({ ...f, description: "", creditor: "", amount_total: "", due_date: "", notes: "", category: "" }));
    }
    close();
    router.refresh();
  }

  async function handleDelete() {
    if (!editDebt) return;
    if (!confirm(`Deletar a divida "${editDebt.description}"? Esta acao nao pode ser desfeita.`)) return;
    setDeleting(true);
    setError(null);

    const res = await fetch("/api/debts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editDebt.id }),
    });

    setDeleting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro" }));
      setError(data.error || `Erro ${res.status}`);
      return;
    }
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2">
        <Plus size={16} />
        Nova divida
      </button>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold">{isEdit ? "Editar divida" : "Nova divida"}</h3>
        <button onClick={close} className="text-slate-400 hover:text-slate-600 text-sm">Cancelar</button>
      </div>
      <form onSubmit={handleSubmit} className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Empresa">
          <select className="input" value={form.entity_id} onChange={(e) => update("entity_id", e.target.value)}>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>{ent.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Categoria">
          <select className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>
            {DEBT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Descricao" full>
          <input className="input" value={form.description} onChange={(e) => update("description", e.target.value)} required placeholder="Ex: Aporte investidor João - Rodada 1" />
        </Field>
        <Field label="Credor">
          <input className="input" value={form.creditor} onChange={(e) => update("creditor", e.target.value)} placeholder="Ex: João Silva" />
        </Field>
        <Field label="Moeda">
          <select className="input" value={form.currency} onChange={(e) => update("currency", e.target.value)}>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
            <option value="BRL">BRL</option>
          </select>
        </Field>
        <Field label="Valor total">
          <input type="number" step="0.01" className="input" value={form.amount_total} onChange={(e) => update("amount_total", e.target.value)} required />
        </Field>
        {isEdit && (
          <>
            <Field label="Valor ja pago">
              <input type="number" step="0.01" className="input" value={form.amount_paid} onChange={(e) => update("amount_paid", e.target.value)} />
            </Field>
            <Field label="Status">
              <select className="input" value={form.status} onChange={(e) => update("status", e.target.value as any)}>
                <option value="pending">Pendente</option>
                <option value="partial">Parcial</option>
                <option value="paid">Pago</option>
                <option value="overdue">Atrasado</option>
              </select>
            </Field>
          </>
        )}
        <Field label="Juros (% ao periodo)">
          <input type="number" step="0.01" className="input" value={form.interest_rate_pct} onChange={(e) => update("interest_rate_pct", e.target.value)} />
        </Field>
        {showCommission && (
          <Field label={isAporte ? "Comissao fixa" : "Comissao / bonus fixo"}>
            <input type="number" step="0.01" className="input" value={form.fixed_commission} onChange={(e) => update("fixed_commission", e.target.value)} placeholder={isAporte ? "Ex: 500" : "Ex: comissao mensal fixa"} />
          </Field>
        )}
        {isAporte && (
          <Field label="IOF (%)">
            <input type="number" step="0.0001" className="input" value={form.iof_pct} onChange={(e) => update("iof_pct", e.target.value)} placeholder="Ex: 0.38" />
          </Field>
        )}
        {isAporte && (
          <div className="md:col-span-2 flex items-center gap-3 py-1">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pays_interest_in_installments}
                onChange={(e) => update("pays_interest_in_installments", e.target.checked as any)}
                className="rounded"
              />
              Pagar juros em parcelas mensais ate o vencimento (principal + comissao no fim)
            </label>
          </div>
        )}
        {isAporte && form.pays_interest_in_installments && (
          <Field label="Frequencia das parcelas">
            <select className="input" value={form.interest_payment_interval} onChange={(e) => update("interest_payment_interval", e.target.value)}>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quinzenal</option>
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
          </Field>
        )}
        {isAporte && totalReturn !== null && Number(form.amount_total) > 0 && (
          <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-2">
            <p className="text-blue-900">
              <strong>Retorno total ao investidor:</strong>{" "}
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(totalReturn)}
            </p>
            <p className="text-xs text-blue-700">
              = {new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(Number(form.amount_total))} (aporte)
              {Number(form.interest_rate_pct) > 0 && <> + {form.interest_rate_pct}% juros</>}
              {Number(form.fixed_commission) > 0 && <> + {new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(Number(form.fixed_commission))} comissao</>}
              {iofAmount > 0 && <> + {new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(iofAmount)} IOF ({form.iof_pct}%)</>}
            </p>
            {form.pays_interest_in_installments && installmentInterest > 0 && installmentCount > 0 && (
              <div className="border-t border-blue-200 pt-2 text-xs text-blue-800 space-y-1">
                <p className="font-semibold">Plano de pagamento:</p>
                <p>
                  · {installmentCount} parcela(s) de{" "}
                  <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(installmentInterest)}</strong>{" "}
                  por {intervalLabel} (juros)
                </p>
                <p>
                  · No vencimento ({form.due_date || "—"}):{" "}
                  <strong>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(principal + commission)}
                  </strong>{" "}
                  (principal{commission > 0 ? " + comissao" : ""})
                </p>
              </div>
            )}
          </div>
        )}
        {!isAporte && form.is_recurring && recurringTotal !== null && recurringTotal > 0 && (
          <div className="md:col-span-2 bg-purple-50 border border-purple-200 rounded p-3 text-sm">
            <p className="text-purple-900">
              <strong>Custo por recorrencia:</strong>{" "}
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(recurringTotal)}
              {" / "}
              {form.recurrence_interval === "weekly" ? "semana" :
               form.recurrence_interval === "biweekly" ? "quinzena" :
               form.recurrence_interval === "monthly" ? "mes" :
               form.recurrence_interval === "quarterly" ? "trimestre" : "ano"}
            </p>
            {Number(form.fixed_commission) > 0 && (
              <p className="text-xs text-purple-700 mt-1">
                = {new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(Number(form.amount_total))} (base)
                {" + "}
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: form.currency }).format(Number(form.fixed_commission))} (comissao)
              </p>
            )}
          </div>
        )}
        <Field label="Data emissao">
          <input type="date" className="input" value={form.issue_date} onChange={(e) => update("issue_date", e.target.value)} required />
        </Field>
        <Field label="Data vencimento">
          <input type="date" className="input" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} required />
        </Field>
        <div className="md:col-span-2 flex items-center gap-3 py-1">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_recurring}
              onChange={(e) => update("is_recurring", e.target.checked as any)}
              className="rounded"
            />
            Divida recorrente (salario, assinatura, aluguel)
          </label>
        </div>
        {form.is_recurring && (
          <>
            <Field label="Frequencia">
              <select className="input" value={form.recurrence_interval} onChange={(e) => update("recurrence_interval", e.target.value)}>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </Field>
            <Field label="Ate quando? (vazio = indefinido)">
              <input type="date" className="input" value={form.recurrence_end_date} onChange={(e) => update("recurrence_end_date", e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Notas" full>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Observacoes opcionais..." />
        </Field>

        {error && (
          <div className="md:col-span-2 bg-red-50 text-red-700 rounded p-2 text-xs flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="md:col-span-2 flex items-center gap-2">
          <button type="submit" disabled={loading || deleting} className="btn-primary inline-flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Salvar alteracoes" : "Criar divida"}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || deleting}
              className="ml-auto inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded transition"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Deletar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertTriangle } from "lucide-react";

interface EntityOption {
  id: string;
  name: string;
  currency_default: string;
}

export function ReceivableForm({ entities }: { entities: EntityOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultEntity = entities[0]?.id || "";
  const defaultCurrency = entities[0]?.currency_default || "USD";

  const [form, setForm] = useState({
    entity_id: defaultEntity,
    description: "",
    counterparty: "",
    amount_total: "",
    currency: defaultCurrency,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    open_for_financing: false,
    financing_interest_rate_pct: "",
    financing_min_amount: "",
    financing_max_amount: "",
    financing_redemption_days: "",
    financing_terms: "",
    notes: "",
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "entity_id") {
        const ent = entities.find((e) => e.id === value);
        if (ent) next.currency = ent.currency_default;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      entity_id: form.entity_id,
      description: form.description,
      counterparty: form.counterparty || null,
      amount_total: Number(form.amount_total),
      currency: form.currency,
      issue_date: form.issue_date,
      due_date: form.due_date,
      open_for_financing: form.open_for_financing,
      financing_interest_rate_pct: form.open_for_financing ? Number(form.financing_interest_rate_pct) : null,
      financing_min_amount: form.open_for_financing ? Number(form.financing_min_amount) : null,
      financing_max_amount: form.open_for_financing && form.financing_max_amount ? Number(form.financing_max_amount) : null,
      financing_redemption_days: form.open_for_financing ? Number(form.financing_redemption_days) : null,
      financing_terms: form.open_for_financing ? form.financing_terms || null : null,
      notes: form.notes || null,
    };

    const res = await fetch("/api/receivables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Falha ao criar recebivel.");
      return;
    }

    setOpen(false);
    setForm((f) => ({ ...f, description: "", counterparty: "", amount_total: "", due_date: "", financing_terms: "" }));
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary inline-flex items-center gap-2">
        <Plus size={16} />
        Novo recebivel
      </button>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold">Novo recebivel</h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm">Cancelar</button>
      </div>
      <form onSubmit={handleSubmit} className="card-body space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Empresa">
            <select className="input" value={form.entity_id} onChange={(e) => update("entity_id", e.target.value)}>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>{ent.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Moeda">
            <select className="input" value={form.currency} onChange={(e) => update("currency", e.target.value)}>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          </Field>
          <Field label="Descricao" full>
            <input className="input" value={form.description} onChange={(e) => update("description", e.target.value)} required placeholder="Ex: Payout Shopify Mar/26" />
          </Field>
          <Field label="Contraparte (quem deve)">
            <input className="input" value={form.counterparty} onChange={(e) => update("counterparty", e.target.value)} placeholder="Ex: Shopify Payments" />
          </Field>
          <Field label="Valor total">
            <input type="number" step="0.01" className="input" value={form.amount_total} onChange={(e) => update("amount_total", e.target.value)} required />
          </Field>
          <Field label="Data emissao">
            <input type="date" className="input" value={form.issue_date} onChange={(e) => update("issue_date", e.target.value)} required />
          </Field>
          <Field label="Data vencimento">
            <input type="date" className="input" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} required />
          </Field>
        </div>

        <div className="border-t pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.open_for_financing}
              onChange={(e) => update("open_for_financing", e.target.checked)}
              className="rounded"
            />
            <span className="font-medium text-sm">Abrir para financiamento por investidores</span>
          </label>

          {form.open_for_financing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-slate-50 rounded-lg">
              <Field label="Taxa de juros (% no periodo)">
                <input type="number" step="0.01" className="input" value={form.financing_interest_rate_pct} onChange={(e) => update("financing_interest_rate_pct", e.target.value)} required={form.open_for_financing} />
              </Field>
              <Field label="Periodo (dias para resgate)">
                <input type="number" className="input" value={form.financing_redemption_days} onChange={(e) => update("financing_redemption_days", e.target.value)} required={form.open_for_financing} />
              </Field>
              <Field label="Valor minimo por investidor">
                <input type="number" step="0.01" className="input" value={form.financing_min_amount} onChange={(e) => update("financing_min_amount", e.target.value)} required={form.open_for_financing} />
              </Field>
              <Field label="Valor maximo (opcional)">
                <input type="number" step="0.01" className="input" value={form.financing_max_amount} onChange={(e) => update("financing_max_amount", e.target.value)} />
              </Field>
              <Field label="Termos visiveis para o investidor" full>
                <textarea className="input" rows={2} value={form.financing_terms} onChange={(e) => update("financing_terms", e.target.value)} placeholder="Ex: Antecipacao de payout Shopify ja capturado..." />
              </Field>
            </div>
          )}
        </div>

        <Field label="Notas internas" full>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
        </Field>

        {error && (
          <div className="bg-red-50 text-red-700 rounded p-2 text-xs flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary inline-flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Criar recebivel
          </button>
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, AlertTriangle } from "lucide-react";

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

export function DebtForm({ entities }: { entities: EntityOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultEntity = entities[0]?.id || "";
  const defaultCurrency = entities[0]?.currency_default || "USD";

  const [form, setForm] = useState({
    entity_id: defaultEntity,
    description: "",
    creditor: "",
    amount_total: "",
    currency: defaultCurrency,
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    interest_rate_pct: "0",
    category: "",
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
    setLoading(true);
    setError(null);

    const res = await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount_total: Number(form.amount_total),
        interest_rate_pct: Number(form.interest_rate_pct),
        creditor: form.creditor || null,
        category: form.category || null,
        notes: form.notes || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro desconhecido" }));
      setError(data.error || `Erro ${res.status}`);
      return;
    }

    setOpen(false);
    setError(null);
    setForm((f) => ({ ...f, description: "", creditor: "", amount_total: "", due_date: "", notes: "", category: "" }));
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
        <h3 className="font-semibold">Nova divida</h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-sm">Cancelar</button>
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
        <Field label="Juros (% ao periodo)">
          <input type="number" step="0.01" className="input" value={form.interest_rate_pct} onChange={(e) => update("interest_rate_pct", e.target.value)} />
        </Field>
        <Field label="Data emissao">
          <input type="date" className="input" value={form.issue_date} onChange={(e) => update("issue_date", e.target.value)} required />
        </Field>
        <Field label="Data vencimento">
          <input type="date" className="input" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} required />
        </Field>
        <Field label="Notas" full>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Observacoes opcionais..." />
        </Field>

        {error && (
          <div className="md:col-span-2 bg-red-50 text-red-700 rounded p-2 text-xs flex items-start gap-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="md:col-span-2">
          <button type="submit" disabled={loading} className="btn-primary inline-flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Criar divida
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function DebtForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    entity_id: "dsj_network",
    description: "",
    creditor: "",
    amount_total: "",
    currency: "USD",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    interest_rate_pct: "0",
    category: "",
    notes: "",
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch("/api/debts", {
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
    setOpen(false);
    setForm((f) => ({ ...f, description: "", creditor: "", amount_total: "", due_date: "", notes: "" }));
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
            <option value="dsj_network">DSJ Network LLC</option>
            <option value="universal_mkt">Universal MKT LLP</option>
            <option value="dsj_connect">DSJ Connect LLC</option>
          </select>
        </Field>
        <Field label="Categoria">
          <select className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>
            <option value="">Selecione...</option>
            <option value="cost_products">Produtos / fornecedores</option>
            <option value="cost_team">Equipe / salarios</option>
            <option value="cost_saas">SaaS / ferramentas</option>
            <option value="cost_infra">Infraestrutura</option>
            <option value="cost_legal">Legal / contabil / tributos</option>
            <option value="cost_office">Escritorio</option>
            <option value="cost_ads_meta">Meta Ads</option>
            <option value="cost_ads_tiktok">TikTok Ads</option>
            <option value="cost_ads_google">Google Ads</option>
          </select>
        </Field>
        <Field label="Descricao" full>
          <input className="input" value={form.description} onChange={(e) => update("description", e.target.value)} required placeholder="Ex: Fatura CJ Dropshipping Mar/26" />
        </Field>
        <Field label="Credor">
          <input className="input" value={form.creditor} onChange={(e) => update("creditor", e.target.value)} placeholder="Ex: CJ Dropshipping" />
        </Field>
        <Field label="Moeda">
          <select className="input" value={form.currency} onChange={(e) => update("currency", e.target.value)}>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="BRL">BRL</option>
          </select>
        </Field>
        <Field label="Valor total">
          <input type="number" step="0.01" className="input" value={form.amount_total} onChange={(e) => update("amount_total", e.target.value)} required />
        </Field>
        <Field label="Juros (%)">
          <input type="number" step="0.01" className="input" value={form.interest_rate_pct} onChange={(e) => update("interest_rate_pct", e.target.value)} />
        </Field>
        <Field label="Data emissao">
          <input type="date" className="input" value={form.issue_date} onChange={(e) => update("issue_date", e.target.value)} required />
        </Field>
        <Field label="Data vencimento">
          <input type="date" className="input" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} required />
        </Field>
        <Field label="Notas" full>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
        </Field>
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

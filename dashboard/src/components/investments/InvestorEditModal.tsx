"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Save, Trash2, Loader2, AlertTriangle, ShieldOff } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Investor {
  id: number;
  name: string;
  cpf: string;
  email: string;
  phone: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  status: string;
  total_invested?: number;
  total_returned?: number;
}

interface Props {
  investor: Investor;
  onClose: () => void;
}

export function InvestorEditModal({ investor, onClose }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: investor.name || "",
    phone: investor.phone || "",
    bank_name: investor.bank_name || "",
    bank_agency: investor.bank_agency || "",
    bank_account: investor.bank_account || "",
    pix_key: investor.pix_key || "",
    status: investor.status,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/investors/${investor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro" }));
      setError(data.error || `Erro ${res.status}`);
      return;
    }
    toast.success(`Investidor "${form.name}" atualizado.`);
    onClose();
    router.refresh();
  }

  async function del() {
    if (
      !confirm(
        `Excluir definitivamente o investidor "${investor.name}"? Essa ação remove o registro e o usuário auth. Não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/investors/${investor.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro" }));
      setError(data.error || `Erro ${res.status}`);
      toast.error(data.error || "Erro ao excluir investidor");
      return;
    }
    toast.success(`Investidor "${investor.name}" excluído.`);
    onClose();
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title={`Editar investidor #${investor.id}`}>
      <div className="space-y-4">
        {/* Read-only fields */}
        <div className="bg-slate-50 rounded p-3 text-xs space-y-1">
          <div>
            <span className="text-slate-500">CPF:</span>{" "}
            <strong>{investor.cpf}</strong>
            <span className="text-slate-400 ml-2">(read-only)</span>
          </div>
          <div>
            <span className="text-slate-500">Email:</span>{" "}
            <strong>{investor.email}</strong>
            <span className="text-slate-400 ml-2">(read-only)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+55 11 99999-0000"
            />
          </Field>
        </div>

        <Field label="Chave PIX">
          <input
            className="input"
            value={form.pix_key}
            onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Banco">
            <input
              className="input"
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            />
          </Field>
          <Field label="Agencia">
            <input
              className="input"
              value={form.bank_agency}
              onChange={(e) => setForm({ ...form, bank_agency: e.target.value })}
            />
          </Field>
          <Field label="Conta">
            <input
              className="input"
              value={form.bank_account}
              onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Status">
          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="approved">Aprovado</option>
            <option value="pending">Pendente</option>
            <option value="suspended">Suspenso</option>
            <option value="rejected">Rejeitado</option>
          </select>
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 flex items-start gap-2">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={del}
            disabled={saving || deleting}
            className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded transition disabled:opacity-50"
            title="Excluir investidor (bloqueado se houver financings ativos)"
          >
            {deleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Excluir
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-secondary inline-flex items-center gap-1"
              disabled={saving || deleting}
            >
              <X size={14} /> Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving || deleting}
              className="btn-primary inline-flex items-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

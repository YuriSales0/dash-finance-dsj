"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";

interface Category {
  id: string;
  label: string;
  group_name: string;
  affects_pnl: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  revenue: "Receitas",
  cost_variable: "Custos variaveis",
  cost_fixed: "Custos fixos",
  transfer: "Transferencias",
  investment: "Investimento",
};

const GROUP_COLORS: Record<string, string> = {
  revenue: "bg-green-50 text-green-800",
  cost_variable: "bg-amber-50 text-amber-800",
  cost_fixed: "bg-orange-50 text-orange-800",
  transfer: "bg-blue-50 text-blue-800",
  investment: "bg-purple-50 text-purple-800",
};

export function CategoriesEditor() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "",
    group_name: "cost_variable",
    affects_pnl: true,
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        affects_pnl: form.group_name === "transfer" || form.group_name === "investment" ? false : form.affects_pnl,
      }),
    });

    setSaving(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erro");
      return;
    }

    setForm({ label: "", group_name: "cost_variable", affects_pnl: true });
    load();
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm(`Deletar categoria "${id}"?\n\nTransacoes que usam essa categoria voltam pra "sem categoria" e precisam ser revisadas.`)) return;

    await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
    router.refresh();
  }

  // Agrupar por group_name
  const grouped: Record<string, Category[]> = {};
  for (const c of categories) {
    if (!grouped[c.group_name]) grouped[c.group_name] = [];
    grouped[c.group_name].push(c);
  }

  return (
    <div className="space-y-4">
      {/* Form de criacao */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus size={16} /> Adicionar categoria
          </h3>
        </div>
        <form onSubmit={add} className="card-body grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
            <input
              className="input"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Ex: Marketing influenciador"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Grupo</label>
            <select
              className="input"
              value={form.group_name}
              onChange={(e) => setForm({ ...form, group_name: e.target.value })}
            >
              <option value="revenue">Receita</option>
              <option value="cost_variable">Custo variavel</option>
              <option value="cost_fixed">Custo fixo</option>
              <option value="transfer">Transferencia</option>
              <option value="investment">Investimento</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={saving || !form.label} className="btn-primary inline-flex items-center gap-2 w-full justify-center">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Criar
            </button>
          </div>
          {error && (
            <div className="md:col-span-3 bg-red-50 text-red-700 p-2 rounded text-xs flex items-center gap-2">
              <AlertTriangle size={12} /> {error}
            </div>
          )}
        </form>
      </div>

      {/* Lista agrupada */}
      {loading ? (
        <div className="card card-body text-center py-8 text-slate-400">
          <Loader2 className="animate-spin inline mr-2" size={16} /> Carregando...
        </div>
      ) : (
        Object.entries(GROUP_LABELS).map(([groupId, groupLabel]) => {
          const items = grouped[groupId] || [];
          if (items.length === 0) return null;
          return (
            <div key={groupId} className="card">
              <div className="card-header">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${GROUP_COLORS[groupId]}`}>
                    {groupLabel}
                  </span>
                  <span className="text-slate-500 text-xs">({items.length})</span>
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((c) => (
                  <div key={c.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{c.label}</p>
                      <code className="text-[10px] text-slate-400">{c.id}</code>
                    </div>
                    <button
                      onClick={() => remove(c.id)}
                      className="text-red-400 hover:text-red-600 p-1"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

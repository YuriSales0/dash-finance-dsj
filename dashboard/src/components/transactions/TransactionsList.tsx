"use client";

import { useState, useMemo } from "react";
import type { Transaction, BankAccount, EntityId } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { Search, AlertCircle, ArrowRightLeft, Calendar } from "lucide-react";

interface Props {
  transactions: Transaction[];
  accounts: BankAccount[];
  entities?: { id: string; name: string }[];
}

const CATEGORIES = [
  { id: "revenue_shopify", label: "Vendas Shopify" },
  { id: "revenue_other", label: "Outras receitas" },
  { id: "cost_ads_meta", label: "Meta Ads" },
  { id: "cost_ads_tiktok", label: "TikTok Ads" },
  { id: "cost_ads_google", label: "Google Ads" },
  { id: "cost_products", label: "Produtos" },
  { id: "cost_shipping", label: "Frete" },
  { id: "cost_gateway", label: "Gateway" },
  { id: "cost_chargebacks", label: "Chargebacks" },
  { id: "cost_refunds", label: "Reembolsos" },
  { id: "cost_team", label: "Team" },
  { id: "cost_saas", label: "SaaS" },
  { id: "cost_infra", label: "Infra" },
  { id: "cost_legal", label: "Legal" },
  { id: "cost_office", label: "Escritorio" },
  { id: "transfer_intercompany", label: "Intercompany" },
  { id: "transfer_interbank", label: "Interbank" },
  { id: "transfer_fx", label: "Cambio" },
  { id: "investment_scp_in", label: "Aporte investidor" },
  { id: "investment_scp_out", label: "Retorno investidor" },
];

const PAGE_SIZE = 100;

export function TransactionsList({ transactions, accounts, entities = [] }: Props) {
  const [filter, setFilter] = useState<"all" | "review">("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [bankFilter, setBankFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editCategory, setEditCategory] = useState<string>("");

  const accountMap = useMemo(() => {
    return Object.fromEntries(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Lista de empresas: usa as passadas, senao deduz das transacoes
  const entityOptions = useMemo(() => {
    if (entities.length > 0) return entities;
    const ids = new Set(transactions.map((t) => t.entity_id));
    return Array.from(ids).map((id) => ({ id, name: entityNames[id] || id }));
  }, [entities, transactions]);

  // Lista de bancos baseado na empresa selecionada
  const bankOptions = useMemo(() => {
    return accounts.filter(
      (a) => entityFilter === "all" || a.entity_id === entityFilter
    );
  }, [accounts, entityFilter]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filter === "review" && !t.needs_review) return false;
      if (entityFilter !== "all" && t.entity_id !== entityFilter) return false;
      if (bankFilter !== "all" && t.bank_account_id !== bankFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const matches =
          (t.counterparty?.toLowerCase() || "").includes(s) ||
          (t.description?.toLowerCase() || "").includes(s);
        if (!matches) return false;
      }
      if (dateFrom) {
        if (new Date(t.timestamp) < new Date(dateFrom + "T00:00:00")) return false;
      }
      if (dateTo) {
        if (new Date(t.timestamp) > new Date(dateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [transactions, filter, entityFilter, bankFilter, search, dateFrom, dateTo]);

  const reviewCount = transactions.filter((t) => t.needs_review).length;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page quando muda filtros
  useMemo(() => setPage(1), [filter, entityFilter, bankFilter, search, dateFrom, dateTo]);

  // Quick presets de periodo
  function setPeriod(preset: "30d" | "90d" | "ytd" | "all") {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    setDateTo(today);
    if (preset === "30d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      setDateFrom(d.toISOString().slice(0, 10));
    } else if (preset === "90d") {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      setDateFrom(d.toISOString().slice(0, 10));
    } else if (preset === "ytd") {
      setDateFrom(`${now.getFullYear()}-01-01`);
    }
  }

  function handleSaveCategory() {
    if (!editing || !editCategory) return;
    fetch("/api/transactions/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, category_id: editCategory }),
    }).finally(() => {
      setEditing(null);
      setEditCategory("");
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card card-body space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar contraparte ou descricao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>

          <select
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setBankFilter("all");
            }}
            className="input w-auto"
          >
            <option value="all">Todas empresas</option>
            {entityOptions.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>

          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">Todos bancos</option>
            {bankOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.bank_name} ({a.currency})</option>
            ))}
          </select>

          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 text-sm font-medium ${
                filter === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-700"
              }`}
            >
              Todas ({transactions.length})
            </button>
            <button
              onClick={() => setFilter("review")}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-1 ${
                filter === "review" ? "bg-amber-600 text-white" : "bg-white text-amber-700"
              }`}
            >
              <AlertCircle size={14} />
              Revisar ({reviewCount})
            </button>
          </div>
        </div>

        {/* Filtro de periodo */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-600">Periodo:</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input text-sm py-1.5"
            />
            <span className="text-xs text-slate-500">ate</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input text-sm py-1.5"
            />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setPeriod("30d")} className="text-xs text-brand-600 hover:underline px-2">30d</button>
            <button onClick={() => setPeriod("90d")} className="text-xs text-brand-600 hover:underline px-2">90d</button>
            <button onClick={() => setPeriod("ytd")} className="text-xs text-brand-600 hover:underline px-2">YTD</button>
            <button onClick={() => setPeriod("all")} className="text-xs text-slate-500 hover:underline px-2">Tudo</button>
          </div>
          <span className="text-xs text-slate-500 ml-auto">
            <strong>{filtered.length}</strong> resultado(s)
          </span>
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-3 px-4 font-medium text-slate-500">Data</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Empresa / Banco</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Contraparte</th>
                <th className="text-left py-3 px-4 font-medium text-slate-500">Categoria</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500">Valor</th>
                <th className="text-center py-3 px-4 font-medium text-slate-500">Status</th>
                <th className="text-right py-3 px-4 font-medium text-slate-500">Acao</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Nenhuma transacao encontrada com esses filtros
                  </td>
                </tr>
              )}
              {pageRows.map((t) => {
                const acc = accountMap[t.bank_account_id];
                const cat = CATEGORIES.find((c) => c.id === t.category_id);
                return (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {formatDate(t.timestamp)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs">
                        <div className="font-medium">{entityNames[t.entity_id]}</div>
                        <div className="text-slate-400">{acc?.bank_name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{t.counterparty}</div>
                      <div className="text-xs text-slate-400">{t.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      {cat ? (
                        <Badge variant={t.is_intercompany ? "info" : "neutral"}>
                          {t.is_intercompany && <ArrowRightLeft size={10} className="mr-1" />}
                          {cat.label}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Sem categoria</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className={`font-mono font-medium ${
                        t.amount_original > 0 ? "text-green-600" : "text-slate-900"
                      }`}>
                        {formatCurrency(t.amount_original, t.currency_original)}
                      </div>
                      {t.currency_original !== "USD" && (
                        <div className="text-xs text-slate-400 font-mono">
                          {formatCurrency(t.amount_usd)} USD
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {t.needs_review ? (
                        <Badge variant="warning">Revisar</Badge>
                      ) : t.classified_by === "human" ? (
                        <Badge variant="success">Humano</Badge>
                      ) : t.classified_by === "rule" ? (
                        <Badge variant="info">Regra</Badge>
                      ) : (
                        <Badge variant="neutral">
                          AI {t.classification_confidence?.toFixed(0)}%
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditing(t);
                          setEditCategory(t.category_id || "");
                        }}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginacao */}
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-slate-200 text-xs">
            <span className="text-slate-500">
              Pagina {page} de {totalPages} • {filtered.length} resultados
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs disabled:opacity-50"
              >
                Proxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de edição */}
      {editing && (
        <Modal
          open={!!editing}
          onClose={() => setEditing(null)}
          title="Revisar Categoria"
        >
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div><span className="text-slate-500">Contraparte:</span> <strong>{editing.counterparty}</strong></div>
              <div><span className="text-slate-500">Descricao:</span> {editing.description}</div>
              <div><span className="text-slate-500">Valor:</span> <strong>{formatCurrency(editing.amount_original, editing.currency_original)}</strong></div>
              <div><span className="text-slate-500">AI sugeriu:</span> {editing.category_id || "Nenhuma"} ({editing.classification_confidence?.toFixed(0)}%)</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Categoria correta:
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="input"
              >
                <option value="">Selecione...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
              Ao salvar, uma <strong>regra de aprendizado</strong> sera criada e aplicada
              automaticamente a outras transacoes pendentes desta mesma contraparte.
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={handleSaveCategory}
                disabled={!editCategory}
                className="btn-primary"
              >
                Salvar e Aprender
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import type { Transaction, BankAccount, EntityId } from "@/types/database";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { Search, AlertCircle, ArrowRightLeft, Calendar, Wand2, Loader2 } from "lucide-react";

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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [marking, setMarking] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

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

  function toggleSelect(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function markAsIntercompany() {
    const ids = Array.from(selectedIds);
    if (ids.length < 1) return;
    const isPair = ids.length === 2;
    const confirm_msg = isPair
      ? "Marcar essas 2 transacoes como UM PAR de intercompany?"
      : `Marcar ${ids.length} transacoes como intercompany?`;
    if (!confirm(confirm_msg)) return;

    setMarking(true);
    await fetch("/api/intercompany/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, pair: isPair }),
    });
    setMarking(false);
    setSelectedIds(new Set());
    window.location.reload();
  }

  async function unmarkIntercompany() {
    const ids = Array.from(selectedIds);
    if (ids.length < 1) return;
    if (!confirm(`Desmarcar ${ids.length} transacao(oes) como intercompany?`)) return;

    setMarking(true);
    await fetch("/api/intercompany/mark", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setMarking(false);
    setSelectedIds(new Set());
    window.location.reload();
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
          <button
            onClick={() => setBulkOpen(true)}
            className="btn-secondary text-xs inline-flex items-center gap-1"
            title="Classificar varias de uma vez por conta"
          >
            <Wand2 size={12} />
            Classificar em massa
          </button>
        </div>
      </div>

      {bulkOpen && (
        <BulkClassifyModal accounts={accounts} onClose={() => setBulkOpen(false)} />
      )}

      {/* Barra de acoes em lote */}
      {selectedIds.size > 0 && (
        <div className="card card-body bg-blue-50 border-blue-200 flex items-center justify-between">
          <div className="text-sm text-blue-900">
            <strong>{selectedIds.size}</strong> selecionada(s)
            {selectedIds.size === 2 && " — pode marcar como par intercompany"}
          </div>
          <div className="flex gap-2">
            <button
              onClick={markAsIntercompany}
              disabled={marking}
              className="btn-primary text-xs inline-flex items-center gap-1"
            >
              {marking && <span className="animate-spin">⏳</span>}
              <ArrowRightLeft size={12} />
              {selectedIds.size === 2 ? "Marcar par como intercompany" : "Marcar como intercompany"}
            </button>
            <button
              onClick={unmarkIntercompany}
              disabled={marking}
              className="btn-secondary text-xs"
            >
              Desmarcar
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-700 hover:underline px-2"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-8 py-3 px-2"></th>
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
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    Nenhuma transacao encontrada com esses filtros
                  </td>
                </tr>
              )}
              {pageRows.map((t) => {
                const acc = accountMap[t.bank_account_id];
                const cat = CATEGORIES.find((c) => c.id === t.category_id);
                return (
                  <tr key={t.id} className={`border-b border-slate-100 hover:bg-slate-50 ${selectedIds.has(t.id) ? "bg-blue-50" : ""}`}>
                    <td className="py-3 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="rounded"
                      />
                    </td>
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


function BulkClassifyModal({ accounts, onClose }: { accounts: BankAccount[]; onClose: () => void }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [inflowCat, setInflowCat] = useState("revenue_other");
  const [outflowCat, setOutflowCat] = useState("");
  const [onlyUncategorized, setOnlyUncategorized] = useState(true);
  const [excludeIntercompany, setExcludeIntercompany] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!accountId) return;
    if (!inflowCat && !outflowCat) {
      setError("Selecione pelo menos uma categoria");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/transactions/bulk-classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bank_account_id: accountId,
        inflow_category: inflowCat || null,
        outflow_category: outflowCat || null,
        only_uncategorized: onlyUncategorized,
        exclude_intercompany: excludeIntercompany,
      }),
    });

    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erro");
      return;
    }
    setResult(data);
  }

  const acc = accounts.find((a) => a.id === accountId);

  return (
    <Modal open onClose={onClose} title="Classificar em massa">
      <div className="space-y-4">
        <div className="text-sm text-slate-600">
          Define uma regra automatica: todas transacoes <strong>positivas</strong> da conta viram receita, todas <strong>negativas</strong> viram custo.
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Conta</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="all">📋 TODAS as contas</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {entityNames[a.entity_id] || a.entity_id} - {a.bank_name} ({a.currency})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Entradas (positivos) <span className="text-green-600">+</span>
            </label>
            <select className="input" value={inflowCat} onChange={(e) => setInflowCat(e.target.value)}>
              <option value="">Nao alterar</option>
              <option value="revenue_shopify">Vendas Shopify</option>
              <option value="revenue_other">Outras receitas</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Saidas (negativos) <span className="text-red-600">-</span>
            </label>
            <select className="input" value={outflowCat} onChange={(e) => setOutflowCat(e.target.value)}>
              <option value="">Nao alterar</option>
              <option value="cost_ads_meta">Meta Ads</option>
              <option value="cost_ads_tiktok">TikTok Ads</option>
              <option value="cost_ads_google">Google Ads</option>
              <option value="cost_products">Produtos</option>
              <option value="cost_shipping">Frete</option>
              <option value="cost_gateway">Gateway</option>
              <option value="cost_team">Team</option>
              <option value="cost_saas">SaaS</option>
              <option value="cost_office">Outros / escritorio</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyUncategorized} onChange={(e) => setOnlyUncategorized(e.target.checked)} />
            Apenas transacoes sem categoria ou pendentes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={excludeIntercompany} onChange={(e) => setExcludeIntercompany(e.target.checked)} />
            Excluir intercompany
          </label>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-2 rounded text-xs">{error}</div>}

        {result && (
          <div className="bg-green-50 text-green-800 p-3 rounded text-sm space-y-1">
            <p className="font-semibold">Aplicado!</p>
            <p>{result.applied_inflow} entradas + {result.applied_outflow} saidas = <strong>{result.total_classified}</strong> transacoes</p>
            <p className="text-xs">{result.months_regenerated?.length || 0} meses de P&L regenerados</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">{result ? "Fechar" : "Cancelar"}</button>
          {!result && (
            <button onClick={apply} disabled={loading} className="btn-primary inline-flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Aplicar
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}


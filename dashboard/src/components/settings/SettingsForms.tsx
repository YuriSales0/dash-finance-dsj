"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import {
  Plus,
  Trash2,
  Save,
  Building2,
  Wallet,
  Loader2,
  DollarSign,
  Calculator,
} from "lucide-react";

interface Account {
  id: string;
  bank_name: string;
  currency: string;
  balance_current: number;
  balance_available: number;
}

interface EntityWithAccounts {
  id: string;
  name: string;
  jurisdiction: string | null;
  currency_default: string;
  accounts: Account[];
}

export function SettingsForms({
  entities,
}: {
  entities: EntityWithAccounts[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Nova empresa
  const [newEntity, setNewEntity] = useState({
    name: "",
    jurisdiction: "",
    currency_default: "USD",
  });

  // Nova conta
  const [newAccount, setNewAccount] = useState({
    entity_id: entities[0]?.id || "",
    bank_name: "",
    currency: "USD",
    balance_current: "",
  });

  // Editar saldo
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [balanceValue, setBalanceValue] = useState("");

  async function createEntity(e: React.FormEvent) {
    e.preventDefault();
    setLoading("entity");
    setMsg(null);
    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEntity),
    });
    setLoading(null);
    if (res.ok) {
      setNewEntity({ name: "", jurisdiction: "", currency_default: "USD" });
      setMsg("Empresa criada!");
      router.refresh();
    } else {
      const d = await res.json();
      setMsg(`Erro: ${d.error}`);
    }
  }

  async function deleteEntity(id: string) {
    if (!confirm(`Remover empresa ${id}? Contas vinculadas serao desativadas.`)) return;
    setLoading(`del-${id}`);
    await fetch("/api/entities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLoading(null);
    router.refresh();
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setLoading("account");
    setMsg(null);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newAccount,
        balance_current: Number(newAccount.balance_current) || 0,
        balance_available: Number(newAccount.balance_current) || 0,
      }),
    });
    setLoading(null);
    if (res.ok) {
      setNewAccount((f) => ({ ...f, bank_name: "", balance_current: "" }));
      setMsg("Conta criada!");
      router.refresh();
    } else {
      const d = await res.json();
      setMsg(`Erro: ${d.error}`);
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm(`Desativar conta ${id}?`)) return;
    setLoading(`del-acc-${id}`);
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setLoading(null);
    router.refresh();
  }

  async function recalculateBalances(excludeIntercompany = false) {
    const msg = excludeIntercompany
      ? "Recalcular saldo OPERACIONAL (excluindo intercompany)?\n\nMostra como se o dinheiro nunca tivesse saido do grupo DSJ."
      : "Recalcular saldos REAIS baseado nas transacoes importadas?\n\nIsso vai SOBRESCREVER os saldos atuais com a soma das transacoes de cada conta.\n\nUse para refletir o saldo real do banco apos os imports.";

    if (!confirm(msg)) return;

    setLoading(excludeIntercompany ? "recalc-op" : "recalc");
    setMsg(null);

    const res = await fetch("/api/accounts/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exclude_intercompany: excludeIntercompany }),
    });

    setLoading(null);
    const data = await res.json();
    if (res.ok) {
      const summary = (data.results || [])
        .map((r: any) => `${r.id}: ${Number(r.new_balance).toFixed(2)} ${r.currency} (${r.transactions_count} txs${r.intercompany_count ? `, ${r.intercompany_count} intercompany` : ""})`)
        .join(" | ");
      setMsg(`Saldos recalculados${excludeIntercompany ? " (sem intercompany)" : ""}: ${summary}`);
      router.refresh();
    } else {
      setMsg(`Erro: ${data.error}`);
    }
  }

  async function redetectIntercompany() {
    if (!confirm("Re-detectar intercompany com janela de 30 dias e tolerancia 5%?")) return;
    setLoading("redetect");
    setMsg(null);

    const res = await fetch("/api/intercompany/redetect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 30, tolerance_pct: 5 }),
    });

    setLoading(null);
    const data = await res.json();
    if (res.ok) {
      setMsg(`Re-deteccao: ${data.pairs_detected} pares detectados, ${data.transactions_marked} transacoes marcadas.`);
      router.refresh();
    } else {
      setMsg(`Erro: ${data.error}`);
    }
  }

  async function matchIntercompanyByName(dryRun = false) {
    setLoading(dryRun ? "match-dry" : "match-name");
    setMsg(null);

    const res = await fetch("/api/intercompany/match-by-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dry_run: dryRun }),
    });

    setLoading(null);
    const data = await res.json();
    if (!res.ok) {
      setMsg(`Erro: ${data.error}`);
      return;
    }

    if (dryRun) {
      const sample = (data.sample || []).slice(0, 5).map((s: any) =>
        `${s.from_entity} -> ${s.to_entity}: ${s.counterparty} ($${s.amount_usd})`
      ).join(" | ");
      setMsg(
        `Preview: ${data.total_matches} transacoes seriam marcadas como intercompany. Exemplos: ${sample}`
      );
      return;
    }

    setMsg(
      `${data.total_matches} transacoes marcadas, ${data.pairs_linked} pares vinculados, ${data.months_regenerated?.length || 0} meses regenerados.`
    );
    router.refresh();
  }

  async function updateBalance(accountId: string) {
    setLoading(`bal-${accountId}`);
    await fetch("/api/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: accountId,
        balance_current: Number(balanceValue),
        balance_available: Number(balanceValue),
        balance_updated_at: new Date().toISOString(),
      }),
    });
    setLoading(null);
    setEditingBalance(null);
    setBalanceValue("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className="card card-body bg-blue-50 border-blue-200 text-sm text-blue-800">
          {msg}
        </div>
      )}

      {/* Acoes de manutencao do bookkeeping */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2">
            <Calculator size={16} /> Manutencao de saldos
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {/* 0: Match intercompany por nome */}
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Marcar intercompany pelo nome da contraparte</p>
              <p className="text-xs text-slate-600">
                Toda transacao onde a contraparte cita "DSJ Network", "Universal MKT", "DSJ Connect" ou "DSJ Commerce" vira intercompany.
                Util quando a deteccao por valor/data nao captura tudo.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => matchIntercompanyByName(true)}
                disabled={loading === "match-dry" || loading === "match-name"}
                className="btn-secondary inline-flex items-center gap-2 text-sm whitespace-nowrap"
              >
                {loading === "match-dry" ? <Loader2 size={14} className="animate-spin" /> : null}
                Preview
              </button>
              <button
                onClick={() => matchIntercompanyByName(false)}
                disabled={loading === "match-name" || loading === "match-dry"}
                className="btn-primary inline-flex items-center gap-2 text-sm whitespace-nowrap"
              >
                {loading === "match-name" ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
                Aplicar
              </button>
            </div>
          </div>

          {/* 1: Re-detectar intercompany */}
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Re-detectar intercompany por valor/data</p>
              <p className="text-xs text-slate-600">
                Procura pares com mesmo valor (5% tolerancia) e ate 30 dias entre si.
              </p>
            </div>
            <button
              onClick={redetectIntercompany}
              disabled={loading === "redetect"}
              className="btn-secondary inline-flex items-center gap-2 text-sm whitespace-nowrap"
            >
              {loading === "redetect" ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
              Detectar
            </button>
          </div>

          {/* 2: Recalcular saldos REAIS */}
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Recalcular saldos reais</p>
              <p className="text-xs text-slate-600">
                Soma todas transacoes (incluindo intercompany). Reflete o saldo real do banco.
              </p>
            </div>
            <button
              onClick={() => recalculateBalances(false)}
              disabled={loading === "recalc"}
              className="btn-secondary inline-flex items-center gap-2 text-sm whitespace-nowrap"
            >
              {loading === "recalc" ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
              Recalcular
            </button>
          </div>

          {/* 3: Recalcular saldo operacional */}
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Recalcular saldo operacional</p>
              <p className="text-xs text-slate-600">
                Exclui intercompany — mostra como se o dinheiro nunca tivesse saido do grupo.
                Util pra entender lucro real do bookkeeping.
              </p>
            </div>
            <button
              onClick={() => recalculateBalances(true)}
              disabled={loading === "recalc-op"}
              className="btn-secondary inline-flex items-center gap-2 text-sm whitespace-nowrap"
            >
              {loading === "recalc-op" ? <Loader2 size={14} className="animate-spin" /> : <Calculator size={14} />}
              Operacional
            </button>
          </div>
        </div>
      </div>

      {/* Empresas existentes */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Building2 size={18} className="text-slate-600" />
          <h3 className="font-semibold">Empresas</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {entities.map((ent) => (
            <div key={ent.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold">{ent.name}</h4>
                  <p className="text-xs text-slate-500">
                    {ent.jurisdiction || "Sem jurisdicao"} — {ent.currency_default}
                  </p>
                </div>
                <button
                  onClick={() => deleteEntity(ent.id)}
                  disabled={loading === `del-${ent.id}`}
                  className="text-red-400 hover:text-red-600 p-1"
                  title="Remover empresa"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Contas da empresa */}
              <div className="space-y-2 ml-4">
                {ent.accounts.length === 0 && (
                  <p className="text-xs text-slate-400">Nenhuma conta bancaria</p>
                )}
                {ent.accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Wallet size={14} className="text-slate-400" />
                      <div>
                        <span className="text-sm font-medium">{acc.bank_name}</span>
                        <span className="text-xs text-slate-500 ml-2">({acc.currency})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingBalance === acc.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            className="input w-32 text-sm"
                            value={balanceValue}
                            onChange={(e) => setBalanceValue(e.target.value)}
                            autoFocus
                            placeholder="Saldo atual"
                          />
                          <button
                            onClick={() => updateBalance(acc.id)}
                            disabled={loading === `bal-${acc.id}`}
                            className="p-1 text-green-600 hover:text-green-700"
                          >
                            {loading === `bal-${acc.id}` ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Save size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingBalance(null)}
                            className="text-slate-400 hover:text-slate-600 text-xs"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingBalance(acc.id);
                            setBalanceValue(acc.balance_current.toString());
                          }}
                          className="font-mono text-sm hover:text-brand-600 cursor-pointer"
                          title="Clique para editar saldo"
                        >
                          <DollarSign size={12} className="inline mr-0.5 text-slate-400" />
                          {formatCurrency(acc.balance_current, acc.currency)}
                        </button>
                      )}
                      <button
                        onClick={() => deleteAccount(acc.id)}
                        disabled={loading === `del-acc-${acc.id}`}
                        className="text-red-300 hover:text-red-500 p-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Nova empresa */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus size={16} /> Adicionar empresa
          </h3>
        </div>
        <form onSubmit={createEntity} className="card-body grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
            <input
              className="input"
              value={newEntity.name}
              onChange={(e) => setNewEntity((f) => ({ ...f, name: e.target.value }))}
              required
              placeholder="Ex: DSJ Brasil LTDA"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Jurisdicao</label>
            <input
              className="input"
              value={newEntity.jurisdiction}
              onChange={(e) => setNewEntity((f) => ({ ...f, jurisdiction: e.target.value }))}
              placeholder="Ex: Sao Paulo, Brasil"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Moeda padrao</label>
            <select
              className="input"
              value={newEntity.currency_default}
              onChange={(e) => setNewEntity((f) => ({ ...f, currency_default: e.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={loading === "entity"}
              className="btn-primary inline-flex items-center gap-2"
            >
              {loading === "entity" && <Loader2 size={14} className="animate-spin" />}
              Criar empresa
            </button>
          </div>
        </form>
      </div>

      {/* Nova conta */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2">
            <Plus size={16} /> Adicionar conta bancaria
          </h3>
        </div>
        <form onSubmit={createAccount} className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Empresa</label>
            <select
              className="input"
              value={newAccount.entity_id}
              onChange={(e) => setNewAccount((f) => ({ ...f, entity_id: e.target.value }))}
            >
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>{ent.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nome do banco</label>
            <input
              className="input"
              value={newAccount.bank_name}
              onChange={(e) => setNewAccount((f) => ({ ...f, bank_name: e.target.value }))}
              required
              placeholder="Ex: Revolut, Nubank, Itau"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Moeda</label>
            <select
              className="input"
              value={newAccount.currency}
              onChange={(e) => setNewAccount((f) => ({ ...f, currency: e.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Saldo atual</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={newAccount.balance_current}
              onChange={(e) => setNewAccount((f) => ({ ...f, balance_current: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading === "account"}
              className="btn-primary inline-flex items-center gap-2"
            >
              {loading === "account" && <Loader2 size={14} className="animate-spin" />}
              Criar conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

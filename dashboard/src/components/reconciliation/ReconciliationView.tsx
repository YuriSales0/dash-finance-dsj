"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, Calendar, ArrowRightLeft } from "lucide-react";

interface AccountOption {
  id: string;
  label: string;
  currency: string;
  entity_id: string;
}

interface ReconciliationData {
  period: { from: string; to: string };
  total_transactions: number;
  accounts: any[];
  categories: any[];
  monthly: any[];
  top_transactions: any[];
}

const CATEGORY_LABELS: Record<string, string> = {
  revenue_shopify: "Vendas Shopify",
  revenue_other: "Outras receitas",
  cost_ads_meta: "Meta Ads",
  cost_ads_tiktok: "TikTok Ads",
  cost_ads_google: "Google Ads",
  cost_products: "Produtos",
  cost_shipping: "Frete",
  cost_gateway: "Gateway",
  cost_chargebacks: "Chargebacks",
  cost_refunds: "Reembolsos",
  cost_team: "Team",
  cost_saas: "SaaS",
  cost_infra: "Infraestrutura",
  cost_legal: "Legal",
  cost_office: "Escritorio",
  transfer_intercompany: "Intercompany",
  transfer_interbank: "Interbank",
  transfer_fx: "Cambio",
  uncategorized: "(sem categoria)",
};

export function ReconciliationView({
  accounts,
  initialFrom,
  initialTo,
  initialAccount,
}: {
  accounts: AccountOption[];
  initialFrom?: string;
  initialTo?: string;
  initialAccount?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const ytd = `${new Date().getFullYear()}-01-01`;

  const [from, setFrom] = useState(initialFrom || ytd);
  const [to, setTo] = useState(initialTo || today);
  const [account, setAccount] = useState(initialAccount || "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReconciliationData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (account) params.set("account", account);

    const res = await fetch(`/api/reconciliation?${params.toString()}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [from, to, account]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="card card-body">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input text-sm py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Ate</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input text-sm py-1.5"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-700 mb-1">Conta</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="">Todas as contas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
          <button onClick={load} disabled={loading} className="btn-primary inline-flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Recarregar
          </button>
        </div>
      </div>

      {!data && (
        <div className="card card-body text-center py-8 text-slate-400">
          <Loader2 size={20} className="animate-spin inline mr-2" />
          Carregando...
        </div>
      )}

      {data && data.total_transactions === 0 && (
        <div className="card card-body text-center py-8 text-slate-400">
          Nenhuma transacao no periodo selecionado.
        </div>
      )}

      {data && data.total_transactions > 0 && (
        <>
          {/* Por conta */}
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Por conta bancaria (em moeda original)</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-2 px-4 font-medium text-slate-500">Conta</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Entradas</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Saidas</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Intercompany</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Net (saldo)</th>
                    <th className="text-center py-2 px-4 font-medium text-slate-500">Txs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a: any) => {
                    const acc = accounts.find((x) => x.id === a.bank_account_id);
                    return (
                      <tr key={a.bank_account_id} className="border-b border-slate-100">
                        <td className="py-3 px-4">
                          <div className="font-medium text-xs">{entityNames[a.entity_id] || a.entity_id}</div>
                          <div className="text-xs text-slate-500">{acc?.label.split(" - ")[1] || a.bank_account_id}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-mono text-green-600 font-semibold">
                            +{formatCurrency(a.entrada_total, a.currency)}
                          </div>
                          <div className="text-xs text-slate-400">{a.entrada_count} txs</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-mono text-red-600 font-semibold">
                            {formatCurrency(a.saida_total, a.currency)}
                          </div>
                          <div className="text-xs text-slate-400">{a.saida_count} txs</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-mono text-blue-600 text-xs">
                            {formatCurrency(a.intercompany_total, a.currency)}
                          </div>
                          <div className="text-xs text-slate-400">{a.intercompany_count} txs</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          <span className={a.net >= 0 ? "text-slate-900" : "text-red-700"}>
                            {formatCurrency(a.net, a.currency)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-slate-500">{a.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por mes */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Calendar size={16} className="text-slate-600" />
              <h3 className="font-semibold">Por mes (USD, sem intercompany)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-2 px-4 font-medium text-slate-500">Mes</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Entradas</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Saidas</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Net</th>
                    <th className="text-center py-2 px-4 font-medium text-slate-500">Txs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m: any) => (
                    <tr key={m.month} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-medium">{m.month}</td>
                      <td className="py-3 px-4 text-right font-mono text-green-600">
                        +{formatCurrency(m.entrada_usd)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-red-600">
                        {formatCurrency(m.saida_usd)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={m.net_usd >= 0 ? "text-green-700" : "text-red-700"}>
                          {formatCurrency(m.net_usd)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-slate-500">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por categoria */}
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Por categoria (USD)</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-2 px-4 font-medium text-slate-500">Categoria</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Entrada</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Saida</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Net</th>
                    <th className="text-center py-2 px-4 font-medium text-slate-500">Txs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((c: any) => (
                    <tr key={c.category_id} className={`border-b border-slate-100 ${c.category_id === "uncategorized" ? "bg-amber-50" : ""}`}>
                      <td className="py-3 px-4">
                        <span className="text-sm">{CATEGORY_LABELS[c.category_id] || c.category_id}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-green-600 text-xs">
                        {c.entrada_usd > 0 ? `+${formatCurrency(c.entrada_usd)}` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-red-600 text-xs">
                        {c.saida_usd < 0 ? formatCurrency(c.saida_usd) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                        <span className={c.total_usd >= 0 ? "text-slate-900" : "text-red-700"}>
                          {formatCurrency(c.total_usd)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-xs text-slate-500">{c.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 20 transacoes */}
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Top 20 transacoes (por valor absoluto)</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left py-2 px-4 font-medium text-slate-500">Data</th>
                    <th className="text-left py-2 px-4 font-medium text-slate-500">Descricao</th>
                    <th className="text-left py-2 px-4 font-medium text-slate-500">Categoria</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">Valor original</th>
                    <th className="text-right py-2 px-4 font-medium text-slate-500">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_transactions.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="py-3 px-4 text-xs">{formatDate(t.timestamp)}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{t.counterparty || "(sem contraparte)"}</div>
                        <div className="text-xs text-slate-500 truncate max-w-md">{t.description}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {t.is_intercompany && <ArrowRightLeft size={10} className="inline mr-1 text-blue-500" />}
                        {CATEGORY_LABELS[t.category_id || "uncategorized"]}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono ${Number(t.amount_original) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(Number(t.amount_original), t.currency_original)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-600">
                        {formatCurrency(Number(t.amount_usd))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

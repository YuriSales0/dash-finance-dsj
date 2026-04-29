"use client";

import { useEffect, useState } from "react";
import { formatCurrency, entityNames } from "@/lib/format";
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw, ArrowRight } from "lucide-react";

export function AuditView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/audit");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="card card-body text-center py-8 text-slate-400">
        <Loader2 size={20} className="animate-spin inline mr-2" />
        Analisando dados...
      </div>
    );
  }

  if (!data || !data.audit) return null;

  const summary = data.summary;
  const totalIssueCount = data.audit.reduce((s: number, a: any) => s + (a.issues?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-600">
            <strong>{summary.total_transactions}</strong> transacoes analisadas •{" "}
            <strong className="text-amber-600">{summary.total_uncategorized}</strong> sem categoria •{" "}
            <strong className="text-blue-600">{summary.total_intercompany}</strong> intercompany
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-xs inline-flex items-center gap-1">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Recarregar
        </button>
      </div>

      {/* Insight global */}
      {summary.total_uncategorized > 0 && (
        <div className="card card-body bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-900">
                Diagnostico: {summary.total_uncategorized} transacoes sem categoria explicam a divergencia
              </p>
              <p className="text-amber-800 mt-1">
                Total impacto: <strong>{formatCurrency(summary.sum_uncategorized)}</strong>
              </p>
              <p className="text-amber-700 text-xs mt-2">
                Essas transacoes afetam o SALDO mas nao entram no P&L (porque nao tem categoria).
                Por isso o P&L parece positivo enquanto o saldo fica negativo.
                <strong> Solucao: classifique-as em /admin/transactions</strong> ou configure
                ANTHROPIC_API_KEY no Vercel para o Claude classificar automaticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {totalIssueCount === 0 && summary.total_transactions > 0 && (
        <div className="card card-body bg-green-50 border-green-200 flex items-center gap-3">
          <CheckCircle2 className="text-green-600" size={20} />
          <p className="text-sm text-green-800 font-medium">
            Tudo categorizado! Saldos batem com P&L.
          </p>
        </div>
      )}

      {/* Por empresa */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold">Auditoria por empresa</h3>
        </div>
        <div className="divide-y divide-slate-200">
          {data.audit.map((a: any) => (
            <div key={a.entity_id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-base">{entityNames[a.entity_id] || a.entity_id}</h4>
                <span className="text-xs text-slate-500">
                  {a.total_transactions} transacao(oes)
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <Stat label="Receitas (P&L)" value={a.sum_revenue_usd} sub={`${a.count_revenue} txs`} positive />
                <Stat label="Custos (P&L)" value={a.sum_costs_usd} sub={`${a.count_costs} txs`} negative />
                <Stat
                  label="Sem categoria"
                  value={a.sum_uncategorized_usd}
                  sub={`${a.count_uncategorized} txs`}
                  warning={a.count_uncategorized > 0}
                />
                <Stat
                  label="Intercompany"
                  value={a.sum_intercompany_usd}
                  sub={`${a.count_intercompany} txs`}
                  info
                />
              </div>

              {/* Comparacao */}
              <div className="bg-slate-50 rounded-lg p-3 text-sm grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Soma transacoes (s/ intercompany)</p>
                  <p className={`font-mono font-semibold ${a.delta_excluding_intercompany >= 0 ? "text-slate-900" : "text-red-700"}`}>
                    {formatCurrency(a.delta_excluding_intercompany)}
                  </p>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight size={20} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">P&L registrado</p>
                  <p className={`font-mono font-semibold ${a.pnl_net >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {formatCurrency(a.pnl_net)}
                  </p>
                </div>
              </div>

              {a.issues && a.issues.length > 0 && (
                <ul className="space-y-1">
                  {a.issues.map((issue: string, idx: number) => (
                    <li key={idx} className="text-xs text-amber-700 flex items-start gap-2">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  positive,
  negative,
  warning,
  info,
}: {
  label: string;
  value: number;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
  warning?: boolean;
  info?: boolean;
}) {
  const color = warning
    ? "text-amber-700"
    : info
    ? "text-blue-700"
    : positive
    ? "text-green-700"
    : negative
    ? "text-red-700"
    : "text-slate-700";

  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <p className="text-slate-500 mb-0.5">{label}</p>
      <p className={`font-mono font-semibold ${color}`}>{formatCurrency(value)}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

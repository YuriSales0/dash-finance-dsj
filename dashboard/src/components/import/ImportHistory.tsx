"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2, AlertTriangle, CheckCircle, History } from "lucide-react";
import { formatDateTime, entityNames } from "@/lib/format";

interface ImportBatch {
  id: number;
  bank_account_id: string;
  entity_id: string;
  format: string;
  file_name: string | null;
  total_rows: number;
  rows_imported: number;
  rows_skipped_duplicates: number;
  rows_needs_review: number;
  pnl_months_regenerated: string[] | null;
  intercompany_detected: number;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
  bank_accounts: { bank_name: string; currency: string } | null;
}

export function ImportHistory() {
  const router = useRouter();
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/imports");
    const data = await res.json();
    setImports(data || []);
    setLoading(false);
  }

  async function revert(batchId: number) {
    if (!confirm(
      "Reverter este import?\n\n" +
      "Todas as transacoes deste import serao DELETADAS e o P&L sera regenerado.\n\n" +
      "Esta acao nao pode ser desfeita."
    )) return;

    setReverting(batchId);
    setMessage(null);

    const res = await fetch(`/api/imports/${batchId}`, { method: "DELETE" });
    const data = await res.json();

    setReverting(null);

    if (!res.ok) {
      setMessage(`Erro: ${data.error}`);
      return;
    }

    setMessage(`Import revertido: ${data.deleted} transacoes removidas, ${data.months_regenerated?.length || 0} meses de P&L regenerados.`);
    load();
    router.refresh();
  }

  if (loading) {
    return (
      <div className="card card-body text-center py-6 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin inline mr-2" />
        Carregando historico...
      </div>
    );
  }

  if (imports.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header flex items-center gap-2">
        <History size={16} className="text-slate-600" />
        <h3 className="font-semibold">Historico de imports</h3>
      </div>

      {message && (
        <div className="px-4 py-2 bg-blue-50 text-blue-800 text-sm border-b border-blue-200">
          {message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Data</th>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Conta</th>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Formato</th>
              <th className="text-right py-2 px-4 font-medium text-slate-500">Importadas</th>
              <th className="text-right py-2 px-4 font-medium text-slate-500">Duplicadas</th>
              <th className="text-center py-2 px-4 font-medium text-slate-500">Status</th>
              <th className="text-right py-2 px-4 font-medium text-slate-500">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((b) => (
              <tr key={b.id} className={`border-b border-slate-100 ${b.reverted_at ? "opacity-50" : ""}`}>
                <td className="py-3 px-4 text-xs text-slate-700">{formatDateTime(b.created_at)}</td>
                <td className="py-3 px-4 text-xs">
                  <div className="font-medium">{entityNames[b.entity_id] || b.entity_id}</div>
                  <div className="text-slate-500">
                    {b.bank_accounts?.bank_name} ({b.bank_accounts?.currency})
                  </div>
                </td>
                <td className="py-3 px-4 text-xs uppercase">{b.format}</td>
                <td className="py-3 px-4 text-right font-mono text-sm">{b.rows_imported || 0}</td>
                <td className="py-3 px-4 text-right font-mono text-xs text-slate-500">
                  {b.rows_skipped_duplicates || 0}
                </td>
                <td className="py-3 px-4 text-center">
                  {b.reverted_at ? (
                    <span className="badge-neutral">Revertido</span>
                  ) : (
                    <span className="badge-success">Ativo</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {!b.reverted_at && (
                    <button
                      onClick={() => revert(b.id)}
                      disabled={reverting === b.id}
                      className="text-red-500 hover:text-red-700 text-xs inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                    >
                      {reverting === b.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Undo2 size={12} />
                      )}
                      Reverter
                    </button>
                  )}
                  {b.reverted_at && (
                    <span className="text-xs text-slate-400">
                      por {b.reverted_by}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

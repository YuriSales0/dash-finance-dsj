"use client";

import { formatCurrency } from "@/lib/format";
import type { BalanceVerificationRow } from "@/types/database";
import { CheckCircle2, AlertTriangle, Scale } from "lucide-react";

interface BalanceCheckProps {
  rows: BalanceVerificationRow[];
}

const CURRENCY_ORDER = ["USD", "GBP", "EUR", "BRL"];

export function BalanceCheck({ rows }: BalanceCheckProps) {
  if (!rows || rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => {
    const ai = CURRENCY_ORDER.indexOf(a.currency);
    const bi = CURRENCY_ORDER.indexOf(b.currency);
    const ax = ai === -1 ? 99 : ai;
    const bx = bi === -1 ? 99 : bi;
    if (ax !== bx) return ax - bx;
    return a.currency.localeCompare(b.currency);
  });

  const allOk = sorted.every((r) => Math.abs(r.diff) < 1);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={16} className={allOk ? "text-green-600" : "text-amber-600"} />
          <h3 className="font-semibold text-sm">Verificacao: Lucro x Variacao real do saldo</h3>
          {allOk ? (
            <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
              OK — todas as moedas batem
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {sorted.filter((r) => Math.abs(r.diff) >= 1).length} moeda(s) com divergencia
            </span>
          )}
        </div>
      </div>

      <div className="card-body space-y-3">
        <p className="text-xs text-slate-500">
          <strong>Variacao real</strong> = saldo atual - saldo de abertura (somado das contas
          ativas).{" "}
          <strong>Lucro calculado</strong> = soma de amount_original de TODAS as transacoes da
          moeda. <strong>Diferenca</strong> = Variacao real − Lucro calculado.
        </p>
        <p className="text-xs text-slate-500">
          Se diff = 0, todo movimento bancario veio (e foi pra) uma transacao registrada — sem
          edicoes manuais de saldo, sem CSVs faltando, sem opening_balance fora do dia 1.
          Diff &gt; 0 → balance_current foi inflado manualmente OU faltam transacoes de saida.
          Diff &lt; 0 → balance_current foi reduzido manualmente OU faltam transacoes de entrada.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-slate-600">
                <th className="text-left px-3 py-2 font-medium">Moeda</th>
                <th className="text-right px-3 py-2 font-medium">Saldo abertura</th>
                <th className="text-right px-3 py-2 font-medium">Saldo atual</th>
                <th className="text-right px-3 py-2 font-medium">
                  Variacao real
                </th>
                <th className="text-right px-3 py-2 font-medium">
                  Lucro calculado
                </th>
                <th className="text-right px-3 py-2 font-medium border-l border-slate-200">
                  Diferenca
                </th>
                <th className="text-center px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const ok = Math.abs(r.diff) < 1;
                return (
                  <tr key={r.currency} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                        {r.currency}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-600">
                      {formatCurrency(r.opening_total, r.currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                      {formatCurrency(r.current_total, r.currency)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${
                      r.expected_delta >= 0 ? "text-green-700" : "text-red-700"
                    }`}>
                      {formatCurrency(r.expected_delta, r.currency)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold ${
                      r.tx_total_flow >= 0 ? "text-green-700" : "text-red-700"
                    }`}>
                      {formatCurrency(r.tx_total_flow, r.currency)}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-bold border-l border-slate-200 ${
                      ok ? "text-slate-400" : "text-amber-700"
                    }`}>
                      {ok ? "0,00" : formatCurrency(r.diff, r.currency)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {ok ? (
                        <CheckCircle2 size={16} className="text-green-600 inline" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-600 inline" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!allOk && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs">
            <p className="font-semibold text-amber-900 mb-1">Divergencia detectada</p>
            <p className="text-amber-700">
              Quando a Variacao real difere do Lucro calculado, ha uma destas causas:
            </p>
            <ul className="text-amber-700 mt-1 ml-4 list-disc space-y-0.5">
              <li><b>balance_current</b> foi editado manualmente (via SQL ou UI) sem transacao correspondente</li>
              <li>Alguma transacao nao foi importada (gap no CSV)</li>
              <li><b>opening_balance</b> nao reflete o saldo real do dia 1 do CSV</li>
              <li>Reverter batch deletou transacoes sem reverter saldo</li>
            </ul>
            <p className="text-amber-700 mt-1">
              Veja <a href="/admin/reconciliation" className="underline">/admin/reconciliation</a>{" "}
              pra inspecao por conta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

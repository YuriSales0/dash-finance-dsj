"use client";

import { useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle, X, Copy } from "lucide-react";

interface Props {
  financingId: number;
  contractHash: string | null;
  signedAt: string | null;
}

interface VerifyResponse {
  id: number;
  valid: boolean;
  stored_hash?: string;
  recomputed_hash?: string;
  signed_at?: string | null;
  accepted_at?: string | null;
  reason?: string | null;
  demo?: boolean;
}

export function ContractVerifyButton({ financingId, contractHash, signedAt }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/financings/${financingId}/verify`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Erro ${res.status}`);
        return;
      }
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Erro de conexao");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

  if (!contractHash) {
    return (
      <p className="text-xs text-slate-400 italic">
        Contrato sem hash armazenado.
      </p>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          if (!result && !loading) verify();
        }}
        className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 hover:underline"
      >
        <ShieldCheck size={12} />
        Verificar autenticidade do contrato
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldCheck size={16} className="text-brand-600" />
                Verificacao de autenticidade
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                A integridade do contrato e validada recomputando o SHA-256 do{" "}
                <code className="bg-slate-100 px-1 rounded">contract_text</code>{" "}
                armazenado e comparando com o{" "}
                <code className="bg-slate-100 px-1 rounded">contract_hash</code>{" "}
                gerado no momento da assinatura.
              </p>

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-slate-400" size={28} />
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  <div
                    className={`rounded-lg p-3 flex items-start gap-3 ${
                      result.valid
                        ? "bg-green-50 border border-green-200 text-green-900"
                        : "bg-red-50 border border-red-200 text-red-900"
                    }`}
                  >
                    {result.valid ? (
                      <CheckCircle2 className="shrink-0 mt-0.5 text-green-600" size={20} />
                    ) : (
                      <AlertTriangle className="shrink-0 mt-0.5 text-red-600" size={20} />
                    )}
                    <div>
                      <p className="font-semibold text-sm">
                        {result.valid
                          ? "Contrato autentico"
                          : "Contrato com hash divergente"}
                      </p>
                      <p className="text-xs mt-1 opacity-90">
                        {result.valid
                          ? "O hash recomputado bate com o armazenado. O contract_text nao foi alterado desde a assinatura."
                          : result.reason || "Contrato pode ter sido alterado."}
                      </p>
                    </div>
                  </div>

                  <HashRow
                    label="Hash armazenado (assinatura)"
                    hash={result.stored_hash}
                    onCopy={copy}
                  />
                  <HashRow
                    label="Hash recomputado agora"
                    hash={result.recomputed_hash}
                    onCopy={copy}
                  />

                  {result.signed_at && (
                    <div className="text-xs text-slate-600">
                      <span className="text-slate-400">Assinado em:</span>{" "}
                      <span className="font-mono">{result.signed_at}</span>
                    </div>
                  )}
                  {result.accepted_at && (
                    <div className="text-xs text-slate-600">
                      <span className="text-slate-400">Aceito em:</span>{" "}
                      <span className="font-mono">{result.accepted_at}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                <span>Financing ID: {financingId}</span>
                {!loading && (
                  <button
                    onClick={verify}
                    className="text-brand-600 hover:underline"
                  >
                    Re-verificar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HashRow({
  label,
  hash,
  onCopy,
}: {
  label: string;
  hash?: string;
  onCopy: (text: string) => void;
}) {
  if (!hash) return null;
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-1">
        {label}
      </p>
      <div className="flex items-center gap-2 bg-slate-50 rounded p-2 border border-slate-200">
        <code className="font-mono text-[10px] text-slate-700 break-all flex-1">
          {hash}
        </code>
        <button
          onClick={() => onCopy(hash)}
          className="text-slate-400 hover:text-slate-700 shrink-0"
          title="Copiar"
        >
          <Copy size={12} />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/format";
import { Link2, Copy, Check, Loader2, Send, RefreshCw } from "lucide-react";

interface ReceivableOption {
  id: number;
  description: string;
  amount_total: number;
  currency: string;
  interest_rate: number;
  redemption_days: number;
}

export function InviteGenerator({
  receivables: initialReceivables,
  disabled,
}: {
  receivables: ReceivableOption[];
  disabled?: boolean;
}) {
  // Mantem propria lista pra poder atualizar via refetch (usuario pode ter
  // editado um recebivel em /admin/receivables sem ter recarregado a pagina).
  const [receivables, setReceivables] = useState<ReceivableOption[]>(initialReceivables);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [receivableId, setReceivableId] = useState(initialReceivables[0]?.id?.toString() || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const refetch = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/receivables?open_for_financing=true", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const mapped: ReceivableOption[] = (data || [])
          .filter((r: any) => r.status !== "paid")
          .map((r: any) => ({
            id: r.id,
            description: r.description,
            amount_total: r.amount_total,
            currency: r.currency,
            interest_rate: r.financing_interest_rate_pct || 0,
            redemption_days: r.financing_redemption_days || 0,
          }));
        setReceivables(mapped);
        setLastFetched(new Date());
      }
    } catch {
      // best effort
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh ao montar e quando a janela ganha foco (usuario voltou
  // da aba de recebiveis depois de editar)
  useEffect(() => {
    refetch();
    function onFocus() {
      refetch();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetch]);

  const selected = receivables.find((r) => r.id === Number(receivableId));

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receivable_id: Number(receivableId) || null,
        investor_name: name || null,
        investor_email: email || null,
        message: message || null,
      }),
    });

    setLoading(false);
    const data = await res.json();
    if (res.ok) {
      setResult({ code: data.code, link: data.link });
    }
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(result.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function timeAgo(d: Date): string {
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 5) return "agora";
    if (sec < 60) return `${sec}s atras`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}min atras`;
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-6">
      {/* Passo 1: selecionar produto */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">1. Selecionar produto</h3>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            {lastFetched && (
              <span>
                Atualizado {timeAgo(lastFetched)}
              </span>
            )}
            <button
              onClick={refetch}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:underline disabled:opacity-50"
              title="Re-busca a lista de recebiveis abertos. Use se acabou de editar uma operacao em /admin/receivables."
            >
              {refreshing ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RefreshCw size={11} />
              )}
              Recarregar
            </button>
          </div>
        </div>
        <div className="card-body space-y-4">
          {receivables.length === 0 ? (
            <div className="text-sm text-slate-500">
              Nenhum recebivel aberto para financiamento.{" "}
              <a href="/admin/receivables" className="text-brand-600 underline">Criar recebivel primeiro</a>.
            </div>
          ) : (
            <>
              <select
                className="input"
                value={receivableId}
                onChange={(e) => setReceivableId(e.target.value)}
              >
                <option value="">Convite generico (sem produto especifico)</option>
                {receivables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.description} — {formatCurrency(r.amount_total, r.currency)} ({r.interest_rate}%/mes, {r.redemption_days}d)
                  </option>
                ))}
              </select>

              {selected && (
                <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Valor total</p>
                    <p className="font-semibold">{formatCurrency(selected.amount_total, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Taxa de juros</p>
                    <p className="font-semibold">{selected.interest_rate}% ao mes</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Prazo</p>
                    <p className="font-semibold">{selected.redemption_days} dias</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Passo 2: dados do investidor */}
      <form onSubmit={generate}>
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">2. Dados do investidor (opcional)</h3></div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nome</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investidor@email.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mensagem personalizada (visivel na pagina de convite)
              </label>
              <textarea
                className="input"
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: Ola, temos uma oportunidade exclusiva para voce..."
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading || disabled}
                className="btn-primary inline-flex items-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                {disabled ? "Configure o contrato primeiro" : "Gerar link de convite"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Resultado */}
      {result && (
        <div className="card card-body bg-green-50 border-green-200">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Check className="text-green-600 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-green-900">Convite gerado!</p>
                <p className="text-sm text-green-800 mt-1">
                  Codigo: <strong>{result.code}</strong>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-green-200 p-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={result.link}
                className="flex-1 bg-transparent text-sm font-mono text-slate-800 outline-none"
              />
              <button
                onClick={copyLink}
                className="btn-primary text-sm inline-flex items-center gap-1"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>

            <p className="text-xs text-green-700">
              Envie este link para o investidor. Ele vai criar conta, visualizar o produto, e assinar o contrato.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

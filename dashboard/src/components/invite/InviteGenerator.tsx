"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { Link2, Copy, Check, Loader2, Send } from "lucide-react";

interface ReceivableOption {
  id: number;
  description: string;
  amount_total: number;
  currency: string;
  interest_rate: number;
  redemption_days: number;
}

export function InviteGenerator({
  receivables,
}: {
  receivables: ReceivableOption[];
}) {
  const [receivableId, setReceivableId] = useState(receivables[0]?.id?.toString() || "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Passo 1: selecionar produto */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">1. Selecionar produto</h3></div>
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
                    {r.description} — {formatCurrency(r.amount_total, r.currency)} ({r.interest_rate}%, {r.redemption_days}d)
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
                    <p className="font-semibold">{selected.interest_rate}%</p>
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
                disabled={loading}
                className="btn-primary inline-flex items-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                Gerar link de convite
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

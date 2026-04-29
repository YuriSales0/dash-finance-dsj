"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { FileText, Check, Loader2, AlertTriangle } from "lucide-react";

export default function ContractPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [amount, setAmount] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/product?code=${code}`)
      .then((r) => r.json())
      .then((data) => setProduct(data))
      .catch(() => {});
  }, [code]);

  const numAmount = Number(amount) || 0;
  const rate = product?.interest_rate || 2.5;
  const days = product?.redemption_days || 14;
  const expectedReturn = numAmount * (1 + rate / 100);
  const currency = product?.currency || "USD";

  async function handleSign() {
    if (!accepted || numAmount <= 0) return;
    setError(null);
    setLoading(true);

    const res = await fetch("/api/financings/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_code: code,
        receivable_id: product?.receivable_id,
        amount_invested: numAmount,
        interest_rate_pct: rate,
        redemption_days: days,
        expected_return: expectedReturn,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao assinar");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/investor"), 3000);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="card card-body max-w-md text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Contrato assinado!</h1>
          <p className="text-sm text-slate-600 mb-1">
            Valor: <strong>{formatCurrency(numAmount, currency)}</strong>
          </p>
          <p className="text-sm text-slate-600 mb-4">
            Retorno: <strong>{formatCurrency(expectedReturn, currency)}</strong> em {days} dias
          </p>
          <p className="text-xs text-slate-400">
            Redirecionando para seu painel...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl mb-3">
            <FileText className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold">Contrato de Investimento</h1>
          <p className="text-sm text-slate-500 mt-1">Sociedade em Conta de Participacao (SCP)</p>
        </div>

        {/* Valor */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Valor do investimento</h3></div>
          <div className="card-body space-y-4">
            <input
              type="number"
              step="0.01"
              className="input text-xl text-center font-mono py-3"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Minimo ${formatCurrency(product?.min_amount || 1000, currency)}`}
              min={product?.min_amount || 0}
              max={product?.max_amount || undefined}
            />
            {numAmount > 0 && (
              <div className="bg-green-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500">Investimento</p>
                  <p className="font-bold text-lg">{formatCurrency(numAmount, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Juros ({rate}%)</p>
                  <p className="font-bold text-lg text-green-600">+{formatCurrency(numAmount * rate / 100, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Retorno em {days}d</p>
                  <p className="font-bold text-lg text-green-700">{formatCurrency(expectedReturn, currency)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contrato */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Termos do contrato</h3></div>
          <div className="card-body">
            <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto text-xs text-slate-700 leading-relaxed space-y-3">
              <p><strong>CONTRATO DE SOCIEDADE EM CONTA DE PARTICIPACAO (SCP)</strong></p>
              <p>Pelo presente instrumento particular, de um lado como <strong>SOCIO OSTENSIVO</strong>, DSJ Network LLC, sociedade limitada com sede na Florida, USA, e de outro lado como <strong>SOCIO PARTICIPANTE</strong>, o investidor identificado no cadastro desta plataforma;</p>
              <p><strong>CLAUSULA 1 - OBJETO:</strong> O Socio Participante aporta capital para antecipacao de recebiveis de operacoes de e-commerce ja validadas e capturadas pelo Socio Ostensivo.</p>
              <p><strong>CLAUSULA 2 - VALOR E RETORNO:</strong> O valor investido e a taxa de retorno sao os informados na tela de confirmacao. O prazo para pagamento do retorno e contado a partir da data de confirmacao do aporte.</p>
              <p><strong>CLAUSULA 3 - RISCOS:</strong> O investimento possui risco de credito associado ao recebivel subjacente. Em caso de inadimplencia do devedor do recebivel, o retorno pode ser inferior ao estimado. O Socio Ostensivo empregara seus melhores esforcos para a realizacao do recebivel.</p>
              <p><strong>CLAUSULA 4 - PAGAMENTO:</strong> O retorno sera pago via transferencia bancaria (PIX ou TED) para a conta indicada no cadastro do investidor, nas datas previstas no cronograma de pagamento.</p>
              <p><strong>CLAUSULA 5 - CONFIDENCIALIDADE:</strong> As partes se comprometem a manter em sigilo todas as informacoes relativas a esta operacao e aos dados financeiros disponibilizados na plataforma.</p>
              <p><strong>CLAUSULA 6 - FORO:</strong> Fica eleito o foro da Comarca de Miami-Dade, Florida, USA, para dirimir quaisquer controversias.</p>
            </div>

            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 rounded"
              />
              <span className="text-sm text-slate-700">
                Li e aceito os termos do contrato de Sociedade em Conta de Participacao (SCP).
                Confirmo que estou ciente dos riscos e condicoes apresentados.
              </span>
            </label>
          </div>
        </div>

        {error && (
          <div className="card card-body bg-red-50 border-red-200 flex items-start gap-3">
            <AlertTriangle className="text-red-600 mt-0.5" size={18} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleSign}
          disabled={!accepted || numAmount <= 0 || loading}
          className="btn-primary w-full py-3 text-lg inline-flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? "Assinando..." : "Assinar contrato e confirmar investimento"}
        </button>
      </div>
    </div>
  );
}

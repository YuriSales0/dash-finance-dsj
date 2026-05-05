"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { calculateExpectedReturn, effectivePeriodRatePct } from "@/lib/finance/return";
import { Loader2, CheckCircle } from "lucide-react";

interface Props {
  receivableId: number;
  minAmount: number;
  maxAmount: number;
  rate: number;
  days: number;
  currency: string;
}

export function FinancingButton({ receivableId, minAmount, maxAmount, rate, days, currency }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(minAmount.toString());
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = Number(amount) || 0;
  // Taxa configurada e MENSAL — juros compostos no periodo
  const expectedReturn = calculateExpectedReturn(numAmount, rate, days);
  const periodRate = effectivePeriodRatePct(rate, days);

  async function handleSubmit() {
    setError(null);
    if (numAmount < minAmount || numAmount > maxAmount) {
      setError(`Valor deve estar entre ${formatCurrency(minAmount, currency)} e ${formatCurrency(maxAmount, currency)}`);
      return;
    }

    setLoading(true);
    // Usa o endpoint /sign que valida server-side (min/max/available, calcula
    // expected_return server-side, faz sanity check pos-insert pra evitar race).
    const res = await fetch("/api/financings/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receivable_id: receivableId,
        amount_invested: numAmount,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Falha ao criar financiamento");
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
      router.refresh();
    }, 1800);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        Financiar
      </button>
    );
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle className="text-green-600" size={20} />
        <p className="text-sm text-green-800 font-medium">
          Financiamento criado com sucesso! Aguardando confirmacao da DSJ.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
      <h4 className="font-semibold text-sm mb-3">Quanto voce quer financiar?</h4>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={minAmount}
          max={maxAmount}
          className="input flex-1"
          placeholder={`Min ${formatCurrency(minAmount, currency)}`}
        />
        <div className="text-sm text-slate-700">
          Retorno: <strong>{formatCurrency(expectedReturn, currency)}</strong>
          <span className="text-xs text-slate-500"> em {days}d</span>
          <span className="block text-[10px] text-slate-400">
            {rate}% ao mes · {periodRate.toFixed(2)}% no periodo (juros compostos)
          </span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <div className="flex gap-2 mt-4">
        <button onClick={handleSubmit} disabled={loading} className="btn-primary inline-flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Confirmar financiamento
        </button>
        <button onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
      </div>
    </div>
  );
}

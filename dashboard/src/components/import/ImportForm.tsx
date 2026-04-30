"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface BankAccountOption {
  id: string;
  bank_name: string;
  currency: string;
  entity_id: string;
  entity_name: string;
}

interface PreviewSample {
  external_id: string;
  timestamp: string;
  description: string;
  counterparty: string | null;
  amount_original: number;
  currency_original: string;
}

interface PreviewResult {
  format: string;
  total_rows: number;
  normalized: number;
  new_transactions: number;
  skipped_duplicates: number;
  sample: PreviewSample[];
}

interface ImportResult {
  format: string;
  imported: number;
  skipped_duplicates: number;
  needs_review: number;
  balance_delta?: number;
  new_balance?: number;
}

interface FxRates {
  rates: Record<string, number>;
  display: string;
}

const CURRENCIES = [
  { code: "USD", label: "USD — Dolar americano", symbol: "$" },
  { code: "GBP", label: "GBP — Libra esterlina", symbol: "£" },
  { code: "EUR", label: "EUR — Euro", symbol: "€" },
  { code: "BRL", label: "BRL — Real brasileiro", symbol: "R$" },
];

export function ImportForm({ accounts }: { accounts: BankAccountOption[] }) {
  const router = useRouter();
  const [bankId, setBankId] = useState(accounts[0]?.id || "");
  const [currency, setCurrency] = useState("USD");
  const [fxRate, setFxRate] = useState("1");
  const [fxRates, setFxRates] = useState<FxRates | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === bankId);

  // Buscar cotacoes automaticamente ao carregar
  useEffect(() => {
    fetchRates();
  }, []);

  // Quando muda moeda, atualizar taxa
  useEffect(() => {
    if (!fxRates) return;
    if (currency === "USD") {
      setFxRate("1");
    } else {
      const rate = fxRates.rates[currency];
      if (rate) {
        setFxRate((1 / rate).toFixed(6));
      }
    }
  }, [currency, fxRates]);

  // Auto-detectar moeda pela conta selecionada
  useEffect(() => {
    if (selectedAccount) {
      setCurrency(selectedAccount.currency);
    }
  }, [bankId, selectedAccount]);

  async function fetchRates() {
    setFxLoading(true);
    try {
      const res = await fetch("/api/fx");
      const data = await res.json();
      setFxRates(data);
    } catch {
      // fallback silencioso
    }
    setFxLoading(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(reader.result as string);
      setPreview(null);
      setResult(null);
      setError(null);
    };
    reader.readAsText(file);
  }

  async function handlePreview() {
    if (!csvText || !bankId || !selectedAccount) return;
    setLoading("preview");
    setError(null);
    setResult(null);

    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv_text: csvText,
        bank_account_id: bankId,
        entity_id: selectedAccount.entity_id,
        fx_rate: Number(fxRate),
        currency_override: currency,
        preview_only: true,
      }),
    });

    setLoading(null);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Falha");
      return;
    }
    setPreview(data);
  }

  async function handleCommit() {
    if (!csvText || !bankId || !selectedAccount) return;
    setLoading("commit");
    setError(null);

    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv_text: csvText,
        bank_account_id: bankId,
        entity_id: selectedAccount.entity_id,
        fx_rate: Number(fxRate),
        currency_override: currency,
        preview_only: false,
      }),
    });

    setLoading(null);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Falha");
      return;
    }
    setResult(data);
    setPreview(null);
    setCsvText("");
    setFileName(null);
    setTimeout(() => router.refresh(), 500);
  }

  return (
    <div className="space-y-6">
      {/* Cotação em tempo real */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Cotacao do dia</h3>
          <button
            onClick={fetchRates}
            disabled={fxLoading}
            className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
          >
            <RefreshCw size={12} className={fxLoading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
        <div className="card-body">
          {fxRates ? (
            <div className="flex flex-wrap gap-4 text-sm">
              {Object.entries(fxRates.rates)
                .filter(([k]) => k !== "USD")
                .map(([code, rate]) => {
                  const toUsd = (1 / rate).toFixed(4);
                  return (
                    <div key={code} className="bg-slate-50 px-4 py-2 rounded-lg">
                      <span className="font-mono font-semibold">1 {code}</span>
                      <span className="text-slate-500"> = </span>
                      <span className="font-mono font-semibold text-green-700">{toUsd} USD</span>
                    </div>
                  );
                })}
              <div className="text-xs text-slate-400 self-center">
                Fonte: BCE (Banco Central Europeu)
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Carregando cotacoes...</p>
          )}
        </div>
      </div>

      {/* Config */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">1. Configurar conta e moeda</h3></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Conta bancaria</label>
            <select className="input" value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.entity_name} - {a.bank_name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Moeda do CSV</label>
            <select
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {currency === "USD"
                ? "Sem conversao necessaria"
                : `Sera convertido para USD com a taxa abaixo`}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Taxa {currency} → USD
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.000001"
                className="input flex-1"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                disabled={currency === "USD"}
              />
              {currency !== "USD" && fxRates && (
                <button
                  onClick={() => {
                    const r = fxRates.rates[currency];
                    if (r) setFxRate((1 / r).toFixed(6));
                  }}
                  className="btn-secondary text-xs whitespace-nowrap"
                  title="Usar cotacao do dia"
                >
                  Usar ECB
                </button>
              )}
            </div>
            {currency !== "USD" && (
              <p className="text-xs text-slate-500 mt-1">
                1 {currency} = {Number(fxRate).toFixed(4)} USD
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">2. Upload do CSV</h3></div>
        <div className="card-body">
          <label className="block">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-slate-50 transition-colors">
              <Upload className="mx-auto text-slate-400 mb-2" size={28} />
              <p className="text-sm font-medium text-slate-700">
                {fileName || "Clique ou arraste o CSV"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Suporta: Revolut Business, Mercury, ou CSV generico
              </p>
            </div>
          </label>

          {csvText && !preview && !result && (
            <button
              onClick={handlePreview}
              disabled={loading === "preview"}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              {loading === "preview" && <Loader2 size={14} className="animate-spin" />}
              Ver preview
            </button>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="card card-body bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-0.5" size={18} />
            <div>
              <p className="font-semibold text-red-900">Erro</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">3. Preview</h3></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Formato" value={preview.format.toUpperCase()} />
              <Stat label="Linhas no CSV" value={String(preview.total_rows)} />
              <Stat label="Para importar" value={String(preview.new_transactions)} highlight />
              <Stat label="Duplicadas" value={String(preview.skipped_duplicates)} />
              <Stat label="Moeda" value={currency} />
            </div>

            {currency !== "USD" && (
              <div className="bg-amber-50 px-4 py-2 rounded-lg text-xs text-amber-800">
                Conversao: 1 {currency} = <strong>{Number(fxRate).toFixed(4)} USD</strong> (taxa aplicada a todas transacoes)
              </div>
            )}

            {preview.sample.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">Data</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">Descricao</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">Contraparte</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-500">Valor orig.</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-500">Em USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((s) => (
                      <tr key={s.external_id} className="border-t border-slate-100">
                        <td className="py-2 px-3">{new Date(s.timestamp).toLocaleDateString("pt-BR")}</td>
                        <td className="py-2 px-3 truncate max-w-xs">{s.description}</td>
                        <td className="py-2 px-3 text-slate-500">{s.counterparty || "-"}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrency(s.amount_original, s.currency_original)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-green-700">
                          {formatCurrency(s.amount_original * Number(fxRate))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCommit}
                disabled={loading === "commit" || preview.new_transactions === 0}
                className="btn-primary inline-flex items-center gap-2"
              >
                {loading === "commit" && <Loader2 size={14} className="animate-spin" />}
                Importar {preview.new_transactions} transacoes
              </button>
              <button onClick={() => setPreview(null)} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="card card-body bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="text-green-600 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Import concluido</p>
              <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                <div>
                  <span className="text-green-700">Importadas: </span>
                  <strong>{result.imported}</strong>
                </div>
                <div>
                  <span className="text-green-700">Duplicadas: </span>
                  <strong>{result.skipped_duplicates}</strong>
                </div>
                <div>
                  <span className="text-amber-700">Para revisar: </span>
                  <strong>{result.needs_review}</strong>
                </div>
              </div>
              {(result.balance_delta !== undefined && result.balance_delta !== 0) && (
                <div className="mt-3 pt-3 border-t border-green-200 text-sm">
                  <p className="text-green-900">
                    Saldo ajustado:{" "}
                    <strong className={result.balance_delta >= 0 ? "text-green-700" : "text-red-700"}>
                      {result.balance_delta >= 0 ? "+" : ""}
                      {formatCurrency(result.balance_delta, currency)}
                    </strong>
                    {result.new_balance !== undefined && (
                      <>
                        {" "}→ novo saldo:{" "}
                        <strong>{formatCurrency(result.new_balance, currency)}</strong>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Apenas as {result.imported} transacoes novas foram somadas. Duplicatas nao contam.
                  </p>
                </div>
              )}
              {result.needs_review > 0 && (
                <a href="/admin/transactions" className="text-sm text-amber-900 underline mt-2 inline-block">
                  Ir para revisao &rarr;
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? "bg-brand-50" : "bg-slate-50"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-brand-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
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
}

export function ImportForm({ accounts }: { accounts: BankAccountOption[] }) {
  const router = useRouter();
  const [bankId, setBankId] = useState(accounts[0]?.id || "");
  const [fxRate, setFxRate] = useState("1.27");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === bankId);

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
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">1. Configurar conta</h3></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Taxa GBP/USD (so para contas em GBP)
            </label>
            <input
              type="number"
              step="0.0001"
              className="input"
              value={fxRate}
              onChange={(e) => setFxRate(e.target.value)}
              disabled={selectedAccount?.currency !== "GBP"}
            />
            <p className="text-xs text-slate-500 mt-1">
              {selectedAccount?.currency === "GBP" ? "Necessario para converter para USD" : "Nao aplicavel"}
            </p>
          </div>
        </div>
      </div>

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
                Suporta: Revolut Business export, Mercury, ou CSV generico
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

      {preview && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">3. Preview</h3></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Formato" value={preview.format.toUpperCase()} />
              <Stat label="Linhas no CSV" value={String(preview.total_rows)} />
              <Stat label="Para importar" value={String(preview.new_transactions)} highlight />
              <Stat label="Duplicadas" value={String(preview.skipped_duplicates)} />
            </div>

            {preview.sample.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">Data</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">Descricao</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-500">Contraparte</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-500">Valor</th>
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

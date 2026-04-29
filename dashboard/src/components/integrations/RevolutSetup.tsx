"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { entityNames, formatDateTime } from "@/lib/format";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronDown,
  Settings,
} from "lucide-react";

interface AccountOption {
  id: string;
  entity_id: string;
  bank_name: string;
  currency: string;
}

interface CredentialStatus {
  id: number;
  bank_account_id: string;
  client_id: string;
  issuer: string;
  sandbox: boolean;
  last_sync_at: string | null;
  last_sync_count: number | null;
  last_sync_error: string | null;
  active: boolean;
}

const REDIRECT_URI = typeof window !== "undefined"
  ? `${window.location.origin}/api/auth/revolut/callback`
  : "https://dash-finance-dsj.vercel.app/api/auth/revolut/callback";

export function RevolutSetup({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [showWizard, setShowWizard] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; result: any } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/revolut/credentials")
      .then((r) => r.json())
      .then((d) => { setCredentials(d || []); setLoadingCreds(false); });
  }, []);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function syncAccount(bankAccountId: string) {
    setSyncingId(bankAccountId);
    setSyncResult(null);
    const res = await fetch("/api/revolut/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_account_id: bankAccountId, days: 30 }),
    });
    const data = await res.json();
    setSyncingId(null);
    setSyncResult({ id: bankAccountId, result: data });
    router.refresh();
    fetch("/api/revolut/credentials")
      .then((r) => r.json())
      .then((d) => setCredentials(d || []));
  }

  async function disconnect(bankAccountId: string) {
    if (!confirm("Desconectar Revolut desta conta? Voce precisara reconfigurar para sincronizar novamente.")) return;
    await fetch("/api/revolut/credentials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_account_id: bankAccountId }),
    });
    setCredentials((c) => c.filter((x) => x.bank_account_id !== bankAccountId));
  }

  return (
    <div className="space-y-6">
      {/* Setup wizard como instrucao geral */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Como configurar (uma vez)</h3></div>
        <div className="card-body space-y-4 text-sm">
          <Step number={1} title="Gerar certificado X509 (no terminal local)">
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto mt-2">
{`openssl genrsa -out revolut_private.pem 2048
openssl req -new -x509 -key revolut_private.pem -out revolut_public.pem -days 3650 \\
  -subj "/C=US/ST=Florida/L=Miami/O=DSJ/CN=dsj-finance"`}
            </pre>
          </Step>

          <Step number={2} title="Subir certificado no Revolut">
            <p className="text-slate-600">
              Acesse <a href="https://business.revolut.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline inline-flex items-center gap-1">Revolut Business → Settings → APIs <ExternalLink size={12} /></a>
            </p>
            <p className="text-slate-600 mt-1">Cole o conteudo do arquivo <code className="bg-slate-100 px-1 rounded text-xs">revolut_public.pem</code> e use:</p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <CopyField label="Issuer" value="dash-finance-dsj.vercel.app" k="issuer" copy={copy} copied={copied} />
              <CopyField label="OAuth Redirect URI" value={REDIRECT_URI} k="redirect" copy={copy} copied={copied} />
            </div>
            <p className="text-slate-600 mt-2 text-xs">Apos enviar, o Revolut vai gerar um <strong>Client ID</strong>. Anote.</p>
          </Step>

          <Step number={3} title="Autorizar acesso">
            <p className="text-slate-600">
              No Revolut Business → API Settings, clique em <strong>"Enable API"</strong> e autorize.
              Voce sera redirecionado de volta com um codigo na URL.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Exemplo: <code className="bg-slate-100 px-1 rounded">?code=oa_prod_xxxxxxxxxx</code>
            </p>
          </Step>

          <Step number={4} title="Trocar codigo por refresh_token">
            <p className="text-slate-600">
              Use Postman ou curl para chamar a API uma vez. Ver{" "}
              <a href="https://developer.revolut.com/docs/business/business-api" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline inline-flex items-center gap-1">
                docs do Revolut <ExternalLink size={12} />
              </a>.
              Voce vai obter um <strong>refresh_token</strong> de longa duracao (90 dias).
            </p>
          </Step>

          <Step number={5} title="Salvar credenciais aqui">
            <p className="text-slate-600">
              Cole client_id, private_key e refresh_token no formulario de cada conta abaixo.
            </p>
          </Step>
        </div>
      </div>

      {/* Lista de contas Revolut */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-700">Contas Revolut</h3>

        {accounts.length === 0 && (
          <div className="card card-body text-center py-8 text-slate-400">
            Nenhuma conta Revolut cadastrada.{" "}
            <a href="/admin/settings" className="text-brand-600 underline">Adicionar conta</a>
          </div>
        )}

        {accounts.map((acc) => {
          const creds = credentials.find((c) => c.bank_account_id === acc.id);
          const isWizardOpen = showWizard === acc.id;

          return (
            <div key={acc.id} className="card">
              <div className="card-header flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{entityNames[acc.entity_id] || acc.entity_id}</h4>
                  <p className="text-xs text-slate-500">{acc.bank_name} ({acc.currency})</p>
                </div>
                <div className="flex items-center gap-2">
                  {creds ? (
                    <>
                      <span className="badge-success">Conectado</span>
                      <button
                        onClick={() => syncAccount(acc.id)}
                        disabled={syncingId === acc.id}
                        className="btn-primary text-xs inline-flex items-center gap-1"
                      >
                        {syncingId === acc.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Sync
                      </button>
                      <button
                        onClick={() => disconnect(acc.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Desconectar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowWizard(isWizardOpen ? null : acc.id)}
                      className="btn-secondary text-xs inline-flex items-center gap-1"
                    >
                      <Settings size={12} />
                      Configurar
                      <ChevronDown size={12} className={isWizardOpen ? "rotate-180" : ""} />
                    </button>
                  )}
                </div>
              </div>

              {creds && (
                <div className="card-body space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-500">Cliente:</span>{" "}
                      <code className="text-slate-800">{creds.client_id.slice(0, 24)}...</code>
                    </div>
                    <div>
                      <span className="text-slate-500">Modo:</span>{" "}
                      <span className={creds.sandbox ? "text-amber-600" : "text-green-600"}>
                        {creds.sandbox ? "Sandbox" : "Producao"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Ultimo sync:</span>{" "}
                      <span>{creds.last_sync_at ? formatDateTime(creds.last_sync_at) : "Nunca"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Transacoes:</span>{" "}
                      <strong>{creds.last_sync_count ?? "-"}</strong>
                    </div>
                  </div>

                  {creds.last_sync_error && (
                    <div className="bg-red-50 text-red-700 rounded p-2 text-xs flex items-start gap-2">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>{creds.last_sync_error}</span>
                    </div>
                  )}

                  {syncResult?.id === acc.id && (
                    <div className={`rounded p-2 text-xs ${syncResult.result.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>
                      {syncResult.result.error
                        ? `Erro: ${syncResult.result.error}`
                        : `Sync OK: ${syncResult.result.imported} importadas, ${syncResult.result.duplicates_skipped} duplicadas, ${syncResult.result.needs_review} para revisar`}
                    </div>
                  )}
                </div>
              )}

              {isWizardOpen && !creds && (
                <CredentialsForm bankAccountId={acc.id} onSaved={() => {
                  setShowWizard(null);
                  fetch("/api/revolut/credentials").then((r) => r.json()).then((d) => setCredentials(d || []));
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-brand-200 pl-4">
      <h4 className="font-semibold flex items-center gap-2">
        <span className="bg-brand-600 text-white text-xs w-5 h-5 rounded-full inline-flex items-center justify-center">{number}</span>
        {title}
      </h4>
      <div className="mt-1 ml-7">{children}</div>
    </div>
  );
}

function CopyField({ label, value, k, copy, copied }: any) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <code className="text-xs text-slate-800 break-all">{value}</code>
      </div>
      <button onClick={() => copy(value, k)} className="text-brand-600 hover:text-brand-700 p-1 shrink-0">
        {copied === k ? <CheckCircle size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function CredentialsForm({ bankAccountId, onSaved }: { bankAccountId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    client_id: "",
    issuer: "dash-finance-dsj.vercel.app",
    private_key: "",
    refresh_token: "",
    sandbox: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/revolut/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_account_id: bankAccountId, ...form }),
    });

    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erro");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="card-body space-y-3 border-t border-slate-200">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Client ID</label>
        <input
          className="input font-mono text-xs"
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          placeholder="oid_xxxxxxxxxxxx"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Issuer (dominio)</label>
        <input
          className="input"
          value={form.issuer}
          onChange={(e) => setForm({ ...form, issuer: e.target.value })}
          placeholder="dash-finance-dsj.vercel.app"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          Private Key (conteudo do revolut_private.pem)
        </label>
        <textarea
          className="input font-mono text-[10px] leading-tight"
          rows={6}
          value={form.private_key}
          onChange={(e) => setForm({ ...form, private_key: e.target.value })}
          placeholder="-----BEGIN PRIVATE KEY-----..."
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Refresh Token</label>
        <input
          className="input font-mono text-xs"
          value={form.refresh_token}
          onChange={(e) => setForm({ ...form, refresh_token: e.target.value })}
          placeholder="oa_prod_xxxxxxxxxxxx"
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.sandbox}
          onChange={(e) => setForm({ ...form, sandbox: e.target.checked })}
          className="rounded"
        />
        Sandbox (ambiente de teste)
      </label>

      {error && (
        <div className="bg-red-50 text-red-700 rounded p-2 text-xs flex items-start gap-2">
          <AlertTriangle size={12} className="mt-0.5" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary inline-flex items-center gap-2"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Salvar e validar
      </button>
    </form>
  );
}

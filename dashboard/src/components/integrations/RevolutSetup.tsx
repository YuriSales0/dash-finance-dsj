"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
  ShieldCheck,
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
  has_refresh_token: boolean;
  revolut_account_id: string | null;
}

interface RevolutSubAccount {
  id: string;
  name: string;
  currency: string;
  balance: number;
  state: string;
}

const REDIRECT_URI = typeof window !== "undefined"
  ? `${window.location.origin}/api/auth/revolut/callback`
  : "https://dash-finance-dsj.vercel.app/api/auth/revolut/callback";

export function RevolutSetup({ accounts }: { accounts: AccountOption[] }) {
  return (
    <Suspense fallback={null}>
      <RevolutSetupInner accounts={accounts} />
    </Suspense>
  );
}

function RevolutSetupInner({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [showWizard, setShowWizard] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [authorizingId, setAuthorizingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; result: any } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mensagens vindas do callback
  useEffect(() => {
    const success = params.get("success");
    const error = params.get("error");
    if (success === "connected") {
      setGlobalMessage({ type: "success", text: "Revolut conectado com sucesso! Voce pode sincronizar agora." });
    } else if (error) {
      setGlobalMessage({ type: "error", text: `Erro na autorizacao: ${error}` });
    }
  }, [params]);

  useEffect(() => {
    loadCredentials();
  }, []);

  function loadCredentials() {
    fetch("/api/revolut/credentials")
      .then((r) => r.json())
      .then((d) => setCredentials(d || []));
  }

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
    loadCredentials();
  }

  async function authorize(bankAccountId: string) {
    setAuthorizingId(bankAccountId);
    const res = await fetch("/api/revolut/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_account_id: bankAccountId }),
    });
    const data = await res.json();
    setAuthorizingId(null);

    if (!res.ok) {
      setGlobalMessage({ type: "error", text: data.error || "Erro" });
      return;
    }

    // Redireciona para o Revolut
    window.location.href = data.url;
  }

  async function disconnect(bankAccountId: string) {
    if (!confirm("Desconectar Revolut desta conta? Voce precisara reconfigurar.")) return;
    await fetch("/api/revolut/credentials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_account_id: bankAccountId }),
    });
    setCredentials((c) => c.filter((x) => x.bank_account_id !== bankAccountId));
  }

  return (
    <div className="space-y-6">
      {/* Mensagem global */}
      {globalMessage && (
        <div
          className={`card card-body ${
            globalMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            {globalMessage.type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {globalMessage.text}
          </div>
        </div>
      )}

      {/* Setup wizard */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Como configurar (uma vez por conta)</h3></div>
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
              Acesse{" "}
              <a
                href="https://business.revolut.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 underline inline-flex items-center gap-1"
              >
                Revolut Business → Settings → APIs <ExternalLink size={12} />
              </a>
            </p>
            <p className="text-slate-600 mt-1">
              Cole o conteudo do <code className="bg-slate-100 px-1 rounded text-xs">revolut_public.pem</code> e use:
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <CopyField label="Issuer" value="dash-finance-dsj.vercel.app" k="issuer" copy={copy} copied={copied} />
              <CopyField label="OAuth Redirect URI" value={REDIRECT_URI} k="redirect" copy={copy} copied={copied} />
            </div>
            <p className="text-slate-600 mt-2 text-xs">
              Apos enviar, o Revolut vai gerar um <strong>Client ID</strong>. Anote.
            </p>
          </Step>

          <Step number={3} title="Salvar credenciais aqui">
            <p className="text-slate-600">
              Cole o <strong>Client ID</strong> e o <strong>Private Key</strong> no formulario da conta abaixo e salve.
            </p>
          </Step>

          <Step number={4} title="Autorizar no Revolut (1 clique)">
            <p className="text-slate-600">
              Apos salvar as credenciais, aparece um botao <strong>Autorizar</strong>. Clique nele e voce sera
              redirecionado ao Revolut para autorizar o acesso. Depois volta automaticamente para ca conectado.
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
          const isDraft = creds && !creds.has_refresh_token;
          const isAuthorized = creds && creds.has_refresh_token && creds.active;
          const needsAccountPick = isAuthorized && !creds.revolut_account_id;
          const isReady = isAuthorized && !!creds.revolut_account_id;

          return (
            <div key={acc.id} className="card">
              <div className="card-header flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{entityNames[acc.entity_id] || acc.entity_id}</h4>
                  <p className="text-xs text-slate-500">{acc.bank_name} ({acc.currency})</p>
                </div>
                <div className="flex items-center gap-2">
                  {isReady && (
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
                  )}
                  {needsAccountPick && (
                    <>
                      <span className="badge-warning">Selecione a sub-conta</span>
                      <button
                        onClick={() => disconnect(acc.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Desconectar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  {isDraft && (
                    <>
                      <span className="badge-warning">Aguardando autorizacao</span>
                      <button
                        onClick={() => authorize(acc.id)}
                        disabled={authorizingId === acc.id}
                        className="btn-primary text-xs inline-flex items-center gap-1"
                      >
                        {authorizingId === acc.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={12} />
                        )}
                        Autorizar
                      </button>
                      <button
                        onClick={() => disconnect(acc.id)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Cancelar setup"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  {!creds && (
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

              {isReady && (
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
                      <span className="text-slate-500">Sub-conta Revolut:</span>{" "}
                      <code className="text-slate-800">{creds.revolut_account_id?.slice(0, 8)}...</code>
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
                    <div
                      className={`rounded p-2 text-xs ${
                        syncResult.result.error
                          ? "bg-red-50 text-red-700"
                          : "bg-green-50 text-green-800"
                      }`}
                    >
                      {syncResult.result.error
                        ? `Erro: ${syncResult.result.error}`
                        : `Sync OK: ${syncResult.result.imported} importadas, ${syncResult.result.duplicates_skipped} duplicadas, ${syncResult.result.needs_review} para revisar`}
                    </div>
                  )}
                </div>
              )}

              {needsAccountPick && (
                <SubAccountPicker
                  bankAccountId={acc.id}
                  bankCurrency={acc.currency}
                  onSelected={loadCredentials}
                />
              )}

              {isDraft && (
                <div className="card-body bg-amber-50 border-t border-amber-200">
                  <p className="text-xs text-amber-800">
                    Credenciais salvas. Clique em <strong>Autorizar</strong> acima para abrir o Revolut e completar a conexao.
                  </p>
                </div>
              )}

              {isWizardOpen && !creds && (
                <CredentialsForm
                  bankAccountId={acc.id}
                  onSaved={() => {
                    setShowWizard(null);
                    loadCredentials();
                  }}
                />
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
        <span className="bg-brand-600 text-white text-xs w-5 h-5 rounded-full inline-flex items-center justify-center">
          {number}
        </span>
        {title}
      </h4>
      <div className="mt-1 ml-7">{children}</div>
    </div>
  );
}

function SubAccountPicker({
  bankAccountId,
  bankCurrency,
  onSelected,
}: {
  bankAccountId: string;
  bankCurrency: string;
  onSelected: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<RevolutSubAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/revolut/accounts?bank_account_id=${encodeURIComponent(bankAccountId)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || "Erro ao listar sub-contas");
        } else {
          setAccounts(d.accounts || []);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [bankAccountId]);

  async function pick(revolutAccountId: string) {
    setSelecting(revolutAccountId);
    setError(null);
    const res = await fetch("/api/revolut/select-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_account_id: bankAccountId, revolut_account_id: revolutAccountId }),
    });
    setSelecting(null);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Erro");
      return;
    }
    onSelected();
  }

  return (
    <div className="card-body bg-amber-50 border-t border-amber-200 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-900">Selecione a sub-conta Revolut</p>
        <p className="text-xs text-amber-800 mt-1">
          O Revolut Business retorna varias sub-contas (uma por moeda). Escolha qual sub-conta corresponde
          a esta conta local ({bankCurrency}). Apenas transacoes desta sub-conta serao importadas.
        </p>
      </div>

      {loading && (
        <div className="text-xs text-slate-600 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Carregando sub-contas...
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 rounded p-2 text-xs flex items-start gap-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((a) => {
            const matchesCurrency = a.currency.toUpperCase() === bankCurrency.toUpperCase();
            return (
              <button
                key={a.id}
                onClick={() => pick(a.id)}
                disabled={selecting !== null}
                className={`w-full text-left rounded-lg p-3 border transition flex items-center justify-between gap-2 ${
                  matchesCurrency
                    ? "bg-white border-amber-300 hover:border-brand-500"
                    : "bg-slate-50 border-slate-200 hover:border-slate-400"
                } disabled:opacity-50`}
              >
                <div>
                  <div className="text-sm font-medium">
                    {a.name || `${a.currency} pocket`}{" "}
                    {matchesCurrency && (
                      <span className="ml-1 text-[10px] bg-amber-200 text-amber-900 px-1 rounded">
                        moeda compativel
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {a.currency} · saldo {a.balance.toLocaleString()} · <code>{a.id.slice(0, 8)}...</code>
                  </div>
                </div>
                {selecting === a.id ? (
                  <Loader2 size={16} className="animate-spin text-brand-600" />
                ) : (
                  <CheckCircle size={16} className="text-slate-300" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {!loading && accounts.length === 0 && !error && (
        <p className="text-xs text-slate-600">Nenhuma sub-conta disponivel.</p>
      )}
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
    sandbox: false,
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

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

  async function testKey() {
    setTesting(true);
    setError(null);
    setDebugInfo(null);

    const res = await fetch("/api/revolut/debug-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        private_key: form.private_key,
        client_id: form.client_id,
        issuer: form.issuer,
      }),
    });

    setTesting(false);
    const data = await res.json();
    setDebugInfo(data);
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

      {debugInfo && (
        <div className={`rounded p-3 text-xs space-y-1 ${debugInfo.ok ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
          <p className="font-semibold">
            {debugInfo.ok ? "Chave validada!" : `Falha em: ${debugInfo.stage}`}
          </p>
          {debugInfo.error && <p className="text-red-700">{debugInfo.error}</p>}
          <details className="mt-2">
            <summary className="cursor-pointer">Detalhes diagnostico</summary>
            <pre className="mt-1 text-[10px] bg-white/50 p-2 rounded overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={testKey}
          disabled={testing || !form.private_key}
          className="btn-secondary inline-flex items-center gap-2"
        >
          {testing && <Loader2 size={14} className="animate-spin" />}
          Testar chave
        </button>
        <button type="submit" disabled={loading} className="btn-primary inline-flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Salvar credenciais
        </button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Wand2,
} from "lucide-react";

interface Status {
  has_key: boolean;
  source: "database" | "env" | null | "demo";
  masked: string | null;
}

export function AnthropicEditor() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Bulk classify
  const [classifying, setClassifying] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState<{
    classified: number;
    remaining: number;
    rounds: number;
  } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/anthropic");
    const data = await res.json();
    setStatus(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!apiKey || apiKey.length < 20) {
      setError("Cole a chave Anthropic completa (sk-ant-...)");
      return;
    }
    setSaving(true);
    setError(null);
    setTestResult(null);

    const res = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });

    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Erro");
      return;
    }
    setApiKey("");
    load();
    // Auto-testar apos salvar
    test();
  }

  async function deleteKey() {
    if (!confirm("Remover chave Anthropic? Classificacao AI e analise de risco ficarao indisponiveis.")) return;
    await fetch("/api/anthropic", { method: "DELETE" });
    load();
    setTestResult(null);
  }

  async function test() {
    setTesting(true);
    setError(null);
    setTestResult(null);

    const res = await fetch("/api/anthropic/test", { method: "POST" });
    const data = await res.json();
    setTesting(false);
    setTestResult(data);
    if (!res.ok) setError(data.error || "Erro no teste");
  }

  async function classifyAll() {
    if (!confirm(
      "Classificar TODAS transacoes pendentes usando Claude AI?\n\n" +
      "Pode demorar alguns minutos. Sera processado em lotes ate terminar.\n\n" +
      "Custo estimado: ~$0.05 por 1000 transacoes."
    )) return;

    setClassifying(true);
    setError(null);
    setClassifyProgress({ classified: 0, remaining: 0, rounds: 0 });

    let totalClassified = 0;
    let rounds = 0;

    while (true) {
      rounds++;
      try {
        const res = await fetch("/api/transactions/classify-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 100 }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Erro");
          break;
        }
        totalClassified += data.classified || 0;
        setClassifyProgress({
          classified: totalClassified,
          remaining: data.remaining || 0,
          rounds,
        });
        // Para se nao processou nada ou nao tem mais
        if (data.processed === 0 || data.remaining === 0) break;
        // Pausa de 1s entre rounds pra nao sobrecarregar
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err: any) {
        setError(err.message);
        break;
      }
    }

    setClassifying(false);
  }

  return (
    <div className="space-y-4">
      {/* Status atual */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          <h3 className="font-semibold">Anthropic Claude API</h3>
        </div>
        <div className="card-body space-y-3">
          {loading ? (
            <div className="text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin inline mr-2" />
              Verificando configuracao...
            </div>
          ) : status?.has_key ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-green-600" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-sm text-green-900">Chave configurada</p>
                <p className="text-xs text-slate-500">
                  Origem: {status.source === "database" ? "Banco de dados (configurada aqui)" : "Variavel de ambiente Vercel"}
                  {status.masked && ` • ${status.masked}`}
                </p>
              </div>
              <button
                onClick={test}
                disabled={testing}
                className="btn-secondary text-xs inline-flex items-center gap-2"
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Testar
              </button>
              {status.source === "database" && (
                <button
                  onClick={deleteKey}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remover chave"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 bg-amber-50 p-3 rounded-lg">
              <AlertTriangle className="text-amber-600 mt-0.5" size={18} />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">Chave nao configurada</p>
                <p className="text-amber-700 text-xs mt-1">
                  Sem chave, classificacao AI e analise de risco usam apenas regras locais.
                </p>
              </div>
            </div>
          )}

          {/* Resultado do teste */}
          {testResult?.ok && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs space-y-1">
              <p className="font-semibold text-green-900 flex items-center gap-2">
                <CheckCircle2 size={14} /> Conexao OK!
              </p>
              <p className="text-green-800">Modelo: <code>{testResult.model}</code></p>
              <p className="text-green-800">
                Tokens: input {testResult.usage?.input_tokens} • output {testResult.usage?.output_tokens}
              </p>
              <p className="text-green-700 italic mt-2">"{testResult.sample_response}"</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Configurar nova chave */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold">
            {status?.has_key ? "Substituir chave" : "Configurar chave"}
          </h3>
        </div>
        <div className="card-body space-y-3">
          <div className="text-xs text-slate-600 space-y-2">
            <p>
              <strong>Como obter sua chave:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>
                Acesse{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 underline inline-flex items-center gap-1"
                >
                  console.anthropic.com <ExternalLink size={10} />
                </a>
              </li>
              <li>Crie uma nova API key</li>
              <li>Cole abaixo e clique Salvar</li>
            </ol>
            <p className="text-amber-700 mt-2">
              Custo: Claude Haiku custa ~$0.80/1M tokens input. Classificar 1000 transacoes ≈ $0.05.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="input font-mono text-xs pr-10"
                  placeholder="sk-ant-api03-..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={save}
                disabled={saving || !apiKey}
                className="btn-primary inline-flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Acao: classificar tudo */}
      {status?.has_key && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold flex items-center gap-2">
              <Wand2 size={16} className="text-purple-600" />
              Classificar transacoes pendentes em lote
            </h3>
          </div>
          <div className="card-body space-y-3">
            <p className="text-sm text-slate-600">
              Faz Claude AI ler e categorizar todas as transacoes que estao sem categoria
              ou marcadas como "Revisar". Processa em lotes de 100 transacoes ate terminar.
            </p>

            <button
              onClick={classifyAll}
              disabled={classifying}
              className="btn-primary inline-flex items-center gap-2"
            >
              {classifying ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {classifying
                ? `Processando... (${classifyProgress?.classified || 0} classificadas, ${classifyProgress?.remaining || 0} restantes)`
                : "Classificar tudo agora"}
            </button>

            {classifyProgress && !classifying && classifyProgress.classified > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800 space-y-1">
                <p className="font-semibold flex items-center gap-2">
                  <CheckCircle2 size={14} /> Concluido!
                </p>
                <p>{classifyProgress.classified} transacoes classificadas em {classifyProgress.rounds} rodadas</p>
                {classifyProgress.remaining > 0 ? (
                  <p>{classifyProgress.remaining} ainda precisam de revisao manual (Claude tinha confianca baixa)</p>
                ) : (
                  <p>Tudo categorizado!</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Onde a chave e usada */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold">Onde a chave e usada</h3>
        </div>
        <div className="card-body space-y-2 text-sm">
          <div className="flex items-start gap-3">
            <Sparkles size={14} className="text-purple-600 mt-1 shrink-0" />
            <div>
              <p className="font-medium">Classificacao automatica de transacoes</p>
              <p className="text-xs text-slate-500">
                Apos cada import de CSV. Regras locais matcham primeiro; sem match, Claude classifica.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles size={14} className="text-purple-600 mt-1 shrink-0" />
            <div>
              <p className="font-medium">Analise do indice de risco</p>
              <p className="text-xs text-slate-500">
                Em /admin/risk: gera analise textual + recomendacoes baseadas em saldos, recebiveis e burn.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

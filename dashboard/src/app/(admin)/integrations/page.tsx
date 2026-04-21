import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { isDemoMode } from "@/lib/data/repository";
import {
  Database,
  Banknote,
  Sparkles,
  Workflow,
  CheckCircle2,
  Circle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "database" | "bank" | "ai" | "automation";
  status: "connected" | "pending" | "demo";
  envVars: string[];
  setupUrl?: string;
  setupSteps?: string[];
}

const integrations: Integration[] = [
  {
    id: "supabase",
    name: "Supabase (PostgreSQL)",
    description: "Banco de dados unificado para transacoes, P&L e investidores",
    category: "database",
    status: isDemoMode ? "demo" : "pending",
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    setupUrl: "https://supabase.com/dashboard/projects",
    setupSteps: [
      "Criar projeto novo em supabase.com",
      "SQL Editor > Rodar arquivos /database/001-010.sql na ordem",
      "Settings > API > copiar URL e keys para .env.local",
      "Setar DEMO_MODE=false no ambiente",
    ],
  },
  {
    id: "mercury_dsj",
    name: "Mercury - DSJ Network",
    description: "Conta principal de operacao USD",
    category: "bank",
    status: isDemoMode ? "demo" : "pending",
    envVars: ["MERCURY_API_KEY_DSJ_NETWORK", "MERCURY_ACCOUNT_ID_DSJ_NETWORK"],
    setupUrl: "https://app.mercury.com/settings/tokens",
    setupSteps: [
      "Mercury > Settings > Tokens > Create token",
      "Copiar API key para .env",
      "Anotar account_id da conta DSJ Network",
    ],
  },
  {
    id: "mercury_connect",
    name: "Mercury - DSJ Connect",
    description: "Conta de tecnologia/infra USD",
    category: "bank",
    status: isDemoMode ? "demo" : "pending",
    envVars: ["MERCURY_API_KEY_DSJ_CONNECT", "MERCURY_ACCOUNT_ID_DSJ_CONNECT"],
    setupUrl: "https://app.mercury.com/settings/tokens",
  },
  {
    id: "revolut_dsj",
    name: "Revolut Business - DSJ Network",
    description: "Conta secundaria USD",
    category: "bank",
    status: isDemoMode ? "demo" : "pending",
    envVars: ["REVOLUT_CLIENT_ID", "REVOLUT_PRIVATE_KEY", "REVOLUT_ACCESS_TOKEN_DSJ_NETWORK"],
    setupUrl: "https://business.revolut.com/settings/api",
    setupSteps: [
      "Revolut Business > Settings > API",
      "Configurar OAuth2 com certificate (sandbox primeiro)",
      "Salvar refresh_token + access_token no .env",
    ],
  },
  {
    id: "revolut_universal",
    name: "Revolut Business - Universal MKT",
    description: "Conta UK GBP",
    category: "bank",
    status: isDemoMode ? "demo" : "pending",
    envVars: ["REVOLUT_ACCESS_TOKEN_UNIVERSAL"],
    setupUrl: "https://business.revolut.com/settings/api",
  },
  {
    id: "airwallex",
    name: "Airwallex - Universal MKT",
    description: "Conta principal UK GBP",
    category: "bank",
    status: isDemoMode ? "demo" : "pending",
    envVars: ["AIRWALLEX_CLIENT_ID", "AIRWALLEX_API_KEY"],
    setupUrl: "https://www.airwallex.com/app/settings/api",
    setupSteps: [
      "Airwallex > Settings > API",
      "Generate new API credentials",
      "Salvar client_id + api_key no .env",
    ],
  },
  {
    id: "anthropic",
    name: "Claude API (Anthropic)",
    description: "Classificacao automatica de transacoes via Claude Haiku",
    category: "ai",
    status: isDemoMode ? "demo" : "pending",
    envVars: ["ANTHROPIC_API_KEY"],
    setupUrl: "https://console.anthropic.com/settings/keys",
    setupSteps: [
      "console.anthropic.com > Settings > API Keys",
      "Create Key > copiar para .env",
      "Modelo padrao: claude-3-5-haiku-20241022",
    ],
  },
  {
    id: "n8n",
    name: "N8N (Orquestrador)",
    description: "Workflows automaticos: sync bancos, geracao P&L, deteccao intercompany",
    category: "automation",
    status: isDemoMode ? "demo" : "pending",
    envVars: ["N8N_WEBHOOK_BASE_URL"],
    setupUrl: "https://n8n.io",
    setupSteps: [
      "Subir N8N (n8n cloud ou self-hosted)",
      "Importar workflows de /workflows/*.json",
      "Configurar credenciais de cada banco no N8N",
      "Ativar cron triggers (1h sync, mensal P&L)",
    ],
  },
];

const CATEGORY_INFO = {
  database: { label: "Banco de Dados", icon: Database, color: "blue" },
  bank: { label: "Bancos", icon: Banknote, color: "green" },
  ai: { label: "Inteligencia Artificial", icon: Sparkles, color: "purple" },
  automation: { label: "Automacao", icon: Workflow, color: "amber" },
} as const;

export default function IntegrationsPage() {
  const grouped = integrations.reduce((acc, int) => {
    (acc[int.category] = acc[int.category] || []).push(int);
    return acc;
  }, {} as Record<string, Integration[]>);

  const connected = integrations.filter((i) => i.status === "connected").length;
  const total = integrations.length;

  return (
    <>
      <Header
        title="Integracoes"
        subtitle={`${connected}/${total} conectadas`}
      />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Status geral */}
        {isDemoMode && (
          <div className="card card-body bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-amber-600 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Sistema rodando em modo demo</p>
                <p className="text-sm text-amber-700 mt-1">
                  Quando voce conectar Supabase + bancos reais, ative o modo producao setando{" "}
                  <code className="bg-amber-100 px-1 rounded">DEMO_MODE=false</code>{" "}
                  na sua variavel de ambiente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de integrações por categoria */}
        {Object.entries(CATEGORY_INFO).map(([catKey, info]) => {
          const items = grouped[catKey] || [];
          if (items.length === 0) return null;
          const Icon = info.icon;

          return (
            <div key={catKey} className="card">
              <div className="card-header flex items-center gap-2">
                <Icon size={18} className="text-slate-600" />
                <h3 className="font-semibold">{info.label}</h3>
                <Badge variant="neutral">{items.length}</Badge>
              </div>
              <div className="divide-y divide-slate-100">
                {items.map((int) => (
                  <IntegrationRow key={int.id} integration={int} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function IntegrationRow({ integration }: { integration: Integration }) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          {integration.status === "connected" ? (
            <CheckCircle2 className="text-green-600 mt-1 shrink-0" size={20} />
          ) : (
            <Circle className="text-slate-300 mt-1 shrink-0" size={20} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{integration.name}</h4>
              {integration.status === "demo" && <Badge variant="warning">Demo</Badge>}
              {integration.status === "pending" && <Badge variant="neutral">Pendente</Badge>}
              {integration.status === "connected" && <Badge variant="success">Conectado</Badge>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{integration.description}</p>

            <div className="mt-3 flex flex-wrap gap-1">
              {integration.envVars.map((v) => (
                <code
                  key={v}
                  className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono"
                >
                  {v}
                </code>
              ))}
            </div>

            {integration.setupSteps && (
              <details className="mt-3 group">
                <summary className="text-xs font-medium text-brand-600 cursor-pointer hover:underline">
                  Como configurar
                </summary>
                <ol className="mt-2 ml-1 space-y-1 text-xs text-slate-600 list-decimal list-inside">
                  {integration.setupSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {integration.setupUrl && (
            <a
              href={integration.setupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-brand-600 flex items-center gap-1"
            >
              Abrir <ExternalLink size={12} />
            </a>
          )}
          <button className="btn-secondary text-xs" disabled>
            Conectar
          </button>
        </div>
      </div>
    </div>
  );
}

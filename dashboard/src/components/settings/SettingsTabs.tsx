"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsForms } from "./SettingsForms";
import { CategoriesEditor } from "./CategoriesEditor";
import { RevolutSetup } from "@/components/integrations/RevolutSetup";
import { Building2, Plug, ScrollText, Tags, Loader2, Save, AlertTriangle, CheckCircle, Eye } from "lucide-react";

interface AccountOpt {
  id: string;
  entity_id: string;
  bank_name: string;
  currency: string;
}

interface Props {
  activeTab: "entities" | "integrations" | "contract" | "categories";
  entities: any[];
  revolutAccounts: AccountOpt[];
}

export function SettingsTabs(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}

function Inner({ activeTab, entities, revolutAccounts }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState(activeTab);

  function changeTab(newTab: typeof tab) {
    setTab(newTab);
    const next = new URLSearchParams(params.toString());
    if (newTab === "entities") next.delete("tab");
    else next.set("tab", newTab);
    router.push(`/admin/settings${next.toString() ? "?" + next.toString() : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === "entities"} onClick={() => changeTab("entities")} icon={<Building2 size={14} />}>
          Empresas e contas
        </TabButton>
        <TabButton active={tab === "categories"} onClick={() => changeTab("categories")} icon={<Tags size={14} />}>
          Categorias
        </TabButton>
        <TabButton active={tab === "integrations"} onClick={() => changeTab("integrations")} icon={<Plug size={14} />}>
          Integracoes
        </TabButton>
        <TabButton active={tab === "contract"} onClick={() => changeTab("contract")} icon={<ScrollText size={14} />}>
          Contrato SCP
        </TabButton>
      </div>

      {tab === "entities" && <SettingsForms entities={entities} />}
      {tab === "categories" && <CategoriesEditor />}
      {tab === "integrations" && <RevolutSetup accounts={revolutAccounts} />}
      {tab === "contract" && <ContractEditor />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2 ${
        active
          ? "border-brand-600 text-brand-600"
          : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function ContractEditor() {
  const [contractText, setContractText] = useState("");
  const [version, setVersion] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    fetch("/api/settings?key=contract_template")
      .then((r) => r.json())
      .then((d) => { setContractText(d.value || ""); setLoading(false); });
    fetch("/api/settings?key=contract_version")
      .then((r) => r.json())
      .then((d) => setVersion(d.value || "0"));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "contract_template", value: contractText }),
    });
    setSaving(false);
    setSaved(true);
    setVersion(String(Number(version) + 1));
    setTimeout(() => setSaved(false), 3000);
  }

  const isEmpty = !contractText.trim();
  const wordCount = contractText.trim() ? contractText.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-4">
      {!loading && isEmpty && (
        <div className="card card-body bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-amber-900">Contrato nao configurado</p>
              <p className="text-sm text-amber-700 mt-1">
                Cole o contrato SCP elaborado pela advogada. Investidores nao conseguirao
                assinar sem ele configurado.
              </p>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="card card-body bg-green-50 border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={18} />
            <p className="text-sm text-green-800 font-medium">
              Contrato salvo! Versao {version}.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Texto do contrato</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Versao: {version}</span>
            <span>{wordCount} palavras</span>
          </div>
        </div>
        <div className="card-body space-y-4">
          <div className="text-xs text-slate-500 space-y-1">
            <p><strong>Variaveis automaticas:</strong></p>
            <div className="grid grid-cols-2 gap-2 mt-1 p-2 bg-slate-50 rounded text-xs">
              <code>{"{{investor_name}}"}</code><span>Nome do investidor</span>
              <code>{"{{investor_cpf}}"}</code><span>CPF</span>
              <code>{"{{amount}}"}</code><span>Valor investido</span>
              <code>{"{{interest_rate}}"}</code><span>Taxa de juros</span>
              <code>{"{{redemption_days}}"}</code><span>Prazo</span>
              <code>{"{{expected_return}}"}</code><span>Retorno esperado</span>
              <code>{"{{date}}"}</code><span>Data</span>
              <code>{"{{contract_hash}}"}</code><span>Hash de integridade</span>
            </div>
            <p className="mt-2">Use <code>##</code> para titulos e <code>**texto**</code> para negrito.</p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
              <Loader2 size={18} className="animate-spin" /> Carregando...
            </div>
          ) : (
            <textarea
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
              className="input font-mono text-xs leading-relaxed"
              rows={20}
              placeholder="Cole aqui o contrato SCP..."
            />
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving || loading} className="btn-primary inline-flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setPreview(!preview)} disabled={isEmpty} className="btn-secondary inline-flex items-center gap-2">
              <Eye size={14} />
              {preview ? "Fechar preview" : "Preview"}
            </button>
          </div>
        </div>
      </div>

      {preview && !isEmpty && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Preview</h3></div>
          <div className="card-body">
            <div className="bg-slate-50 rounded-lg p-6 max-h-96 overflow-y-auto text-sm leading-relaxed">
              {contractText.split("\n").map((line, i) => {
                if (!line.trim()) return <br key={i} />;
                if (line.startsWith("##")) {
                  return <h3 key={i} className="font-bold text-base mt-4 mb-2">{line.replace(/^#+\s*/, "")}</h3>;
                }
                const html = line
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\{\{(\w+)\}\}/g, '<span class="bg-amber-100 px-1 rounded text-amber-800">[$1]</span>');
                return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: html }} />;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

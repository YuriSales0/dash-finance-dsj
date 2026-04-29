"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { FileText, Save, Loader2, AlertTriangle, CheckCircle, Eye } from "lucide-react";

export default function ContractPage() {
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
    <>
      <Header
        title="Contrato SCP"
        subtitle="Texto do contrato que o investidor assina"
      />
      <div className="p-6 max-w-4xl space-y-6">
        {/* Alerta se contrato vazio */}
        {!loading && isEmpty && (
          <div className="card card-body bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-amber-900">Contrato nao configurado</p>
                <p className="text-sm text-amber-700 mt-1">
                  Voce precisa adicionar o texto do contrato SCP antes de gerar convites para investidores.
                  Cole o contrato elaborado pela sua advogada no campo abaixo.
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
                Contrato salvo! Versao {version}. Novos investidores verao esta versao.
              </p>
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-slate-600" />
              <h3 className="font-semibold">Texto do contrato</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Versao: {version}</span>
              <span>{wordCount} palavras</span>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div className="text-xs text-slate-500 space-y-1">
              <p><strong>Instrucoes:</strong></p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Cole o contrato completo da advogada abaixo</li>
                <li>Use linhas em branco para separar paragrafos</li>
                <li>Linhas que comecam com <code className="bg-slate-100 px-1 rounded">##</code> viram titulos</li>
                <li>Texto entre <code className="bg-slate-100 px-1 rounded">**</code> fica em negrito</li>
                <li>Variaveis automaticas que serao substituidas:</li>
              </ul>
              <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-slate-50 rounded">
                <code className="text-xs">{"{{investor_name}}"}</code><span className="text-xs">Nome do investidor</span>
                <code className="text-xs">{"{{investor_cpf}}"}</code><span className="text-xs">CPF do investidor</span>
                <code className="text-xs">{"{{amount}}"}</code><span className="text-xs">Valor investido</span>
                <code className="text-xs">{"{{interest_rate}}"}</code><span className="text-xs">Taxa de juros (%)</span>
                <code className="text-xs">{"{{redemption_days}}"}</code><span className="text-xs">Prazo em dias</span>
                <code className="text-xs">{"{{expected_return}}"}</code><span className="text-xs">Retorno esperado</span>
                <code className="text-xs">{"{{date}}"}</code><span className="text-xs">Data da assinatura</span>
                <code className="text-xs">{"{{contract_hash}}"}</code><span className="text-xs">Hash de integridade</span>
              </div>
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
                rows={25}
                placeholder="Cole aqui o contrato completo elaborado pela advogada..."
              />
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="btn-primary inline-flex items-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Salvando..." : "Salvar contrato"}
              </button>
              <button
                onClick={() => setPreview(!preview)}
                disabled={isEmpty}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Eye size={14} />
                {preview ? "Fechar preview" : "Preview"}
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {preview && !isEmpty && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold">Preview (como o investidor vera)</h3>
            </div>
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
    </>
  );
}

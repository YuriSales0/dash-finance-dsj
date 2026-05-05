"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  FileText,
  Check,
  Loader2,
  AlertTriangle,
  User,
  CreditCard,
  Edit3,
  Save,
} from "lucide-react";

interface InvestorMe {
  id: number;
  name: string;
  cpf: string;
  email: string;
  phone: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  status: string;
}

interface Product {
  receivable_id: number;
  currency: string;
  amount_total: number;
  interest_rate: number;
  redemption_days: number;
  min_amount: number;
  max_amount: number | null;
  financing_terms: string | null;
  due_date: string;
  entity_id: string;
  entity_name: string;
}

export default function ContractPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();
  const [amount, setAmount] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [investor, setInvestor] = useState<InvestorMe | null>(null);
  const [contractTemplate, setContractTemplate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    phone: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    pix_key: "",
  });
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/invites/product?code=${code}`).then(async (r) => {
        if (r.status === 401) {
          router.replace(`/invest/${code}/register`);
          return null;
        }
        if (r.status === 403) {
          setError(
            "Cadastro pendente de aprovacao. Aguarde a equipe DSJ aprovar antes de assinar contratos."
          );
          return null;
        }
        if (!r.ok) {
          setError("Convite invalido ou expirado");
          return null;
        }
        return r.json();
      }),
      fetch("/api/investor/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings?key=contract_template").then((r) =>
        r.ok ? r.json() : { value: "" }
      ),
    ])
      .then(([prod, me, settings]) => {
        if (prod) {
          setProduct(prod);
          setIsAuthorized(true);
        }
        if (me) {
          setInvestor(me);
          setBankForm({
            phone: me.phone || "",
            bank_name: me.bank_name || "",
            bank_agency: me.bank_agency || "",
            bank_account: me.bank_account || "",
            pix_key: me.pix_key || "",
          });
        }
        setContractTemplate(settings?.value || DEFAULT_TEMPLATE);
      })
      .catch(() => setError("Erro de conexao"))
      .finally(() => setAuthChecked(true));
  }, [code, router]);

  const numAmount = Number(amount) || 0;
  const rate = product?.interest_rate || 0;
  const days = product?.redemption_days || 0;
  const expectedReturn = numAmount * (1 + rate / 100);
  const currency = product?.currency || "USD";
  const redemptionDate = new Date();
  redemptionDate.setDate(redemptionDate.getDate() + days);

  // Validacao KYC: tem dados bancarios pra receber retorno?
  const bankComplete = !!(
    investor &&
    ((investor.bank_name && investor.bank_account) || investor.pix_key)
  );

  // Validacao de valor
  const minAmount = product?.min_amount || 0;
  const maxAmount = product?.max_amount;
  const available = product ? product.amount_total : 0;
  const amountInRange =
    numAmount >= minAmount &&
    (maxAmount == null || numAmount <= maxAmount) &&
    numAmount <= available;

  const canSign = accepted && numAmount > 0 && amountInRange && bankComplete && !!product && !!investor;

  async function saveBankInfo() {
    setSavingBank(true);
    setError(null);
    const res = await fetch("/api/investor/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bankForm),
    });
    setSavingBank(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro" }));
      setError(data.error || "Falha ao salvar dados bancarios");
      return;
    }
    // Refresh investor
    const me = await fetch("/api/investor/me").then((r) => (r.ok ? r.json() : null));
    if (me) setInvestor(me);
    setEditingBank(false);
  }

  async function handleSign() {
    if (!canSign) return;
    setError(null);
    setLoading(true);

    const res = await fetch("/api/financings/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receivable_id: product?.receivable_id,
        amount_invested: numAmount,
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

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="card card-body max-w-md text-center py-12">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-amber-600" size={32} />
          </div>
          <h1 className="text-xl font-bold mb-2">Acesso nao autorizado</h1>
          <p className="text-sm text-slate-600">
            {error || "Voce nao pode assinar contratos no momento."}
          </p>
        </div>
      </div>
    );
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
            Retorno: <strong>{formatCurrency(expectedReturn, currency)}</strong> em{" "}
            {days} dias
          </p>
          <p className="text-xs text-slate-400">Redirecionando para seu painel...</p>
        </div>
      </div>
    );
  }

  // Substituir placeholders no template do contrato
  const renderedContract = renderContract(contractTemplate, {
    investor_name: investor?.name || "[seu nome]",
    investor_cpf: investor?.cpf || "[seu CPF]",
    investor_email: investor?.email || "[seu email]",
    investor_phone: investor?.phone || "[seu telefone]",
    investor_bank_name: investor?.bank_name || "[banco]",
    investor_bank_agency: investor?.bank_agency || "[agencia]",
    investor_bank_account: investor?.bank_account || "[conta]",
    investor_pix_key: investor?.pix_key || "[PIX]",
    amount: numAmount > 0 ? formatCurrency(numAmount, currency) : "[valor]",
    currency,
    interest_rate: String(rate),
    redemption_days: String(days),
    redemption_date: formatDate(redemptionDate.toISOString()),
    expected_return:
      numAmount > 0 ? formatCurrency(expectedReturn, currency) : "[retorno]",
    receivable_id: product ? `#${product.receivable_id}` : "[#operacao]",
    entity_name: product?.entity_name || "[empresa emissora]",
    due_date: product?.due_date ? formatDate(product.due_date) : "[vencimento]",
    financing_terms: product?.financing_terms || "[termos da operacao]",
    date: new Date().toLocaleDateString("pt-BR"),
    contract_hash: "[gerado na assinatura]",
  });

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl mb-3">
            <FileText className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold">Contrato de Investimento</h1>
          <p className="text-sm text-slate-500 mt-1">
            Sociedade em Conta de Participacao (SCP)
          </p>
        </div>

        {/* Resumo da operacao */}
        {product && (
          <div className="card card-body bg-slate-50 border-slate-200">
            <h3 className="font-semibold text-sm mb-2">Resumo da operacao</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Stat label="Operacao">
                #{product.receivable_id} ({product.currency})
              </Stat>
              <Stat label="Empresa emissora">{product.entity_name}</Stat>
              <Stat label="Taxa">{product.interest_rate}% no periodo</Stat>
              <Stat label="Prazo">
                {product.redemption_days} dias (resgate em {formatDate(redemptionDate.toISOString())})
              </Stat>
            </div>
            {product.financing_terms && (
              <p className="text-xs text-slate-700 bg-white rounded p-2 mt-3 italic">
                {product.financing_terms}
              </p>
            )}
          </div>
        )}

        {/* Card de identificacao do investidor */}
        {investor && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <User size={16} className="text-blue-600" />
                Seus dados pra o contrato
              </h3>
              {!editingBank && (
                <button
                  onClick={() => setEditingBank(true)}
                  className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                >
                  <Edit3 size={12} /> Editar dados bancarios
                </button>
              )}
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <Field label="Nome" value={investor.name} />
                <Field label="CPF" value={investor.cpf} />
                <Field label="Email" value={investor.email} />
                <Field
                  label="Telefone"
                  value={investor.phone || "—"}
                  warn={!investor.phone}
                />
              </div>

              {!editingBank ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <Field
                    label="Banco / Agencia / Conta"
                    value={
                      investor.bank_name && investor.bank_account
                        ? `${investor.bank_name} · Ag ${investor.bank_agency || "—"} · CC ${investor.bank_account}`
                        : "—"
                    }
                    warn={!investor.bank_account && !investor.pix_key}
                  />
                  <Field
                    label="Chave PIX"
                    value={investor.pix_key || "—"}
                    warn={!investor.pix_key && !investor.bank_account}
                  />
                </div>
              ) : (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-3">
                  <p className="text-xs text-slate-600">
                    Dados bancarios pra receber o retorno. Informe pelo menos PIX
                    ou banco+conta.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <FormField label="Telefone">
                      <input
                        className="input"
                        value={bankForm.phone}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, phone: e.target.value })
                        }
                        placeholder="+55 11 99999-9999"
                      />
                    </FormField>
                    <FormField label="Chave PIX">
                      <input
                        className="input"
                        value={bankForm.pix_key}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, pix_key: e.target.value })
                        }
                        placeholder="email/CPF/celular/aleatoria"
                      />
                    </FormField>
                    <FormField label="Banco">
                      <input
                        className="input"
                        value={bankForm.bank_name}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, bank_name: e.target.value })
                        }
                        placeholder="Itau, Nubank, etc"
                      />
                    </FormField>
                    <FormField label="Agencia">
                      <input
                        className="input"
                        value={bankForm.bank_agency}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, bank_agency: e.target.value })
                        }
                        placeholder="0000"
                      />
                    </FormField>
                    <FormField label="Conta corrente">
                      <input
                        className="input"
                        value={bankForm.bank_account}
                        onChange={(e) =>
                          setBankForm({ ...bankForm, bank_account: e.target.value })
                        }
                        placeholder="00000-0"
                      />
                    </FormField>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveBankInfo}
                      disabled={savingBank}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {savingBank ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Save size={14} />
                      )}
                      Salvar dados
                    </button>
                    <button
                      onClick={() => setEditingBank(false)}
                      className="btn-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!bankComplete && !editingBank && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <p>
                    Voce precisa cadastrar PIX ou conta bancaria antes de assinar — e
                    pra onde a DSJ envia o retorno no vencimento.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Valor do investimento */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold flex items-center gap-2">
              <CreditCard size={16} className="text-green-600" />
              Valor do investimento
            </h3>
          </div>
          <div className="card-body space-y-4">
            <input
              type="number"
              step="0.01"
              className="input text-xl text-center font-mono py-3"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Minimo ${formatCurrency(minAmount, currency)}`}
              min={minAmount}
              max={maxAmount || undefined}
            />
            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>
                Min: <strong>{formatCurrency(minAmount, currency)}</strong>
              </span>
              {maxAmount != null && (
                <span>
                  Max: <strong>{formatCurrency(maxAmount, currency)}</strong>
                </span>
              )}
              <span>
                Disponivel: <strong>{formatCurrency(available, currency)}</strong>
              </span>
            </div>
            {numAmount > 0 && (
              <div className="bg-green-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500">Investimento</p>
                  <p className="font-bold text-lg">{formatCurrency(numAmount, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Juros ({rate}%)</p>
                  <p className="font-bold text-lg text-green-600">
                    +{formatCurrency((numAmount * rate) / 100, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Retorno em {days}d</p>
                  <p className="font-bold text-lg text-green-700">
                    {formatCurrency(expectedReturn, currency)}
                  </p>
                </div>
              </div>
            )}
            {numAmount > 0 && !amountInRange && (
              <p className="text-xs text-red-600">
                Valor fora dos limites permitidos pra esta operacao.
              </p>
            )}
          </div>
        </div>

        {/* Termos do contrato (placeholders ja preenchidos) */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              Termos do contrato
            </h3>
          </div>
          <div className="card-body">
            <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto text-xs text-slate-700 leading-relaxed space-y-2 font-serif">
              {renderedContract}
            </div>

            <label className="flex items-start gap-3 mt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1 rounded"
              />
              <span className="text-sm text-slate-700">
                Li e aceito os termos do contrato de Sociedade em Conta de
                Participacao (SCP). Confirmo que estou ciente dos riscos
                apresentados, que os dados acima estao corretos e autorizo a DSJ a
                executar a operacao com base no valor informado.
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
          disabled={!canSign || loading}
          className="btn-primary w-full py-3 text-lg inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading
            ? "Assinando..."
            : !bankComplete
            ? "Cadastre dados bancarios pra continuar"
            : !accepted
            ? "Marque a declaracao acima pra assinar"
            : numAmount <= 0
            ? "Informe o valor do investimento"
            : !amountInRange
            ? "Valor fora dos limites permitidos"
            : "Assinar contrato e confirmar investimento"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="font-semibold text-xs">{children}</p>
    </div>
  );
}

function Field({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-medium text-sm ${warn ? "text-amber-700" : ""}`}>{value}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function renderContract(template: string, vars: Record<string, string>): React.ReactNode {
  let text = template;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }
  return text.split("\n").map((line, i) => {
    if (!line.trim()) return <br key={i} />;
    if (line.startsWith("##"))
      return (
        <p key={i} className="font-bold mt-3 mb-1 text-slate-900">
          {line.replace(/^#+\s*/, "")}
        </p>
      );
    const html = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

const DEFAULT_TEMPLATE = `## CONTRATO DE INVESTIMENTO — SOCIEDADE EM CONTA DE PARTICIPACAO (SCP)

**SOCIO INVESTIDOR:** {{investor_name}}, CPF {{investor_cpf}}, contato {{investor_email}} / {{investor_phone}}.

**SOCIO OSTENSIVO:** {{entity_name}}, responsavel pela operacao SCP referente a Operacao {{receivable_id}}.

**DATA DA ASSINATURA:** {{date}}

## 1. OBJETO

O Socio Investidor compromete-se a aportar **{{amount}}** ({{currency}}) na operacao SCP de identificador {{receivable_id}}, sob administracao exclusiva do Socio Ostensivo.

## 2. CONDICOES DA OPERACAO

- Taxa de juros: **{{interest_rate}}%** sobre o valor aportado, no periodo da operacao
- Prazo: **{{redemption_days}}** dias a partir da assinatura
- Data prevista de resgate: **{{redemption_date}}**
- Vencimento do recebivel subjacente: **{{due_date}}**
- Retorno esperado total: **{{expected_return}}** ({{currency}})

## 3. TERMOS ESPECIFICOS DA OPERACAO

{{financing_terms}}

## 4. PAGAMENTO DO RETORNO

O retorno total ({{expected_return}}) sera depositado na conta indicada pelo Socio Investidor ate o final do dia util seguinte ao recebimento do recebivel pela DSJ:

- Banco: {{investor_bank_name}}
- Agencia: {{investor_bank_agency}}
- Conta: {{investor_bank_account}}
- PIX: {{investor_pix_key}}

## 5. RISCOS

O Socio Investidor declara estar ciente que:

- A operacao envolve risco de credito da contraparte do recebivel subjacente
- Eventos como chargebacks, default ou inadimplencia podem reduzir ou anular o retorno
- O capital fica vinculado a operacao ate o vencimento, sem possibilidade de resgate antecipado
- O Socio Investidor NAO participa da gestao operacional da DSJ

## 6. AUTENTICACAO E AUDITORIA

Este contrato e assinado digitalmente. Sua integridade e validada pelo hash SHA-256 abaixo, armazenado de forma imutavel no sistema da DSJ:

**Hash do contrato:** {{contract_hash}}

A qualquer momento, o Socio Investidor pode auditar a integridade do contrato consultando o endpoint /api/financings/[id]/verify.

## 7. JURISDICAO

Este contrato e regido pelas leis aplicaveis a {{entity_name}} e ao Codigo Civil Brasileiro (artigos 991 a 996, sobre Sociedade em Conta de Participacao).

---

Ao marcar "Li e aceito" e clicar em "Assinar contrato", o Socio Investidor declara que leu, compreendeu e concorda com todas as clausulas acima, autorizando a DSJ a executar a operacao no valor de {{amount}}.
`;

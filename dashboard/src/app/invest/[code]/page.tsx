import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode, repository } from "@/lib/data/repository";
import { formatCurrency, formatDate } from "@/lib/format";
import { calculateExpectedReturn, effectivePeriodRatePct } from "@/lib/finance/return";
import { getSession } from "@/lib/supabase/session";
import Link from "next/link";
import {
  ShieldCheck,
  TrendingUp,
  Calendar,
  Clock,
  ArrowRight,
  Building2,
  CheckCircle2,
  Hourglass,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DSJ Finance — Convite de Investimento",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InviteLandingPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { registered?: string };
}) {
  const { code } = params;
  const justRegistered = searchParams.registered === "1";

  let invite: any = null;
  let receivable: any = null;
  let entityName: string | null = null;
  let investorStatus: "guest" | "pending" | "approved" | "rejected" = "guest";

  if (!isDemoMode) {
    const sb = createServerClient();
    const { data: inv } = await sb
      .from("invite_codes")
      .select("*")
      .eq("code", code)
      .single();
    invite = inv;

    if (invite?.receivable_id) {
      const { data: recv } = await sb
        .from("receivables")
        .select("*")
        .eq("id", invite.receivable_id)
        .single();
      receivable = recv;
      if (recv?.entity_id) {
        const { data: ent } = await sb
          .from("entities")
          .select("name")
          .eq("id", (recv as any).entity_id)
          .single();
        entityName = (ent as any)?.name || null;
      }
    }

    // Detectar se ja ha sessao de investidor — ajusta CTA da pagina
    const session = await getSession();
    if (session?.role === "investor") {
      const { data: me } = await sb
        .from("investors")
        .select("status")
        .eq("auth_user_id", session.user.id)
        .single();
      if (me) investorStatus = (me as any).status;
    }
  } else {
    invite = {
      code,
      investor_name: "Investidor Demo",
      message: "Oportunidade exclusiva de antecipacao de recebiveis validados.",
    };
    const recvs = await repository.getReceivables({ open_for_financing: true });
    receivable = recvs.find((r) => r.status !== "paid") || null;
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="max-w-sm text-center text-white">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="text-slate-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Convite invalido</h1>
          <p className="text-sm text-slate-400">
            Este link expirou ou ja foi utilizado. Entre em contato com a DSJ para um
            novo convite.
          </p>
        </div>
      </div>
    );
  }

  // Pre-calcular numeros do produto
  let productTexts: {
    rate: number;
    days: number;
    minAmount: number;
    exampleAmount: number;
    exampleReturn: number;
    periodRate: number;
  } | null = null;
  if (receivable) {
    const rate = receivable.financing_interest_rate_pct || 0;
    const days = receivable.financing_redemption_days || 0;
    const minAmount = receivable.financing_min_amount || 1000;
    productTexts = {
      rate,
      days,
      minAmount,
      exampleAmount: minAmount,
      exampleReturn: calculateExpectedReturn(minAmount, rate, days),
      periodRate: effectivePeriodRatePct(rate, days),
    };
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-12 pb-8 text-center text-white">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-1.5 rounded-full text-xs mb-6">
          <ShieldCheck size={14} /> Convite exclusivo · DSJ Finance
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          Antecipacao de Recebiveis
        </h1>
        <p className="text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
          {invite.message ||
            "Invista em recebiveis ja capturados de operacoes validadas de e-commerce com retorno fixo e prazo curto."}
        </p>
        {invite.investor_name && (
          <p className="text-sm text-slate-400 mt-5">
            Preparado especialmente para{" "}
            <strong className="text-white">{invite.investor_name}</strong>
          </p>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16 space-y-6">
        {/* Status pos-registro */}
        {(justRegistered || investorStatus === "pending") && (
          <div className="bg-amber-500/15 backdrop-blur border border-amber-400/30 rounded-xl p-5 flex items-start gap-3 text-amber-100">
            <Hourglass className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold">Cadastro recebido — aguardando aprovacao</p>
              <p className="text-sm mt-1 text-amber-100/80">
                Voce ja esta na nossa base. A equipe DSJ valida cadastros novos
                manualmente em ate 1 dia util. Volte a este link assim que receber a
                confirmacao por email pra prosseguir com a assinatura do contrato.
              </p>
            </div>
          </div>
        )}

        {investorStatus === "approved" && receivable && (
          <div className="bg-green-500/15 backdrop-blur border border-green-400/30 rounded-xl p-5 flex items-start gap-3 text-green-100">
            <CheckCircle2 className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold">Cadastro aprovado</p>
              <p className="text-sm mt-1 text-green-100/80">
                Voce ja pode assinar o contrato e finalizar a contratacao.
              </p>
            </div>
          </div>
        )}

        {/* Produto */}
        {receivable && (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-brand-600 to-brand-500 text-white px-6 py-5">
              <p className="text-brand-100 text-xs uppercase tracking-wide font-medium">
                Produto disponivel
              </p>
              <h2 className="text-2xl font-bold mt-1">
                Operacao #{receivable.id} ({receivable.currency})
              </h2>
              {entityName && (
                <p className="text-brand-100 text-sm mt-1 flex items-center gap-1.5">
                  <Building2 size={14} />
                  {entityName}
                </p>
              )}
            </div>

            <div className="p-6">
              {receivable.financing_terms && (
                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg mb-6 leading-relaxed">
                  {receivable.financing_terms}
                </p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <ProductStat icon={<TrendingUp size={16} />} label="Taxa de juros">
                  {receivable.financing_interest_rate_pct}% ao mes
                </ProductStat>
                <ProductStat icon={<Clock size={16} />} label="Prazo">
                  {receivable.financing_redemption_days} dias
                </ProductStat>
                <ProductStat icon={<Calendar size={16} />} label="Vencimento">
                  {formatDate(receivable.due_date)}
                </ProductStat>
                <ProductStat label="Investimento minimo">
                  {formatCurrency(
                    receivable.financing_min_amount || 0,
                    receivable.currency
                  )}
                </ProductStat>
              </div>

              {productTexts && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6">
                  <p className="text-xs font-medium text-green-800 uppercase tracking-wide mb-1">
                    Exemplo de retorno
                  </p>
                  <p className="text-sm text-green-900">
                    Investindo{" "}
                    <strong>
                      {formatCurrency(productTexts.exampleAmount, receivable.currency)}
                    </strong>
                    , voce recebe{" "}
                    <strong className="text-lg">
                      {formatCurrency(productTexts.exampleReturn, receivable.currency)}
                    </strong>{" "}
                    em {productTexts.days} dias.
                  </p>
                  <p className="text-xs text-green-700 mt-1.5">
                    Taxa de {productTexts.rate}% ao mes (juros compostos) ={" "}
                    {productTexts.periodRate.toFixed(2)}% no periodo.
                  </p>
                </div>
              )}

              {investorStatus === "approved" ? (
                <Link
                  href={`/invest/${code}/contract`}
                  className="btn-primary w-full text-center inline-flex items-center justify-center gap-2 py-3 text-lg"
                >
                  Assinar contrato e investir <ArrowRight size={20} />
                </Link>
              ) : investorStatus === "pending" ? (
                <button
                  disabled
                  className="btn-primary w-full text-center inline-flex items-center justify-center gap-2 py-3 text-lg opacity-50 cursor-not-allowed"
                >
                  Aguardando aprovacao
                </button>
              ) : (
                <Link
                  href={`/invest/${code}/register`}
                  className="btn-primary w-full text-center inline-flex items-center justify-center gap-2 py-3 text-lg"
                >
                  Quero investir <ArrowRight size={20} />
                </Link>
              )}
            </div>
          </div>
        )}

        {!receivable && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <p className="text-slate-500 mb-4">
              Este convite nao tem um produto vinculado. Crie sua conta para ver as
              oportunidades disponiveis.
            </p>
            <Link
              href={`/invest/${code}/register`}
              className="btn-primary inline-flex items-center gap-2"
            >
              Criar conta <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {/* Processo */}
        <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
          <h3 className="text-white font-semibold mb-5">Como funciona</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Step n={1} title="Criar conta" desc="Preencha seus dados pessoais e bancarios" />
            <Step n={2} title="Aguardar aprovacao" desc="DSJ valida cadastro manualmente" />
            <Step n={3} title="Assinar contrato" desc="Contrato digital com hash SHA-256" />
            <Step n={4} title="Receber retorno" desc="Pagamento na data programada" />
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          Acesso restrito por convite. Sociedade em Conta de Participacao (SCP) regida
          pelo Codigo Civil Brasileiro.
        </p>
      </div>
    </div>
  );
}

function ProductStat({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wide mb-1 font-medium">
        {icon}
        {label}
      </div>
      <p className="font-bold text-base">{children}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="w-9 h-9 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-2 shadow-lg shadow-brand-600/30">
        {n}
      </div>
      <p className="text-white font-semibold text-sm">{title}</p>
      <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
    </div>
  );
}

import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode, repository } from "@/lib/data/repository";
import { formatCurrency, formatDate } from "@/lib/format";
import { calculateExpectedReturn, effectivePeriodRatePct } from "@/lib/finance/return";
import Link from "next/link";
import { ShieldCheck, TrendingUp, Calendar, Clock, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DSJ Finance — Convite de Investimento",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InviteLandingPage({
  params,
}: {
  params: { code: string };
}) {
  const { code } = params;

  let invite: any = null;
  let receivable: any = null;
  let metrics: any = null;

  if (!isDemoMode) {
    const sb = createServerClient();
    const { data: inv } = await sb
      .from("invite_codes")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .is("used_by", null)
      .single();
    invite = inv;

    if (invite?.receivable_id) {
      const { data: recv } = await sb
        .from("receivables")
        .select("*")
        .eq("id", invite.receivable_id)
        .single();
      receivable = recv;
    }
  } else {
    invite = { code, investor_name: "Investidor Demo", message: "Oportunidade exclusiva de antecipacao de recebiveis validados." };
    const recvs = await repository.getReceivables({ open_for_financing: true });
    receivable = recvs.find((r) => r.status !== "paid") || null;
  }

  metrics = await repository.getInvestorMetrics();

  if (!invite) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="card card-body max-w-sm text-center">
          <ShieldCheck className="mx-auto text-slate-400 mb-3" size={40} />
          <h1 className="text-xl font-bold mb-2">Convite invalido</h1>
          <p className="text-sm text-slate-500">
            Este link expirou ou ja foi utilizado. Entre em contato com a DSJ para um novo convite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-10 text-center text-white">
        <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full text-xs mb-6">
          <ShieldCheck size={14} /> Convite exclusivo
        </div>
        <h1 className="text-4xl font-bold mb-3">Antecipacao de Recebiveis</h1>
        <p className="text-lg text-slate-300 max-w-xl mx-auto">
          {invite.message || "Invista em recebiveis ja capturados de operacoes validadas de e-commerce com retorno fixo e prazo curto."}
        </p>
        {invite.investor_name && (
          <p className="text-sm text-slate-400 mt-4">
            Preparado para <strong className="text-white">{invite.investor_name}</strong>
          </p>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-16 space-y-6">
        {/* Numeros da empresa */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Receita mensal" value={formatCurrency(metrics.total_revenue_usd || 0)} />
          <MetricCard label="Meses operando" value={String(metrics.months_operating || 0)} />
          <MetricCard label="Operacoes concluidas" value={String(metrics.opportunities_completed || 0)} />
          <MetricCard label="Perdas" value={String(metrics.opportunities_loss_count || 0)} />
        </div>

        {/* Produto */}
        {receivable && (
          <div className="bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="bg-brand-600 text-white px-6 py-4">
              <h2 className="text-xl font-bold">Produto disponivel</h2>
              <p className="text-brand-100 text-sm mt-1">{receivable.description}</p>
            </div>

            <div className="p-6">
              {receivable.financing_terms && (
                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg mb-6">
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
                <ProductStat icon={<Calendar size={16} />} label="Vencimento do recebivel">
                  {formatDate(receivable.due_date)}
                </ProductStat>
                <ProductStat label="Investimento minimo">
                  {formatCurrency(receivable.financing_min_amount || 0, receivable.currency)}
                </ProductStat>
              </div>

              {(() => {
                const exampleAmount = receivable.financing_min_amount || 1000;
                const rate = receivable.financing_interest_rate_pct || 0;
                const days = receivable.financing_redemption_days || 0;
                const exampleReturn = calculateExpectedReturn(exampleAmount, rate, days);
                const periodRate = effectivePeriodRatePct(rate, days);
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-green-900">
                      <strong>Exemplo:</strong> Investindo{" "}
                      {formatCurrency(exampleAmount, receivable.currency)}, voce recebe{" "}
                      <strong>{formatCurrency(exampleReturn, receivable.currency)}</strong>{" "}
                      em {days} dias.
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Taxa de {rate}% ao mes (juros compostos) ={" "}
                      {periodRate.toFixed(2)}% no periodo.
                    </p>
                  </div>
                );
              })()}

              <Link
                href={`/invest/${code}/register`}
                className="btn-primary w-full text-center inline-flex items-center justify-center gap-2 py-3 text-lg"
              >
                Quero investir <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        )}

        {!receivable && (
          <div className="bg-white rounded-xl shadow-xl p-8 text-center">
            <p className="text-slate-500 mb-4">
              Este convite nao tem um produto vinculado. Crie sua conta para ver as oportunidades disponiveis.
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
        <div className="bg-white/5 backdrop-blur rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Como funciona</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Step n={1} title="Criar conta" desc="Preencha seus dados basicos" />
            <Step n={2} title="Escolher valor" desc="Defina quanto quer investir" />
            <Step n={3} title="Assinar contrato" desc="Contrato digital com termos claros" />
            <Step n={4} title="Receber retorno" desc="Pagamento na data programada" />
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          Acesso restrito por convite. Sociedade em conta de participacao (SCP).
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function ProductStat({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">{icon}{label}</div>
      <p className="font-bold text-lg">{children}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="w-8 h-8 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-2">
        {n}
      </div>
      <p className="text-white font-semibold text-sm">{title}</p>
      <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
    </div>
  );
}

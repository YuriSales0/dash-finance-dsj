"use client";

import Link from "next/link";
import {
  TrendingUp,
  Calendar,
  CheckCircle,
  Award,
  ArrowRight,
  Building2,
  Globe,
  Shield,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Wallet,
  Zap,
  FileSignature,
  TrendingDown,
} from "lucide-react";
import { useState } from "react";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { InvestorRevenueChart } from "@/components/dashboard/InvestorRevenueChart";
import type { InvestorMetrics, MonthlyPnl, Receivable } from "@/types/database";

interface Props {
  metrics: InvestorMetrics | null;
  pnl12m: MonthlyPnl[];
  openReceivables: Receivable[];
  isPreview?: boolean;
  // Permitir que admin sobreescreva o link de "Ver oportunidades"
  opportunitiesHref?: string;
}

export function InvestorHomeView({
  metrics,
  pnl12m,
  openReceivables,
  isPreview = false,
  opportunitiesHref = "/investor/opportunities",
}: Props) {
  // Calcular metricas derivadas a partir do P&L 12m
  const totalRevenue12m = pnl12m.reduce((s, p) => s + (p.revenue || 0), 0);
  const totalCosts12m = pnl12m.reduce((s, p) => s + (p.total_costs || 0), 0);
  const totalProfit12m = totalRevenue12m - totalCosts12m;
  const avgMargin = totalRevenue12m > 0 ? (totalProfit12m / totalRevenue12m) * 100 : 0;
  const profitableMonths = pnl12m.filter((p) => p.net_profit > 0).length;
  const completed = metrics?.opportunities_completed || 0;
  const losses = metrics?.opportunities_loss_count || 0;
  const successRate = completed > 0 ? ((completed - losses) / completed) * 100 : null;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 text-white rounded-xl px-8 py-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-medium mb-4 backdrop-blur">
            <Shield size={12} /> Plataforma privada SCP
          </div>
          <h1 className="text-4xl font-bold mb-3">DSJ Finance</h1>
          <p className="text-slate-300 text-lg max-w-2xl leading-relaxed">
            Antecipacao de recebiveis ja capturados de operacoes de e-commerce
            multi-mercado. Voce financia, a DSJ executa, e voce recebe principal +
            juros no prazo combinado.
          </p>
          <div className="flex gap-3 mt-6 flex-wrap text-xs">
            <Pill icon={<Globe size={11} />}>3 empresas · 4 moedas</Pill>
            <Pill icon={<Building2 size={11} />}>
              {metrics?.months_operating || 0} meses operando
            </Pill>
            <Pill icon={<CheckCircle size={11} />}>
              {completed} operacoes ja completadas
            </Pill>
          </div>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric
          icon={<TrendingUp size={18} />}
          color="green"
          label="Receita mensal"
          value={formatCurrency(metrics?.total_revenue_usd || 0)}
          sub={`${metrics?.margin_pct?.toFixed(0) || 0}% margem media`}
        />
        <Metric
          icon={<Calendar size={18} />}
          color="blue"
          label="Meses operando"
          value={String(metrics?.months_operating || 0)}
          sub={`${profitableMonths}/12 meses lucrativos`}
        />
        <Metric
          icon={<CheckCircle size={18} />}
          color="purple"
          label="Operacoes"
          value={String(completed)}
          sub={
            successRate != null
              ? `${successRate.toFixed(0)}% sucesso`
              : "sem historico ainda"
          }
        />
        <Metric
          icon={<Award size={18} />}
          color="amber"
          label="Capital retornado"
          value={formatCurrency(metrics?.total_capital_returned || 0)}
          sub={
            metrics?.opportunities_avg_return
              ? `${metrics.opportunities_avg_return.toFixed(0)}% retorno medio`
              : "—"
          }
        />
      </div>

      {/* Sobre a operacao */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 size={16} className="text-brand-600" />
            Sobre a operacao
          </h3>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-3 gap-6">
          <EntityCard
            name="DSJ Network LLC"
            jurisdiction="Florida, USA"
            currency="USD"
            description="Operacao primaria de e-commerce. Vendas via Shopify e processamento por Mercury + Revolut."
          />
          <EntityCard
            name="Universal MKT LLP"
            jurisdiction="London, UK"
            currency="GBP / EUR"
            description="Braco europeu, com captacao em Airwallex + Revolut. Atende mercados UK e UE."
          />
          <EntityCard
            name="DSJ Connect LLC"
            jurisdiction="Delaware, USA"
            currency="USD"
            description="Estrutura de suporte. Conta Mercury para flexibilidade operacional."
          />
        </div>
      </div>

      {/* Como funciona o SCP */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2">
            <Zap size={16} className="text-amber-600" />
            Como funciona o SCP
          </h3>
        </div>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-4">
          <Step
            n={1}
            icon={<TrendingUp size={20} />}
            title="DSJ captura"
            text="Operacao gera recebivel real (payout Shopify, contrato cliente). Os termos ja estao fechados."
          />
          <Step
            n={2}
            icon={<Wallet size={20} />}
            title="Voce financia"
            text="Investe parte ou todo o recebivel e adianta o caixa que vence no payout."
          />
          <Step
            n={3}
            icon={<FileSignature size={20} />}
            title="Contrato SCP"
            text="Hash SHA-256 do contrato e armazenado. Voce pode auditar a qualquer momento."
          />
          <Step
            n={4}
            icon={<Award size={20} />}
            title="Voce recebe"
            text="No vencimento, recebe principal + juros pre-acordados, em conta."
          />
        </div>
      </div>

      {/* Performance histórica */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Performance dos ultimos 12 meses</h3>
          <div className="flex gap-3 text-[11px] text-slate-500">
            <span>
              Receita total:{" "}
              <strong className="text-slate-700">
                {formatCurrency(totalRevenue12m)}
              </strong>
            </span>
            <span>
              Lucro:{" "}
              <strong className={totalProfit12m >= 0 ? "text-green-700" : "text-red-700"}>
                {formatCurrency(totalProfit12m)}
              </strong>
            </span>
            <span>
              Margem:{" "}
              <strong className="text-slate-700">{avgMargin.toFixed(0)}%</strong>
            </span>
          </div>
        </div>
        <div className="card-body">
          <InvestorRevenueChart data={pnl12m} />
          <p className="text-[10px] text-slate-400 mt-2 italic">
            Receita consolidada das 3 empresas (USD-equivalente). Dados auditados pelo
            sistema interno de bookkeeping da DSJ.
          </p>
        </div>
      </div>

      {/* Track record / transparencia */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            Track record &amp; transparencia
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <StatBlock
              label="Operacoes finalizadas"
              value={String(completed)}
              icon={<CheckCircle size={16} className="text-green-600" />}
            />
            <StatBlock
              label="Operacoes com perda"
              value={String(losses)}
              icon={<TrendingDown size={16} className="text-red-600" />}
              sub={
                completed > 0
                  ? `${((losses / completed) * 100).toFixed(0)}% das totais`
                  : undefined
              }
            />
            <StatBlock
              label="Capital ja devolvido"
              value={formatCurrency(metrics?.total_capital_returned || 0)}
              icon={<Award size={16} className="text-amber-600" />}
            />
            <StatBlock
              label="Retorno medio"
              value={
                metrics?.opportunities_avg_return
                  ? `${metrics.opportunities_avg_return.toFixed(1)}%`
                  : "—"
              }
              icon={<TrendingUp size={16} className="text-blue-600" />}
              sub="por operacao"
            />
          </div>
          {completed === 0 && (
            <p className="text-xs text-slate-400 italic mt-3 text-center">
              Plataforma em fase inicial. Track record vai aparecer aqui conforme as
              operacoes forem completadas.
            </p>
          )}
        </div>
      </div>

      {/* Oportunidades abertas (CTA) */}
      <div className="card border-2 border-brand-200 bg-brand-50/50">
        <div className="card-header flex items-center justify-between bg-white">
          <h3 className="font-semibold">Oportunidades abertas</h3>
          <span className="badge-info">{openReceivables.length} ativa(s)</span>
        </div>
        <div className="card-body">
          {openReceivables.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Nenhuma oportunidade aberta no momento. Volte em breve.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {openReceivables.slice(0, 4).map((r) => {
                  const raised = r.financing_raised || 0;
                  const pct = r.amount_total > 0 ? (raised / r.amount_total) * 100 : 0;
                  const days = Math.round(
                    (new Date(r.due_date).getTime() - new Date().getTime()) / 86400000
                  );
                  return (
                    <div
                      key={r.id}
                      className="bg-white rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-sm">
                          Operacao #{r.id} ({r.currency})
                        </p>
                        <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                          {r.financing_interest_rate_pct || 0}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">
                        {entityNames[r.entity_id] || r.entity_id}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400">Prazo</span>
                          <p className="font-semibold">
                            {r.financing_redemption_days || 0}d
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Vence</span>
                          <p className="font-semibold">
                            {formatDate(r.due_date)} ({days}d)
                          </p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-600"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {pct.toFixed(0)}% captado
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!isPreview && (
                <Link
                  href={opportunitiesHref}
                  className="btn-primary inline-flex items-center gap-2 w-full justify-center"
                >
                  Ver todas as oportunidades <ArrowRight size={16} />
                </Link>
              )}
              {isPreview && (
                <p className="text-xs text-slate-500 text-center italic">
                  No portal real, este botao leva o investidor pra
                  /investor/opportunities
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* FAQ */}
      <FaqSection />

      {/* Footer disclaimer */}
      <div className="card card-body bg-slate-50 border-slate-200">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Aviso de risco:</strong> investimentos via SCP envolvem risco de
          credito da operacao subjacente. Apesar de cada recebivel representar uma
          obrigacao ja contratada, eventos como chargebacks, default da contraparte
          ou inadimplencia podem reduzir o retorno. A DSJ publica historico de
          perdas honestamente nesta vitrine.
        </p>
      </div>
    </div>
  );
}

function Metric({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: "green" | "blue" | "purple" | "amber";
  label: string;
  value: string;
  sub?: string;
}) {
  const bg = {
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  }[color];
  return (
    <div className="card card-body">
      <div className={`inline-flex p-1.5 rounded-md mb-2 ${bg}`}>{icon}</div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Pill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur px-2.5 py-1 rounded-full font-medium">
      {icon}
      {children}
    </span>
  );
}

function EntityCard({
  name,
  jurisdiction,
  currency,
  description,
}: {
  name: string;
  jurisdiction: string;
  currency: string;
  description: string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Building2 size={14} className="text-slate-500" />
        <h4 className="font-semibold text-sm">{name}</h4>
      </div>
      <div className="flex gap-2 mb-2 text-[10px] text-slate-500">
        <span className="bg-white px-1.5 py-0.5 rounded">{jurisdiction}</span>
        <span className="bg-white px-1.5 py-0.5 rounded">{currency}</span>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  text,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
          {n}
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
      <h4 className="font-semibold text-sm mb-1">{title}</h4>
      <p className="text-xs text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

function StatBlock({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-[11px] text-slate-500">{label}</p>
      </div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "O que e SCP?",
    a: "Sociedade em Conta de Participacao — modalidade prevista no Codigo Civil em que voce (socio investidor) financia uma operacao especifica administrada pela DSJ (socio ostensivo). Voce nao opera, mas tem direito a uma fatia pre-acordada do retorno.",
  },
  {
    q: "Como meu dinheiro e protegido?",
    a: "Cada operacao tem um recebivel real ja contratado (payout Shopify, faturamento confirmado). Voce so investe em recebiveis ja capturados, com vencimento e contraparte conhecidos. Hash SHA-256 do contrato fica armazenado pra auditoria.",
  },
  {
    q: "Quando recebo o retorno?",
    a: "No vencimento do recebivel — geralmente entre 7 e 90 dias dependendo da operacao. O prazo exato e mostrado em cada oportunidade antes de voce assinar.",
  },
  {
    q: "E se a operacao der prejuizo?",
    a: "Existem riscos como chargebacks (cliente reverter pagamento), default da contraparte ou problemas operacionais. A DSJ publica historico de perdas honestamente nesta vitrine — atualmente, " + "veja a coluna 'Operacoes com perda' acima.",
  },
  {
    q: "Posso resgatar antes do vencimento?",
    a: "Nao. O capital fica vinculado a operacao ate o payout. Por isso, so invista o que voce nao precisa pelo prazo do contrato.",
  },
  {
    q: "Quais dados a DSJ compartilha?",
    a: "Voce ve metricas agregadas (receita mensal, margem, operacoes completadas, retornos medios) e detalhes publicos de cada oportunidade aberta. Dados sensiveis (nome de clientes finais, saldos individuais, transferencias intercompany) ficam restritos aos administradores.",
  },
];

function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold flex items-center gap-2">
          <HelpCircle size={16} className="text-blue-600" />
          Perguntas frequentes
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {FAQ_ITEMS.map((item, i) => {
          const open = openIdx === i;
          return (
            <button
              key={i}
              onClick={() => setOpenIdx(open ? null : i)}
              className="w-full text-left p-4 hover:bg-slate-50 transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{item.q}</span>
                {open ? (
                  <ChevronUp size={16} className="text-slate-400" />
                ) : (
                  <ChevronDown size={16} className="text-slate-400" />
                )}
              </div>
              {open && (
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{item.a}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

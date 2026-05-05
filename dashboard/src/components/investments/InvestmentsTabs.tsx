"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { InviteGenerator } from "@/components/invite/InviteGenerator";
import { InvestorRevenueChart } from "@/components/dashboard/InvestorRevenueChart";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import {
  Users, Link2, Eye, EyeOff, TrendingUp, Calendar, CheckCircle, Award, FileText,
} from "lucide-react";
import type { Receivable } from "@/types/database";

interface Props {
  activeTab: "investors" | "invites" | "preview";
  investors: any[];
  opportunities: any[];
  investments: any[];
  receivables: Receivable[];
  metrics: any;
  pnl12m: any[];
}

export function InvestmentsTabs(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}

function Inner({ activeTab, investors, opportunities, investments, receivables, metrics, pnl12m }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState(activeTab);

  function changeTab(newTab: typeof tab) {
    setTab(newTab);
    const next = new URLSearchParams(params.toString());
    if (newTab === "investors") next.delete("tab");
    else next.set("tab", newTab);
    router.push(`/admin/investments${next.toString() ? "?" + next.toString() : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === "investors"} onClick={() => changeTab("investors")} icon={<Users size={14} />}>
          Investidores e oportunidades
        </TabButton>
        <TabButton active={tab === "invites"} onClick={() => changeTab("invites")} icon={<Link2 size={14} />}>
          Gerar convite
        </TabButton>
        <TabButton active={tab === "preview"} onClick={() => changeTab("preview")} icon={<Eye size={14} />}>
          Preview vitrine
        </TabButton>
      </div>

      {tab === "investors" && (
        <InvestorsContent
          investors={investors}
          opportunities={opportunities}
          investments={investments}
          receivables={receivables}
        />
      )}
      {tab === "invites" && (
        <InviteGenerator
          receivables={receivables
            .filter((r) => r.open_for_financing && r.status !== "paid")
            .map((r) => ({
              id: r.id,
              description: r.description,
              amount_total: r.amount_total,
              currency: r.currency,
              interest_rate: r.financing_interest_rate_pct || 0,
              redemption_days: r.financing_redemption_days || 0,
            }))}
        />
      )}
      {tab === "preview" && (
        <PreviewContent
          metrics={metrics}
          pnl12m={pnl12m}
          opportunities={opportunities}
          receivables={receivables}
        />
      )}
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

function InvestorsContent({
  investors,
  opportunities,
  investments,
  receivables,
}: {
  investors: any[];
  opportunities: any[];
  investments: any[];
  receivables: Receivable[];
}) {
  const approved = investors.filter((i) => i.status === "approved");
  const pending = investors.filter((i) => i.status === "pending");
  const openReceivables = receivables.filter(
    (r) => r.open_for_financing && r.status !== "paid"
  );

  return (
    <div className="space-y-6">
      {/* Recebiveis abertos para financiamento — fonte primaria de oportunidades */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Recebiveis abertos para financiamento</h3>
          <Badge variant={openReceivables.length > 0 ? "info" : "neutral"}>
            {openReceivables.length}
          </Badge>
        </div>
        <div className="divide-y divide-slate-100">
          {openReceivables.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Nenhum recebivel aberto pra financiamento. Crie ou edite um recebivel em{" "}
              <a href="/admin/receivables" className="text-brand-600 underline">
                /admin/receivables
              </a>{" "}
              e marque "Abrir para financiamento por investidores".
            </div>
          ) : (
            openReceivables.map((r) => {
              const raised = r.financing_raised || 0;
              const pct = r.amount_total > 0 ? (raised / r.amount_total) * 100 : 0;
              const available = r.amount_total - raised;
              const days = Math.round(
                (new Date(r.due_date).getTime() - new Date().getTime()) / 86400000
              );
              return (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold flex items-center gap-2">
                        <FileText size={14} className="text-slate-500" />
                        {r.description}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.counterparty || "—"} · {entityNames[r.entity_id] || r.entity_id}
                      </p>
                    </div>
                    <Badge variant={r.status === "overdue" ? "danger" : "info"}>
                      {r.status === "overdue" ? "Atrasado" : "Aberto"}
                    </Badge>
                  </div>
                  {r.financing_terms && (
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded mb-3">
                      {r.financing_terms}
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs mt-3">
                    <div>
                      <p className="text-slate-500">Valor total</p>
                      <p className="font-mono font-semibold">
                        {formatCurrency(r.amount_total, r.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Taxa</p>
                      <p className="font-semibold">
                        {r.financing_interest_rate_pct || 0}% / periodo
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Prazo</p>
                      <p className="font-semibold">{r.financing_redemption_days || 0} dias</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Vencimento</p>
                      <p className="font-semibold">
                        {formatDate(r.due_date)} ({days}d)
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Min / Max</p>
                      <p className="font-semibold">
                        {formatCurrency(r.financing_min_amount || 0, r.currency)}
                        {r.financing_max_amount && (
                          <> / {formatCurrency(r.financing_max_amount, r.currency)}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">
                        Captado: {formatCurrency(raised, r.currency)} /{" "}
                        {formatCurrency(r.amount_total, r.currency)}
                      </span>
                      <span className="font-semibold">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-600"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Disponivel: {formatCurrency(available, r.currency)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">Cadastros pendentes de aprovacao</h3>
            <Badge variant="warning">{pending.length}</Badge>
          </div>
          <div className="card-body space-y-3">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div>
                  <p className="font-medium">{inv.name}</p>
                  <p className="text-sm text-slate-500">{inv.cpf} - {inv.email} - {inv.phone}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Codigo: {inv.invite_code} - Criado em {formatDate(inv.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm">Rejeitar</button>
                  <button className="btn-primary text-sm">Aprovar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {opportunities.length > 0 && (
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Oportunidades de produto (legacy)</h3>
          <span className="text-[10px] text-slate-400">tabela opportunities</span>
        </div>
        <div className="divide-y divide-slate-100">
          {opportunities.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              Nenhuma oportunidade. Crie um recebivel aberto pra financiamento em /admin/receivables.
            </div>
          )}
          {opportunities.map((opp) => {
            const pct = opp.target_amount > 0 ? (opp.raised_amount / opp.target_amount) * 100 : 0;
            const oppInvestments = investments.filter((i) => i.opportunity_id === opp.id);
            return (
              <div key={opp.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{opp.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{opp.product_name}</p>
                  </div>
                  <Badge variant={
                    opp.status === "active" ? "info" :
                    opp.status === "open" ? "warning" :
                    opp.status === "completed" ? "success" : "neutral"
                  }>
                    {opp.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-4 gap-4 text-xs mt-3">
                  <div>
                    <p className="text-slate-500">Captado</p>
                    <p className="font-mono font-semibold">
                      {formatCurrency(opp.raised_amount)} / {formatCurrency(opp.target_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">ROAS comprovado</p>
                    <p className="font-semibold">{opp.proven_roas?.toFixed(1) || "-"}x</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Margem comprovada</p>
                    <p className="font-semibold">{opp.proven_margin?.toFixed(0) || "-"}%</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Investidores</p>
                    <p className="font-semibold">{oppInvestments.length}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{pct.toFixed(0)}% captado</p>
                </div>
                {opp.actual_return_pct !== null && (
                  <div className="mt-3 p-2 bg-green-50 rounded text-xs">
                    <strong>Retorno real:</strong> {opp.actual_return_pct.toFixed(1)}% (estimado:
                    {" "}{opp.return_estimate_min}%-{opp.return_estimate_max}%)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Investidores aprovados</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left py-2 px-4 font-medium text-slate-500">Nome</th>
                <th className="text-left py-2 px-4 font-medium text-slate-500">Contato</th>
                <th className="text-right py-2 px-4 font-medium text-slate-500">Investido</th>
                <th className="text-right py-2 px-4 font-medium text-slate-500">Retornado</th>
                <th className="text-right py-2 px-4 font-medium text-slate-500">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {approved.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Nenhum investidor aprovado</td></tr>
              )}
              {approved.map((inv) => {
                const profit = inv.total_returned - inv.total_invested;
                return (
                  <tr key={inv.id} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-medium">{inv.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{inv.email}<br />{inv.phone}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(inv.total_invested)}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(inv.total_returned)}</td>
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${profit > 0 ? "text-green-600" : "text-slate-500"}`}>
                      {profit > 0 ? "+" : ""}{formatCurrency(profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PreviewContent({
  metrics,
  pnl12m,
  opportunities,
  receivables,
}: {
  metrics: any;
  pnl12m: any[];
  opportunities: any[];
  receivables: Receivable[];
}) {
  const openOpportunities = opportunities.filter((o) => o.status === "open" || o.status === "active");
  const openReceivables = receivables.filter(
    (r) => r.open_for_financing && r.status !== "paid"
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div className="card card-body bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Eye className="text-blue-600 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-semibold text-blue-900">Preview da vitrine do investidor</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Visualizacao do que o investidor ve. Dados sensiveis (saldos, transacoes, P&L por empresa) ficam ocultos.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white px-8 py-10">
          <h1 className="text-3xl font-bold mb-2">Portfolio DSJ</h1>
          <p className="text-slate-300">Plataforma privada de antecipacao de recebiveis</p>
        </div>

        <div className="p-8">
          <h2 className="text-lg font-semibold mb-4">Numeros da operacao</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard icon={<TrendingUp size={18} />} label="Receita mensal" value={formatCurrency(metrics?.total_revenue_usd || 0)} sub={`${metrics?.margin_pct?.toFixed(0)}% margem`} color="green" />
            <MetricCard icon={<Calendar size={18} />} label="Meses operando" value={String(metrics?.months_operating || 0)} sub="com receita" color="blue" />
            <MetricCard icon={<CheckCircle size={18} />} label="Concluidas" value={String(metrics?.opportunities_completed || 0)} sub={`${metrics?.opportunities_avg_return?.toFixed(0)}% retorno`} color="purple" />
            <MetricCard icon={<Award size={18} />} label="Capital retornado" value={formatCurrency(metrics?.total_capital_returned || 0)} sub={`${metrics?.opportunities_loss_count} perdas`} color="amber" />
          </div>

          <div className="mb-8">
            <h3 className="font-semibold mb-3">Receita mensal (12 meses)</h3>
            <div className="bg-slate-50 rounded-lg p-4">
              <InvestorRevenueChart data={pnl12m} />
            </div>
          </div>

          <h3 className="font-semibold mb-3">
            Recebiveis abertos para financiamento ({openReceivables.length})
          </h3>
          {openReceivables.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum recebivel aberto no momento.</p>
          ) : (
            <div className="space-y-2">
              {openReceivables.map((r) => {
                const raised = r.financing_raised || 0;
                const pct = r.amount_total > 0 ? (raised / r.amount_total) * 100 : 0;
                const days = Math.round(
                  (new Date(r.due_date).getTime() - new Date().getTime()) / 86400000
                );
                return (
                  <div key={r.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{r.description}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{r.counterparty}</p>
                      </div>
                      <Badge variant="info">Aberto</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500">Taxa</p>
                        <p className="font-semibold">
                          {r.financing_interest_rate_pct || 0}% / periodo
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Prazo</p>
                        <p className="font-semibold">
                          {r.financing_redemption_days || 0} dias ({days}d ate venc.)
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Captado</p>
                        <p className="font-semibold">{pct.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {openOpportunities.length > 0 && (
            <>
              <h4 className="font-semibold mt-6 mb-2 text-sm text-slate-600">
                Oportunidades de produto (legacy)
              </h4>
              <p className="text-xs text-slate-400">
                {openOpportunities.length} oportunidade(s) na tabela legacy
              </p>
            </>
          )}
        </div>
      </div>

      <div className="card card-body bg-slate-100 border-slate-200">
        <div className="flex items-start gap-3">
          <EyeOff className="text-slate-500 mt-0.5" size={18} />
          <div className="text-sm text-slate-600">
            <p className="font-semibold mb-1">Dados ocultos do investidor:</p>
            <ul className="space-y-0.5 text-xs">
              <li>Saldos bancarios individuais</li>
              <li>Lista de transacoes</li>
              <li>Salarios e fornecedores</li>
              <li>Transferencias intercompany</li>
              <li>Runway / burn rate</li>
              <li>P&L por empresa</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: "green" | "blue" | "purple" | "amber";
}) {
  const colors = {
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <div className={`inline-flex p-1.5 rounded-md mb-2 ${colors[color]}`}>{icon}</div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

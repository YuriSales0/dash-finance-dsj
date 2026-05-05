"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { InviteGenerator } from "@/components/invite/InviteGenerator";
import { InvestorHomeView } from "@/components/investor/InvestorHomeView";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import {
  Users, Link2, Eye, EyeOff, FileText,
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
  const router = useRouter();
  const [actingId, setActingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const approved = investors.filter((i) => i.status === "approved");
  const pending = investors.filter((i) => i.status === "pending");

  async function decide(investorId: number, action: "approve" | "reject") {
    if (action === "reject" && !confirm("Rejeitar este investidor? Nao podera mais entrar.")) return;
    setActingId(investorId);
    setActionError(null);
    const res = await fetch(`/api/investors/${investorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Erro" }));
      setActionError(data.error || `Erro ${res.status}`);
      return;
    }
    router.refresh();
  }
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
                        {r.financing_interest_rate_pct || 0}% ao mes
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
            {actionError && (
              <div className="bg-red-50 text-red-700 rounded p-2 text-xs">{actionError}</div>
            )}
            {pending.map((inv) => {
              const acting = actingId === inv.id;
              return (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <div>
                    <p className="font-medium">{inv.name}</p>
                    <p className="text-sm text-slate-500">{inv.cpf} - {inv.email} - {inv.phone}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Codigo: {inv.invite_code} - Criado em {formatDate(inv.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(inv.id, "reject")}
                      disabled={acting}
                      className="btn-secondary text-sm disabled:opacity-50"
                    >
                      {acting ? "..." : "Rejeitar"}
                    </button>
                    <button
                      onClick={() => decide(inv.id, "approve")}
                      disabled={acting}
                      className="btn-primary text-sm disabled:opacity-50"
                    >
                      {acting ? "..." : "Aprovar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* L17: card de "Oportunidades de produto (legacy)" removido. Recebiveis
          abertos pra financiamento ja sao mostrados no card primario acima.
          A tabela `opportunities` ainda existe no DB pra historico, mas nao
          confunde mais o admin com dados duplicados. */}

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
  receivables,
}: {
  metrics: any;
  pnl12m: any[];
  opportunities: any[];
  receivables: Receivable[];
}) {
  const openReceivables = receivables.filter(
    (r) => r.open_for_financing && r.status !== "paid"
  );

  return (
    <div className="space-y-6">
      <div className="card card-body bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Eye className="text-blue-600 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="font-semibold text-blue-900">Preview da vitrine do investidor</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Exatamente o que o investidor aprovado ve em /investor. Dados sensiveis
              (saldos, transacoes, P&amp;L por empresa, contraparte) ficam ocultos.
            </p>
          </div>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl p-6 bg-white">
        <InvestorHomeView
          metrics={metrics}
          pnl12m={pnl12m}
          openReceivables={openReceivables}
          isPreview
        />
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
              <li>P&amp;L por empresa</li>
              <li>Description / counterparty dos recebiveis</li>
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

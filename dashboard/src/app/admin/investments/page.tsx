import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { repository } from "@/lib/data/repository";
import { formatCurrency, formatDate } from "@/lib/format";
import { InvestmentsTabs } from "@/components/investments/InvestmentsTabs";
import { Users, TrendingUp, DollarSign, Award } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function InvestmentsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const [investors, opportunities, investments, receivables, metrics, pnl12m] = await Promise.all([
    repository.getInvestors(),
    repository.getOpportunities(),
    repository.getInvestments(),
    repository.getReceivables({ open_for_financing: true }),
    repository.getInvestorMetrics(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 12 }),
  ]);

  const approved = investors.filter((i) => i.status === "approved");
  const pending = investors.filter((i) => i.status === "pending");
  const totalRaised = investments
    .filter((i) => i.status === "active" || i.status === "returned")
    .reduce((s, i) => s + i.amount, 0);
  const totalReturned = investments
    .filter((i) => i.status === "returned")
    .reduce((s, i) => s + (i.return_amount || 0), 0);

  const tab = (searchParams.tab as "investors" | "invites" | "preview") || "investors";

  return (
    <>
      <Header
        title="Plataforma de Investimento (SCP)"
        subtitle="Investidores, oportunidades, convites e preview"
      />
      <div className="p-6 space-y-6">
        {/* KPIs sempre visiveis */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><Users className="text-blue-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Investidores</p>
                <p className="text-xl font-bold">{approved.length}</p>
                <p className="text-xs text-slate-400">{pending.length} pendentes</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><DollarSign className="text-green-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Captado total</p>
                <p className="text-xl font-bold">{formatCurrency(totalRaised)}</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg"><Award className="text-purple-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Retornado</p>
                <p className="text-xl font-bold">{formatCurrency(totalReturned)}</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg"><TrendingUp className="text-amber-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Operacoes ativas</p>
                <p className="text-xl font-bold">
                  {opportunities.filter((o) => o.status === "active").length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <InvestmentsTabs
          activeTab={tab}
          investors={investors}
          opportunities={opportunities}
          investments={investments}
          receivables={receivables.filter((r) => r.status !== "paid").map((r) => ({
            id: r.id,
            description: r.description,
            amount_total: r.amount_total,
            currency: r.currency,
            interest_rate: r.financing_interest_rate_pct || 0,
            redemption_days: r.financing_redemption_days || 0,
          }))}
          metrics={metrics}
          pnl12m={pnl12m}
        />
      </div>
    </>
  );
}

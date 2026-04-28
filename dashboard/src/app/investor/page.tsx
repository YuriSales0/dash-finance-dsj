import { repository } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";
import { TrendingUp, Calendar, CheckCircle, Award, ArrowRight } from "lucide-react";
import { InvestorRevenueChart } from "@/components/dashboard/InvestorRevenueChart";

export default async function InvestorHome() {
  const [metrics, pnl12m, openReceivables] = await Promise.all([
    repository.getInvestorMetrics(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 12 }),
    repository.getReceivables({ open_for_financing: true }),
  ]);

  const openCount = openReceivables.filter((r) => r.status !== "paid").length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-xl px-8 py-10">
        <h1 className="text-3xl font-bold">Portfolio DSJ</h1>
        <p className="text-slate-300 mt-1">
          Antecipacao de recebiveis validados de operacoes de e-commerce
        </p>
      </div>

      {/* Metricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric icon={<TrendingUp size={18} />} color="green" label="Receita mensal" value={formatCurrency(metrics.total_revenue_usd || 0)} sub={`${metrics.margin_pct?.toFixed(0)}% margem`} />
        <Metric icon={<Calendar size={18} />} color="blue" label="Meses operando" value={String(metrics.months_operating || 0)} sub="com receita" />
        <Metric icon={<CheckCircle size={18} />} color="purple" label="Operacoes" value={String(metrics.opportunities_completed || 0)} sub={`${metrics.opportunities_avg_return?.toFixed(0)}% retorno medio`} />
        <Metric icon={<Award size={18} />} color="amber" label="Capital retornado" value={formatCurrency(metrics.total_capital_returned || 0)} sub={`${metrics.opportunities_loss_count || 0} perdas`} />
      </div>

      {/* Gráfico */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Receita mensal (12 meses)</h3></div>
        <div className="card-body">
          <InvestorRevenueChart data={pnl12m} />
        </div>
      </div>

      {/* CTA oportunidades */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Recebiveis abertos para financiamento</h3>
          <span className="badge-info">{openCount} ativos</span>
        </div>
        <div className="card-body">
          {openCount > 0 ? (
            <>
              <p className="text-sm text-slate-600 mb-3">
                Financie recebiveis ja capturados pela DSJ e receba retorno fixo no prazo do payout.
              </p>
              <Link href="/investor/opportunities" className="btn-primary inline-flex items-center gap-2">
                Ver oportunidades <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">Nenhuma oportunidade aberta no momento.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, color, label, value, sub }: {
  icon: React.ReactNode;
  color: "green" | "blue" | "purple" | "amber";
  label: string;
  value: string;
  sub?: string;
}) {
  const bg = { green: "bg-green-50 text-green-700", blue: "bg-blue-50 text-blue-700", purple: "bg-purple-50 text-purple-700", amber: "bg-amber-50 text-amber-700" }[color];
  return (
    <div className="card card-body">
      <div className={`inline-flex p-1.5 rounded-md mb-2 ${bg}`}>{icon}</div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

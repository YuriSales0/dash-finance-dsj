import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { InvestorRevenueChart } from "@/components/dashboard/InvestorRevenueChart";
import { repository } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { Eye, EyeOff, TrendingUp, Calendar, CheckCircle, Award } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const [metrics, pnl12m, opportunities] = await Promise.all([
    repository.getInvestorMetrics(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 12 }),
    repository.getOpportunities(),
  ]);

  const openOpportunities = opportunities.filter((o) => o.status === "open" || o.status === "active");

  return (
    <>
      <Header
        title="Preview Vitrine"
        subtitle="Visualizacao do que o investidor ve"
      />
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Aviso de preview */}
          <div className="mb-6 card card-body bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Eye className="text-blue-600 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-blue-900">Modo Preview</p>
                <p className="text-sm text-blue-700 mt-0.5">
                  Esta e a vitrine publica para investidores aprovados. Dados sensiveis
                  (saldos, transacoes, P&L por empresa) ficam ocultos.
                </p>
              </div>
            </div>
          </div>

          {/* Vitrine começa aqui - simula o que o investidor vê */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Hero */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white px-8 py-10">
              <h1 className="text-3xl font-bold mb-2">Portfolio DSJ</h1>
              <p className="text-slate-300">
                Plataforma privada de investimento em operacoes validadas de e-commerce
              </p>
            </div>

            {/* Métricas curadas */}
            <div className="p-8">
              <h2 className="text-lg font-semibold mb-4">Numeros da operacao</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <MetricCard
                  icon={<TrendingUp size={18} />}
                  label="Receita mensal"
                  value={formatCurrency(metrics.total_revenue_usd || 0)}
                  sub={`${metrics.margin_pct?.toFixed(0)}% de margem`}
                  color="green"
                />
                <MetricCard
                  icon={<Calendar size={18} />}
                  label="Meses operando"
                  value={metrics.months_operating?.toString() || "0"}
                  sub="com receita"
                  color="blue"
                />
                <MetricCard
                  icon={<CheckCircle size={18} />}
                  label="Operacoes concluidas"
                  value={metrics.opportunities_completed?.toString() || "0"}
                  sub={`${metrics.opportunities_avg_return?.toFixed(0)}% retorno medio`}
                  color="purple"
                />
                <MetricCard
                  icon={<Award size={18} />}
                  label="Capital retornado"
                  value={formatCurrency(metrics.total_capital_returned || 0)}
                  sub={`${metrics.opportunities_loss_count} perdas`}
                  color="amber"
                />
              </div>

              {/* Gráfico receita 12 meses */}
              <div className="mb-8">
                <h3 className="font-semibold mb-3">Receita mensal (12 meses)</h3>
                <div className="bg-slate-50 rounded-lg p-4">
                  <InvestorRevenueChart data={pnl12m} />
                </div>
              </div>

              {/* Oportunidades abertas */}
              <h3 className="font-semibold mb-3">Oportunidades abertas</h3>
              <div className="space-y-3">
                {openOpportunities.map((opp) => {
                  const pct = (opp.raised_amount / opp.target_amount) * 100;
                  return (
                    <div
                      key={opp.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-brand-400 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{opp.title}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {opp.duration_days} dias - Min. {formatCurrency(opp.min_investment)}
                          </p>
                        </div>
                        <Badge variant={opp.status === "open" ? "warning" : "info"}>
                          {opp.status === "open" ? "Aberta" : "Ativa"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs mt-3">
                        <div>
                          <p className="text-slate-500">ROAS comprovado</p>
                          <p className="font-semibold text-base">{opp.proven_roas?.toFixed(1)}x</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Margem</p>
                          <p className="font-semibold text-base">{opp.proven_margin?.toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Retorno estimado</p>
                          <p className="font-semibold text-base text-green-600">
                            {opp.return_estimate_min}%-{opp.return_estimate_max}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="flex justify-between items-baseline text-xs mb-1">
                          <span className="text-slate-500">
                            Captado: {formatCurrency(opp.raised_amount)} / {formatCurrency(opp.target_amount)}
                          </span>
                          <span className="font-semibold">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-600"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Aviso de dados ocultos */}
          <div className="mt-6 card card-body bg-slate-100 border-slate-200">
            <div className="flex items-start gap-3">
              <EyeOff className="text-slate-500 mt-0.5" size={18} />
              <div className="text-sm text-slate-600">
                <p className="font-semibold mb-1">Dados ocultos do investidor:</p>
                <ul className="space-y-0.5 text-xs">
                  <li>Saldos bancarios individuais</li>
                  <li>Lista de transacoes</li>
                  <li>Salarios de equipe</li>
                  <li>Detalhes de fornecedores</li>
                  <li>Transferencias intercompany</li>
                  <li>Runway e burn rate</li>
                  <li>P&L por empresa separado</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
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

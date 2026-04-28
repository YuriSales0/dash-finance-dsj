import { Header } from "@/components/layout/Header";
import { RiskGauge } from "@/components/risk/RiskGauge";
import { computeRisk, generateAIAnalysis } from "@/lib/risk/calculate";
import { formatCurrency } from "@/lib/format";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const calc = await computeRisk();
  const ai = await generateAIAnalysis(calc);

  return (
    <>
      <Header
        title="Indice de Risco"
        subtitle="Saude financeira + cenarios what-if"
      />
      <div className="p-6 space-y-6">
        {/* Header gauge */}
        <div className="card card-body">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-1">
              <RiskGauge score={calc.risk_score} level={calc.risk_level} />
            </div>
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="text-brand-600" size={18} />
                <h3 className="font-semibold">Analise AI</h3>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{ai.analysis}</p>
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-700 mb-2">Recomendacoes</p>
                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans">{ai.recommendations}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            icon={<Wallet size={18} />}
            color="green"
            label="Caixa atual"
            value={formatCurrency(calc.cash_balance_usd)}
            sub={`Runway: ${calc.runway_days.toFixed(0)} dias`}
          />
          <Kpi
            icon={<TrendingUp size={18} />}
            color="blue"
            label="Recebiveis"
            value={formatCurrency(calc.receivables_pending)}
            sub={`Recebimento medio: ${calc.avg_days_to_receive}d`}
          />
          <Kpi
            icon={<TrendingDown size={18} />}
            color="red"
            label="Dividas"
            value={formatCurrency(calc.debts_pending)}
            sub={`Pagamento medio: ${calc.avg_days_to_pay}d`}
          />
          <Kpi
            icon={<Calendar size={18} />}
            color="amber"
            label="Burn diario em ads"
            value={formatCurrency(calc.daily_ad_spend)}
            sub={`Burn total: ${formatCurrency(calc.burn_rate)}/mes`}
          />
        </div>

        {/* Fatores */}
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Fatores que compoem o score</h3></div>
          <div className="card-body space-y-3">
            <FactorBar label="Burn vs caixa" value={calc.factors.burn_to_cash_ratio} />
            <FactorBar label="Pressao de runway" value={calc.factors.runway_factor} />
            <FactorBar label="Recebiveis em atraso" value={calc.factors.overdue_receivables_pct} />
            <FactorBar label="Dividas em atraso" value={calc.factors.overdue_debts_pct} />
            <FactorBar label="Ads / receita" value={calc.factors.ad_spend_pct_revenue} />
            <FactorBar label="Concentracao recebiveis" value={calc.factors.receivables_concentration} />
          </div>
        </div>

        {/* Cenarios what-if */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={18} />
            <h3 className="font-semibold">Cenarios "e se..."</h3>
          </div>
          <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
            <Scenario
              title="Stripe trava 7 dias"
              description="Processador segura todos os pagamentos por uma semana"
              cashImpact={calc.scenarios.stripe_freeze_7d.cash_impact}
              runwayImpact={calc.scenarios.stripe_freeze_7d.runway_impact_days}
            />
            <Scenario
              title="Stripe trava 30 dias"
              description="Cenario critico de bloqueio mensal"
              cashImpact={calc.scenarios.stripe_freeze_30d.cash_impact}
              runwayImpact={calc.scenarios.stripe_freeze_30d.runway_impact_days}
              criticalLevel
            />
            <Scenario
              title="Receita cai 50%"
              description="Queda de demanda ou banimento de conta de ads"
              cashImpact={calc.scenarios.revenue_drop_50pct.cash_impact}
              runwayImpact={calc.scenarios.revenue_drop_50pct.runway_impact_days}
            />
            <Scenario
              title="Default no maior recebivel"
              description="Maior contraparte nao paga"
              cashImpact={calc.scenarios.receivables_default_top.cash_impact}
              runwayImpact={calc.scenarios.receivables_default_top.runway_impact_days}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function Kpi({ icon, color, label, value, sub }: {
  icon: React.ReactNode;
  color: "green" | "blue" | "red" | "amber";
  label: string;
  value: string;
  sub?: string;
}) {
  const bg = { green: "bg-green-50 text-green-600", blue: "bg-blue-50 text-blue-600", red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-600" }[color];
  return (
    <div className="card card-body">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  const pct = value * 100;
  const color = pct < 25 ? "bg-green-500" : pct < 50 ? "bg-amber-500" : pct < 75 ? "bg-orange-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="font-mono text-slate-500">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Scenario({ title, description, cashImpact, runwayImpact, criticalLevel }: {
  title: string;
  description: string;
  cashImpact: number;
  runwayImpact: number;
  criticalLevel?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg border ${criticalLevel ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
      <h4 className="font-semibold text-sm">{title}</h4>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <p className="text-xs text-slate-500">Caixa</p>
          <p className="font-mono font-semibold text-red-600">{formatCurrency(cashImpact)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Runway</p>
          <p className="font-mono font-semibold text-red-600">{runwayImpact}d</p>
        </div>
      </div>
    </div>
  );
}

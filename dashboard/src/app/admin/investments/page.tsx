import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { repository } from "@/lib/data/repository";
import { formatCurrency, formatDate } from "@/lib/format";
import { Users, TrendingUp, DollarSign, Award } from "lucide-react";

export default async function InvestmentsPage() {
  const [investors, opportunities, investments] = await Promise.all([
    repository.getInvestors(),
    repository.getOpportunities(),
    repository.getInvestments(),
  ]);

  const approved = investors.filter((i) => i.status === "approved");
  const pending = investors.filter((i) => i.status === "pending");
  const totalRaised = investments
    .filter((i) => i.status === "active" || i.status === "returned")
    .reduce((s, i) => s + i.amount, 0);
  const totalReturned = investments
    .filter((i) => i.status === "returned")
    .reduce((s, i) => s + (i.return_amount || 0), 0);

  return (
    <>
      <Header
        title="Plataforma de Investimento (SCP)"
        subtitle="Gestao de investidores e oportunidades"
      />
      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Investidores</p>
                <p className="text-xl font-bold">{approved.length}</p>
                <p className="text-xs text-slate-400">{pending.length} pendentes</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Captado total</p>
                <p className="text-xl font-bold">{formatCurrency(totalRaised)}</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Award className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Retornado</p>
                <p className="text-xl font-bold">{formatCurrency(totalReturned)}</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <TrendingUp className="text-amber-600" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Operacoes ativas</p>
                <p className="text-xl font-bold">
                  {opportunities.filter((o) => o.status === "active").length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pendentes de aprovação */}
        {pending.length > 0 && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold">Cadastros pendentes de aprovacao</h3>
              <Badge variant="warning">{pending.length}</Badge>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {pending.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 bg-amber-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{inv.name}</p>
                      <p className="text-sm text-slate-500">
                        {inv.cpf} - {inv.email} - {inv.phone}
                      </p>
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
          </div>
        )}

        {/* Oportunidades */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">Oportunidades</h3>
            <button className="btn-primary text-sm">+ Nova oportunidade</button>
          </div>
          <div className="divide-y divide-slate-100">
            {opportunities.map((opp) => {
              const pct = (opp.raised_amount / opp.target_amount) * 100;
              const oppInvestments = investments.filter((i) => i.opportunity_id === opp.id);
              return (
                <div key={opp.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{opp.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{opp.product_name}</p>
                    </div>
                    <Badge
                      variant={
                        opp.status === "active" ? "info" :
                        opp.status === "open" ? "warning" :
                        opp.status === "completed" ? "success" : "neutral"
                      }
                    >
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
                      <p className="font-semibold">{opp.proven_roas?.toFixed(1)}x</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Margem comprovada</p>
                      <p className="font-semibold">{opp.proven_margin?.toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Investidores</p>
                      <p className="font-semibold">{oppInvestments.length}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-600"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
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

        {/* Investidores aprovados */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Investidores aprovados</h3>
          </div>
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
                {approved.map((inv) => {
                  const profit = inv.total_returned - inv.total_invested;
                  return (
                    <tr key={inv.id} className="border-b border-slate-100">
                      <td className="py-3 px-4 font-medium">{inv.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {inv.email}<br />{inv.phone}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(inv.total_invested)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(inv.total_returned)}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-semibold ${
                        profit > 0 ? "text-green-600" : "text-slate-500"
                      }`}>
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
    </>
  );
}

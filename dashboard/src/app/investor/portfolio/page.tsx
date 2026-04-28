import { repository } from "@/lib/data/repository";
import { formatCurrency, formatDate } from "@/lib/format";
import { Wallet, TrendingUp, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  // Demo: pegar todos os financiamentos. Em prod: filtrar pelo investor logado
  const [financings, receivables] = await Promise.all([
    repository.getFinancings(),
    repository.getReceivables(),
  ]);

  const recvMap = new Map(receivables.map((r) => [r.id, r]));

  const active = financings.filter((f) => f.status === "active" || f.status === "pending");
  const redeemed = financings.filter((f) => f.status === "redeemed");

  const totalInvested = active.reduce((s, f) => s + f.amount_invested, 0);
  const totalExpected = active.reduce((s, f) => s + f.expected_return, 0);
  const totalRedeemed = redeemed.reduce((s, f) => s + (f.actual_return || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Meu portfolio</h1>
        <p className="text-sm text-slate-500 mt-1">
          Financiamentos ativos e historico de resgates
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat icon={<Wallet size={18} />} color="blue" label="Investido (ativo)" value={formatCurrency(totalInvested)} />
        <Stat icon={<TrendingUp size={18} />} color="green" label="Retorno esperado" value={formatCurrency(totalExpected)} />
        <Stat icon={<Clock size={18} />} color="amber" label="Ja resgatado" value={formatCurrency(totalRedeemed)} />
      </div>

      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Financiamentos ativos</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-2 px-4 font-medium text-slate-500">Recebivel</th>
                <th className="text-right py-2 px-4 font-medium text-slate-500">Investido</th>
                <th className="text-right py-2 px-4 font-medium text-slate-500">Taxa</th>
                <th className="text-right py-2 px-4 font-medium text-slate-500">Retorno esperado</th>
                <th className="text-left py-2 px-4 font-medium text-slate-500">Resgate</th>
                <th className="text-center py-2 px-4 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhum financiamento ativo</td></tr>
              ) : active.map((f) => {
                const r = recvMap.get(f.receivable_id);
                return (
                  <tr key={f.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      <div className="font-medium">{r?.description}</div>
                      <div className="text-xs text-slate-500">{r?.counterparty}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(f.amount_invested)}</td>
                    <td className="py-3 px-4 text-right font-mono">{f.interest_rate_pct}%</td>
                    <td className="py-3 px-4 text-right font-mono text-green-600">{formatCurrency(f.expected_return)}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {f.redemption_date ? formatDate(f.redemption_date) : "-"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={f.status === "active" ? "badge-success" : "badge-warning"}>
                        {f.status === "active" ? "Ativo" : "Pendente"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {redeemed.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Historico de resgates</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Recebivel</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Investido</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Retorno real</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {redeemed.map((f) => {
                  const r = recvMap.get(f.receivable_id);
                  return (
                    <tr key={f.id} className="border-b border-slate-100">
                      <td className="py-3 px-4">{r?.description}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatCurrency(f.amount_invested)}</td>
                      <td className="py-3 px-4 text-right font-mono text-green-600">{formatCurrency(f.actual_return || 0)}</td>
                      <td className="py-3 px-4 text-xs">{f.redeemed_at ? formatDate(f.redeemed_at) : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, color, label, value }: {
  icon: React.ReactNode;
  color: "blue" | "green" | "amber";
  label: string;
  value: string;
}) {
  const bg = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-600" }[color];
  return (
    <div className="card card-body">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

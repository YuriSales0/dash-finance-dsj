import { repository } from "@/lib/data/repository";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Wallet, TrendingUp, Clock, Calendar, FileText, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
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
        <p className="text-sm text-slate-500 mt-1">Financiamentos, cronograma e extratos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat icon={<Wallet size={18} />} color="blue" label="Investido (ativo)" value={formatCurrency(totalInvested)} />
        <Stat icon={<TrendingUp size={18} />} color="green" label="Retorno esperado" value={formatCurrency(totalExpected)} />
        <Stat icon={<Clock size={18} />} color="amber" label="Ja resgatado" value={formatCurrency(totalRedeemed)} />
      </div>

      {/* Financiamentos ativos com cronograma */}
      {active.map((f) => {
        const r = recvMap.get(f.receivable_id);
        const daysLeft = f.redemption_date
          ? Math.round((new Date(f.redemption_date).getTime() - new Date().getTime()) / 86400000)
          : null;

        return (
          <div key={f.id} className="card">
            <div className="card-header flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{r?.description || `Financiamento #${f.id}`}</h3>
                <p className="text-xs text-slate-500">{r?.counterparty}</p>
              </div>
              <Badge variant={f.status === "active" ? "success" : "warning"}>
                {f.status === "active" ? "Ativo" : "Pendente"}
              </Badge>
            </div>
            <div className="card-body space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Investido</p>
                  <p className="font-mono font-semibold">{formatCurrency(f.amount_invested)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Taxa</p>
                  <p className="font-semibold">{f.interest_rate_pct}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Retorno esperado</p>
                  <p className="font-mono font-semibold text-green-600">{formatCurrency(f.expected_return)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Data resgate</p>
                  <p className="font-semibold">{f.redemption_date ? formatDate(f.redemption_date) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Dias restantes</p>
                  <p className={`font-bold text-lg ${daysLeft !== null && daysLeft <= 3 ? "text-amber-600" : "text-slate-900"}`}>
                    {daysLeft !== null ? (daysLeft > 0 ? daysLeft : "Hoje!") : "-"}
                  </p>
                </div>
              </div>

              {/* Cronograma de pagamento */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 border-b border-slate-200">
                  <Calendar size={14} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700">Cronograma de pagamento</span>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-2 px-4 font-medium text-slate-500">#</th>
                      <th className="text-left py-2 px-4 font-medium text-slate-500">Data</th>
                      <th className="text-right py-2 px-4 font-medium text-slate-500">Principal</th>
                      <th className="text-right py-2 px-4 font-medium text-slate-500">Juros</th>
                      <th className="text-right py-2 px-4 font-medium text-slate-500">Total</th>
                      <th className="text-center py-2 px-4 font-medium text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="py-2 px-4">1</td>
                      <td className="py-2 px-4">{f.redemption_date ? formatDate(f.redemption_date) : "-"}</td>
                      <td className="py-2 px-4 text-right font-mono">{formatCurrency(f.amount_invested)}</td>
                      <td className="py-2 px-4 text-right font-mono text-green-600">
                        +{formatCurrency(f.expected_return - f.amount_invested)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-semibold">{formatCurrency(f.expected_return)}</td>
                      <td className="py-2 px-4 text-center">
                        <Badge variant={f.status === "redeemed" ? "success" : "info"}>
                          {f.status === "redeemed" ? "Pago" : "Agendado"}
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Statement / extrato */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-500" />
                    <span className="text-xs font-semibold text-slate-700">Extrato</span>
                  </div>
                </div>
                <div className="p-4 text-xs space-y-2">
                  <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                    <span className="text-slate-500">Aporte realizado</span>
                    <span className="font-mono">{f.confirmed_at ? formatDate(f.confirmed_at) : "-"}</span>
                    <span className="font-mono font-semibold text-red-600">-{formatCurrency(f.amount_invested)}</span>
                  </div>

                  {f.status === "redeemed" && f.actual_return ? (
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                      <span className="text-slate-500">Retorno recebido</span>
                      <span className="font-mono">{f.redeemed_at ? formatDate(f.redeemed_at) : "-"}</span>
                      <span className="font-mono font-semibold text-green-600">+{formatCurrency(f.actual_return)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                      <span className="text-slate-500">Retorno previsto</span>
                      <span className="font-mono">{f.redemption_date ? formatDate(f.redemption_date) : "-"}</span>
                      <span className="font-mono font-semibold text-slate-400">{formatCurrency(f.expected_return)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-t border-slate-300 font-semibold">
                    <span>Saldo</span>
                    <span></span>
                    <span className={`font-mono ${
                      f.status === "redeemed"
                        ? "text-green-700"
                        : "text-slate-700"
                    }`}>
                      {f.status === "redeemed"
                        ? formatCurrency((f.actual_return || 0) - f.amount_invested)
                        : formatCurrency(0) + " (em operacao)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contrato */}
              {f.contract_hash && (
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <FileText size={10} />
                  Contrato #{f.contract_hash?.slice(0, 12)}...
                  {f.contract_accepted_at && ` — assinado em ${formatDate(f.contract_accepted_at)}`}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {active.length === 0 && (
        <div className="card card-body text-center py-8 text-slate-400">
          Nenhum financiamento ativo. <a href="/investor/opportunities" className="text-brand-600 underline">Ver oportunidades</a>
        </div>
      )}

      {/* Historico */}
      {redeemed.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Historico de resgates</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Recebivel</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Investido</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Retorno</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Lucro</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {redeemed.map((f) => {
                  const r = recvMap.get(f.receivable_id);
                  const profit = (f.actual_return || 0) - f.amount_invested;
                  return (
                    <tr key={f.id} className="border-b border-slate-100">
                      <td className="py-3 px-4">{r?.description}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatCurrency(f.amount_invested)}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatCurrency(f.actual_return || 0)}</td>
                      <td className="py-3 px-4 text-right font-mono text-green-600">+{formatCurrency(profit)}</td>
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

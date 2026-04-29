import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { repository } from "@/lib/data/repository";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { convertToUsd } from "@/lib/fx/rates";
import { DebtForm } from "@/components/debts/DebtForm";
import { CreditCard, AlertTriangle, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function DebtsPage() {
  const debts = await repository.getDebts();

  // Total a pagar convertido para USD
  let totalPendingUsd = 0;
  for (const d of debts) {
    if (d.status !== "pending" && d.status !== "partial") continue;
    const remaining = d.amount_total - d.amount_paid;
    if (remaining <= 0) continue;
    const usd = d.currency === "USD"
      ? remaining
      : (await convertToUsd(remaining, d.currency)).amount_usd;
    totalPendingUsd += usd;
  }

  const overdueCount = debts.filter(
    (d) => d.status !== "paid" && new Date(d.due_date) < new Date()
  ).length;
  const next30 = debts.filter((d) => {
    if (d.status === "paid") return false;
    const days = (new Date(d.due_date).getTime() - new Date().getTime()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;

  return (
    <>
      <Header title="Dividas" subtitle="Obrigacoes a pagar" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><CreditCard className="text-red-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">A pagar (USD)</p>
                <p className="text-xl font-bold">{formatCurrency(totalPendingUsd)}</p>
                <p className="text-[10px] text-slate-400">convertido pela cotacao do dia</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg"><Calendar className="text-amber-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Vence em 30 dias</p>
                <p className="text-xl font-bold">{next30}</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="text-red-700" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Atrasadas</p>
                <p className="text-xl font-bold">{overdueCount}</p>
              </div>
            </div>
          </div>
        </div>

        <DebtForm />

        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Dividas</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Descricao</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Credor</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Empresa</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Vencimento</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Valor</th>
                  <th className="text-center py-2 px-4 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {debts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhuma divida</td></tr>
                ) : debts.map((d) => {
                  const isOverdue = d.status !== "paid" && new Date(d.due_date) < new Date();
                  return (
                    <tr key={d.id} className="border-b border-slate-100">
                      <td className="py-3 px-4">
                        <div className="font-medium">{d.description}</div>
                        {d.category && <div className="text-xs text-slate-500">{d.category}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{d.creditor || "-"}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{entityNames[d.entity_id]}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{formatDate(d.due_date)}</td>
                      <td className="py-3 px-4 text-right font-mono">{formatCurrency(d.amount_total, d.currency)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={
                          d.status === "paid" ? "success" :
                          isOverdue ? "danger" :
                          d.status === "partial" ? "warning" : "neutral"
                        }>
                          {d.status === "paid" ? "Pago" :
                           isOverdue ? "Atrasado" :
                           d.status === "partial" ? "Parcial" : "Pendente"}
                        </Badge>
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

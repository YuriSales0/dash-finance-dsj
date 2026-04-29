import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { repository } from "@/lib/data/repository";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { ReceivableForm } from "@/components/receivables/ReceivableForm";
import { FileText, AlertCircle, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  const receivables = await repository.getReceivables();

  const totalPending = receivables
    .filter((r) => r.status === "pending" || r.status === "partial")
    .reduce((s, r) => s + (r.amount_total - r.amount_received), 0);
  const overdueCount = receivables.filter(
    (r) => r.status !== "paid" && new Date(r.due_date) < new Date()
  ).length;
  const openForFinancing = receivables.filter((r) => r.open_for_financing && r.status !== "paid").length;

  return (
    <>
      <Header
        title="Recebiveis"
        subtitle="Valores a receber + ofertas para investidores"
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><FileText className="text-green-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">A receber</p>
                <p className="text-xl font-bold">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg"><Banknote className="text-amber-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Abertos para financiamento</p>
                <p className="text-xl font-bold">{openForFinancing}</p>
              </div>
            </div>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><AlertCircle className="text-red-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Atrasados</p>
                <p className="text-xl font-bold">{overdueCount}</p>
              </div>
            </div>
          </div>
        </div>

        <ReceivableForm />

        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Recebiveis</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Descricao</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Empresa</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500">Vencimento</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Total</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-500">Captado</th>
                  <th className="text-center py-2 px-4 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {receivables.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Nenhum recebivel</td></tr>
                ) : receivables.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      <div className="font-medium">{r.description}</div>
                      <div className="text-xs text-slate-500">{r.counterparty}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{entityNames[r.entity_id]}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{formatDate(r.due_date)}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(r.amount_total, r.currency)}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      {r.open_for_financing
                        ? <span className="text-brand-600">{formatCurrency(r.financing_raised || 0, r.currency)}</span>
                        : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={
                        r.status === "paid" ? "success" :
                        r.status === "overdue" || r.status === "defaulted" ? "danger" :
                        r.open_for_financing ? "info" : "neutral"
                      }>
                        {r.status === "paid" ? "Pago" :
                         r.status === "overdue" ? "Atrasado" :
                         r.status === "defaulted" ? "Default" :
                         r.open_for_financing ? "Aberto financ." : "Pendente"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

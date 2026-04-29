import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { ReceivableForm } from "@/components/receivables/ReceivableForm";
import { ReceivablesTable } from "@/components/receivables/ReceivablesTable";
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

        <ReceivablesTable receivables={receivables} />
      </div>
    </>
  );
}

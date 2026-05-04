import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { ReceivableForm } from "@/components/receivables/ReceivableForm";
import { ReceivablesTable } from "@/components/receivables/ReceivablesTable";
import { FileText, AlertCircle, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ReceivablesPage() {
  const [receivables, entities] = await Promise.all([
    repository.getReceivables(),
    repository.getEntities(),
  ]);
  const activeEntities = entities.filter((e) => e.id !== "consolidated");

  // Total a receber por moeda (sem conversao)
  const pendingByCurrency: Record<string, number> = {};
  for (const r of receivables) {
    if (r.status !== "pending" && r.status !== "partial") continue;
    const remaining = r.amount_total - r.amount_received;
    if (remaining <= 0) continue;
    pendingByCurrency[r.currency] = (pendingByCurrency[r.currency] || 0) + remaining;
  }

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
                {Object.entries(pendingByCurrency).length === 0 ? (
                  <p className="text-xl font-bold">$0.00</p>
                ) : (
                  Object.entries(pendingByCurrency).map(([cur, val]) => (
                    <p key={cur} className="text-lg font-bold">{formatCurrency(val, cur)}</p>
                  ))
                )}
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

        <ReceivableForm entities={activeEntities} />

        <ReceivablesTable receivables={receivables} />
      </div>
    </>
  );
}

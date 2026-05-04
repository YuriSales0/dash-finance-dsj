import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { DebtForm } from "@/components/debts/DebtForm";
import { DebtsTable } from "@/components/debts/DebtsTable";
import { CreditCard, AlertTriangle, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function DebtsPage() {
  const [debts, entities] = await Promise.all([
    repository.getDebts(),
    repository.getEntities(),
  ]);
  const activeEntities = entities.filter((e) => e.id !== "consolidated");

  // Total a pagar por moeda (sem conversao)
  const pendingByCurrency: Record<string, number> = {};
  for (const d of debts) {
    if (d.status !== "pending" && d.status !== "partial") continue;
    const remaining = d.amount_total - d.amount_paid;
    if (remaining <= 0) continue;
    pendingByCurrency[d.currency] = (pendingByCurrency[d.currency] || 0) + remaining;
  }

  const overdueCount = debts.filter(
    (d) => d.status !== "paid" && new Date(d.due_date) < new Date()
  ).length;
  const next30 = debts.filter((d) => {
    if (d.status === "paid") return false;
    const days = (new Date(d.due_date).getTime() - new Date().getTime()) / 86400000;
    return days >= 0 && days <= 30;
  }).length;

  // Projecao: quanto as recorrentes vao custar nos proximos 90 dias
  const projectionDays = 90;
  const projectionByCurrency: Record<string, number> = {};
  const now = new Date();
  const projEnd = new Date(now.getTime() + projectionDays * 86400000);
  for (const d of debts) {
    if (!d.is_recurring || !d.recurrence_interval) continue;
    if (d.recurrence_end_date && new Date(d.recurrence_end_date) < now) continue;
    const intervalDays =
      d.recurrence_interval === "weekly" ? 7 :
      d.recurrence_interval === "biweekly" ? 14 :
      d.recurrence_interval === "monthly" ? 30 :
      d.recurrence_interval === "quarterly" ? 90 :
      365;
    const occurrences = Math.floor(projectionDays / intervalDays);
    if (occurrences > 0) {
      const perOccurrence = d.amount_total + (d.fixed_commission || 0);
      projectionByCurrency[d.currency] =
        (projectionByCurrency[d.currency] || 0) + perOccurrence * occurrences;
    }
  }

  const recurringCount = debts.filter((d) => d.is_recurring).length;

  return (
    <>
      <Header title="Dividas" subtitle="Obrigacoes a pagar + projecao futura" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg"><CreditCard className="text-red-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">A pagar</p>
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
          <div className="card card-body">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg"><Calendar className="text-purple-600" size={20} /></div>
              <div>
                <p className="text-xs text-slate-500">Projecao 90 dias (recorrentes)</p>
                {Object.entries(projectionByCurrency).length === 0 ? (
                  <p className="text-lg font-bold text-slate-400">{recurringCount === 0 ? "Nenhuma" : "$0.00"}</p>
                ) : (
                  Object.entries(projectionByCurrency).map(([cur, val]) => (
                    <p key={cur} className="text-lg font-bold text-purple-700">{formatCurrency(val, cur)}</p>
                  ))
                )}
                {recurringCount > 0 && (
                  <p className="text-[10px] text-slate-500">{recurringCount} divida(s) recorrente(s)</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DebtForm entities={activeEntities} />

        <DebtsTable debts={debts} entities={activeEntities} />
      </div>
    </>
  );
}

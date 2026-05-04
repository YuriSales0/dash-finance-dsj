import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { DebtForm } from "@/components/debts/DebtForm";
import { DebtsTable } from "@/components/debts/DebtsTable";
import { PendingByCurrencyCard } from "@/components/debts/PendingByCurrencyCard";
import { AlertTriangle, Calendar } from "lucide-react";

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
  // Montante a vencer nos proximos 30 dias por moeda
  const next30ByCurrency: Record<string, number> = {};
  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 86400000);

  for (const d of debts) {
    if (d.status !== "pending" && d.status !== "partial") continue;
    const remaining = d.amount_total - d.amount_paid;
    if (remaining <= 0) continue;
    pendingByCurrency[d.currency] = (pendingByCurrency[d.currency] || 0) + remaining;

    // Aportes com juros parcelados: no 30 dias so entra o principal se
    // o vencimento FINAL cai em 30 dias. Parcelas de juros sao computadas
    // no loop separado abaixo.
    const isAporteParcelado = d.category === "aporte_investidor" && !!d.interest_payment_interval;

    const due = new Date(d.due_date);
    if (due <= in30Days) {
      if (isAporteParcelado) {
        // So o balloon (principal + comissao) entra — quando o vencimento final cai em 30 dias
        const balloon = remaining + (d.fixed_commission || 0);
        next30ByCurrency[d.currency] = (next30ByCurrency[d.currency] || 0) + balloon;
      } else {
        next30ByCurrency[d.currency] = (next30ByCurrency[d.currency] || 0) + remaining;
      }
    }
    // Se aporte parcelado com vencimento > 30 dias: nao adiciona nada aqui.
    // As parcelas de juros sao somadas no loop "Aportes com juros parcelados" abaixo.
  }

  // Adicionar ocorrencias recorrentes que caem nos proximos 30 dias
  // (sem contar a primeira ocorrencia ja inclusa em pendingByCurrency)
  // Aportes de investidor NAO entram aqui — usam interest_payment_interval
  for (const d of debts) {
    if (!d.is_recurring || !d.recurrence_interval) continue;
    if (d.category === "aporte_investidor") continue;
    if (d.recurrence_end_date && new Date(d.recurrence_end_date) < today) continue;
    const intervalDays =
      d.recurrence_interval === "weekly" ? 7 :
      d.recurrence_interval === "biweekly" ? 14 :
      d.recurrence_interval === "monthly" ? 30 :
      d.recurrence_interval === "quarterly" ? 90 :
      365;
    const extraOccurrences = Math.floor(30 / intervalDays);
    if (extraOccurrences > 0) {
      const perOccurrence = d.amount_total + (d.fixed_commission || 0);
      next30ByCurrency[d.currency] = (next30ByCurrency[d.currency] || 0) + perOccurrence * extraOccurrences;
    }
  }

  // Aportes com juros parcelados: somar parcelas que caem em 30 dias
  for (const d of debts) {
    if (d.category !== "aporte_investidor" || !d.interest_payment_interval) continue;
    if (d.status === "paid") continue;
    const intervalDays =
      d.interest_payment_interval === "weekly" ? 7 :
      d.interest_payment_interval === "biweekly" ? 14 :
      d.interest_payment_interval === "monthly" ? 30 :
      d.interest_payment_interval === "quarterly" ? 90 :
      365;
    const installments = Math.floor(30 / intervalDays);
    if (installments > 0) {
      const interestPayment = d.amount_total * (d.interest_rate_pct || 0) / 100;
      if (interestPayment > 0) {
        next30ByCurrency[d.currency] = (next30ByCurrency[d.currency] || 0) + interestPayment * installments;
      }
    }
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
    if (d.category === "aporte_investidor") continue;
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

  // Aportes com juros parcelados: parcelas em 90 dias
  for (const d of debts) {
    if (d.category !== "aporte_investidor" || !d.interest_payment_interval) continue;
    if (d.status === "paid") continue;
    const intervalDays =
      d.interest_payment_interval === "weekly" ? 7 :
      d.interest_payment_interval === "biweekly" ? 14 :
      d.interest_payment_interval === "monthly" ? 30 :
      d.interest_payment_interval === "quarterly" ? 90 :
      365;
    const installments = Math.floor(projectionDays / intervalDays);
    if (installments > 0) {
      const interestPayment = d.amount_total * (d.interest_rate_pct || 0) / 100;
      if (interestPayment > 0) {
        projectionByCurrency[d.currency] =
          (projectionByCurrency[d.currency] || 0) + interestPayment * installments;
      }
    }
  }

  const recurringCount = debts.filter((d) => d.is_recurring).length;

  // Classificar dividas por prazo de vencimento
  type TermBucket = Record<string, number>;
  const shortTerm: TermBucket = {};  // <= 30 dias
  const mediumTerm: TermBucket = {}; // 31-150 dias
  const longTerm: TermBucket = {};   // > 150 dias
  const overdueByCurrency: TermBucket = {};

  for (const d of debts) {
    if (d.status === "paid") continue;
    const remaining = d.amount_total - d.amount_paid;
    if (remaining <= 0) continue;
    const daysUntilDue = (new Date(d.due_date).getTime() - today.getTime()) / 86400000;

    if (daysUntilDue < 0) {
      overdueByCurrency[d.currency] = (overdueByCurrency[d.currency] || 0) + remaining;
    } else if (daysUntilDue <= 30) {
      shortTerm[d.currency] = (shortTerm[d.currency] || 0) + remaining;
    } else if (daysUntilDue <= 150) {
      mediumTerm[d.currency] = (mediumTerm[d.currency] || 0) + remaining;
    } else {
      longTerm[d.currency] = (longTerm[d.currency] || 0) + remaining;
    }
  }

  return (
    <>
      <Header title="Dividas" subtitle="Obrigacoes a pagar + projecao futura" />
      <div className="p-6 space-y-6">
        {/* Cards de classificacao por prazo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <PendingByCurrencyCard
            debts={debts}
            pendingByCurrency={pendingByCurrency}
            next30ByCurrency={next30ByCurrency}
          />
          <TermCard
            label="Curto prazo"
            sublabel="≤ 30 dias"
            data={shortTerm}
            color="amber"
          />
          <TermCard
            label="Medio prazo"
            sublabel="31-150 dias"
            data={mediumTerm}
            color="blue"
          />
          <TermCard
            label="Longo prazo"
            sublabel="> 150 dias"
            data={longTerm}
            color="slate"
          />
          <TermCard
            label="Atrasadas"
            sublabel="vencidas"
            data={overdueByCurrency}
            color="red"
          />
        </div>

        {/* Projecao recorrentes + parcelas de juros */}
        {(Object.keys(projectionByCurrency).length > 0 || recurringCount > 0) && (
          <div className="card card-body bg-purple-50 border-purple-200">
            <p className="text-xs text-purple-700 font-medium mb-1">Projecao 90 dias (recorrentes + parcelas de juros)</p>
            {Object.entries(projectionByCurrency).length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma obrigacao recorrente</p>
            ) : (
              <div className="flex gap-4 flex-wrap">
                {Object.entries(projectionByCurrency).map(([cur, val]) => (
                  <p key={cur} className="text-lg font-bold text-purple-700">{formatCurrency(val, cur)}</p>
                ))}
              </div>
            )}
            {recurringCount > 0 && (
              <p className="text-[10px] text-purple-600 mt-1">{recurringCount} divida(s) recorrente(s) ativas</p>
            )}
          </div>
        )}

        <DebtForm entities={activeEntities} />

        <DebtsTable debts={debts} entities={activeEntities} />
      </div>
    </>
  );
}

const TERM_COLORS: Record<string, { bg: string; icon: string; text: string }> = {
  amber: { bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-700" },
  blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-700" },
  slate: { bg: "bg-slate-100", icon: "text-slate-500", text: "text-slate-700" },
  red: { bg: "bg-red-50", icon: "text-red-600", text: "text-red-700" },
};

function TermCard({
  label,
  sublabel,
  data,
  color,
}: {
  label: string;
  sublabel: string;
  data: Record<string, number>;
  color: string;
}) {
  const c = TERM_COLORS[color] || TERM_COLORS.slate;
  const entries = Object.entries(data);
  return (
    <div className="card card-body">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <Calendar className={c.icon} size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-[10px] text-slate-400">{sublabel}</p>
          {entries.length === 0 ? (
            <p className="text-lg font-bold text-slate-300 mt-0.5">—</p>
          ) : (
            entries.map(([cur, val]) => (
              <p key={cur} className={`text-lg font-bold mt-0.5 ${c.text}`}>
                {formatCurrency(val, cur)}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

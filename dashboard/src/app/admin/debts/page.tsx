import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { DebtForm } from "@/components/debts/DebtForm";
import { DebtsTable } from "@/components/debts/DebtsTable";
import { TermCardWithDetails, type DebtOccurrence } from "@/components/debts/TermCardWithDetails";
import type { Debt } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function intervalDaysFor(interval: string | null | undefined): number {
  return interval === "weekly" ? 7 :
         interval === "biweekly" ? 14 :
         interval === "monthly" ? 30 :
         interval === "quarterly" ? 90 :
         interval === "yearly" ? 365 :
         0;
}

const TERM_HORIZON_DAYS = 365;

// Gera todas as ocorrencias futuras + atrasadas de uma divida.
// Para recorrentes/parcelados, ja desconta as ocorrencias quitadas (via amount_paid).
// Marca is_next_unpaid=true APENAS na primeira ocorrencia cronologica (mais antiga
// ou mais proxima de hoje) — pra UX clara de "marcar pago = pagar a proxima".
function generateOccurrences(d: Debt, today: Date): DebtOccurrence[] {
  if (d.status === "paid") return [];
  const remaining = d.amount_total - d.amount_paid;
  if (remaining <= 0) return [];

  const issueDate = new Date(d.issue_date);
  const dueDate = new Date(d.due_date);
  const daysUntilDue = (dueDate.getTime() - today.getTime()) / 86400000;
  const isAporte = d.category === "aporte_investidor";
  const isEmprestimo = d.category === "emprestimo";
  const isAporteParcelado = isAporte && !!d.interest_payment_interval;
  const isEmprestimoParcelado = isEmprestimo && !!d.interest_payment_interval;
  const commission = d.fixed_commission || 0;
  const isPerpetualRecurring = !!(d.is_recurring && !d.recurrence_end_date);

  const out: DebtOccurrence[] = [];
  const baseFields = {
    debt_id: d.id,
    description: d.description,
    creditor: d.creditor,
    entity_id: d.entity_id,
    currency: d.currency,
    amount_paid: d.amount_paid,
    amount_total: d.amount_total,
    is_perpetual_recurring: isPerpetualRecurring,
  };

  if (isAporteParcelado) {
    const intDays = intervalDaysFor(d.interest_payment_interval);
    const interestPerPayment = d.amount_total * (d.interest_rate_pct || 0) / 100;
    if (intDays > 0 && interestPerPayment > 0) {
      const limitDays = Math.min(daysUntilDue, TERM_HORIZON_DAYS);
      const totalInstallments = Math.max(0, Math.floor(limitDays / intDays));
      const paidInstallments = Math.floor(d.amount_paid / interestPerPayment);
      for (let i = 1; i <= totalInstallments; i++) {
        if (i <= paidInstallments) continue;
        const paymentDate = new Date(today.getTime() + i * intDays * 86400000);
        out.push({
          ...baseFields,
          amount: interestPerPayment,
          payment_date: paymentDate.toISOString().slice(0, 10),
          days_from_today: i * intDays,
          kind: "aporte_juros",
          occurrence_index: i,
          total_occurrences: totalInstallments,
          per_occurrence_amount: interestPerPayment,
          is_next_unpaid: i === paidInstallments + 1,
        });
      }
    }
    // Balloon: principal restante + comissao no due_date
    const balloon = remaining + commission;
    if (balloon > 0) {
      out.push({
        ...baseFields,
        amount: balloon,
        payment_date: d.due_date,
        days_from_today: daysUntilDue,
        kind: "aporte_balloon",
        per_occurrence_amount: balloon,
        is_next_unpaid: false, // balloon e pago no fim, nao via mark-paid incremental
      });
    }
  } else if (isEmprestimoParcelado) {
    const intDays = intervalDaysFor(d.interest_payment_interval);
    if (intDays > 0) {
      const periodDays = Math.max(0, (dueDate.getTime() - issueDate.getTime()) / 86400000);
      const installmentsTotal = Math.floor(periodDays / intDays);
      if (installmentsTotal > 0) {
        const perInstallment = d.amount_total / installmentsTotal;
        const paidInstallments = Math.floor(d.amount_paid / perInstallment);
        for (let i = 1; i <= installmentsTotal; i++) {
          if (i <= paidInstallments) continue;
          const paymentDate = new Date(issueDate.getTime() + i * intDays * 86400000);
          const daysFromToday = (paymentDate.getTime() - today.getTime()) / 86400000;
          out.push({
            ...baseFields,
            amount: perInstallment,
            payment_date: paymentDate.toISOString().slice(0, 10),
            days_from_today: daysFromToday,
            kind: "emprestimo_parcela",
            occurrence_index: i,
            total_occurrences: installmentsTotal,
            per_occurrence_amount: perInstallment,
            is_next_unpaid: i === paidInstallments + 1,
          });
        }
      } else {
        out.push({
          ...baseFields,
          amount: remaining,
          payment_date: d.due_date,
          days_from_today: daysUntilDue,
          kind: "pontual",
          per_occurrence_amount: remaining,
          is_next_unpaid: false,
        });
      }
    }
  } else if (d.is_recurring && d.recurrence_interval) {
    // Recorrente: itera todas as ocorrencias entre issue_date e (today + horizonte | recurrence_end_date),
    // pulando as primeiras `paidOccurrences` (em ordem cronologica desde a primeira ocorrencia, due_date).
    const intDays = intervalDaysFor(d.recurrence_interval);
    const perOccurrence = d.amount_total + commission;
    if (intDays > 0 && perOccurrence > 0) {
      const recurrenceEnd = d.recurrence_end_date ? new Date(d.recurrence_end_date) : null;
      const horizonEnd = new Date(today.getTime() + TERM_HORIZON_DAYS * 86400000);
      const lastDate = recurrenceEnd && recurrenceEnd < horizonEnd ? recurrenceEnd : horizonEnd;

      const paidOccurrences = Math.floor(d.amount_paid / perOccurrence);
      let occDate = new Date(dueDate);
      let occIndex = 0;
      let firstUnpaidAdded = false;
      while (occDate <= lastDate) {
        occIndex++;
        if (occIndex > paidOccurrences) {
          const days = (occDate.getTime() - today.getTime()) / 86400000;
          out.push({
            ...baseFields,
            amount: perOccurrence,
            payment_date: occDate.toISOString().slice(0, 10),
            days_from_today: days,
            kind: "recorrente",
            occurrence_index: occIndex,
            per_occurrence_amount: perOccurrence,
            is_next_unpaid: !firstUnpaidAdded,
          });
          firstUnpaidAdded = true;
        }
        occDate = new Date(occDate.getTime() + intDays * 86400000);
      }
    }
  } else {
    // Pontual
    const total = remaining + (isAporte ? commission : 0);
    out.push({
      ...baseFields,
      amount: total,
      payment_date: d.due_date,
      days_from_today: daysUntilDue,
      kind: "pontual",
      per_occurrence_amount: total,
      is_next_unpaid: false,
    });
  }

  return out;
}

function bucketName(daysFromNow: number): "overdue" | "short" | "medium" | "long" {
  if (daysFromNow < 0) return "overdue";
  if (daysFromNow <= 35) return "short";
  if (daysFromNow <= 150) return "medium";
  return "long";
}

export default async function DebtsPage() {
  const [debts, entities] = await Promise.all([
    repository.getDebts(),
    repository.getEntities(),
  ]);
  const activeEntities = entities.filter((e) => e.id !== "consolidated");
  const today = new Date();

  // Gerar TODAS as ocorrencias com metadata completa
  const allOccurrences: DebtOccurrence[] = [];
  for (const d of debts) {
    allOccurrences.push(...generateOccurrences(d, today));
  }

  // Bucketizar
  const occurrencesByBucket: Record<"overdue" | "short" | "medium" | "long", DebtOccurrence[]> = {
    overdue: [],
    short: [],
    medium: [],
    long: [],
  };
  for (const o of allOccurrences) {
    occurrencesByBucket[bucketName(o.days_from_today)].push(o);
  }

  // Totais por moeda em cada bucket (para o card pequeno)
  function totalsByCurrency(occs: DebtOccurrence[]): Record<string, number> {
    const t: Record<string, number> = {};
    for (const o of occs) t[o.currency] = (t[o.currency] || 0) + o.amount;
    return t;
  }

  // "A pagar" (imediato) = atrasadas + curto prazo (ocorrencias combinadas)
  const immediateOccurrences = [
    ...occurrencesByBucket.overdue,
    ...occurrencesByBucket.short,
  ];

  // Projecao 90 dias: soma de ocorrencias com days_from_today em [0, 90]
  const projectionDays = 90;
  const projectionByCurrency: Record<string, number> = {};
  for (const o of allOccurrences) {
    if (o.days_from_today < 0 || o.days_from_today > projectionDays) continue;
    projectionByCurrency[o.currency] = (projectionByCurrency[o.currency] || 0) + o.amount;
  }

  const recurringCount = debts.filter((d) => d.is_recurring).length;

  return (
    <>
      <Header title="Dividas" subtitle="Obrigacoes a pagar + projecao futura" />
      <div className="p-6 space-y-6">
        {/* Cards de classificacao por prazo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <TermCardWithDetails
            label="A pagar (imediato)"
            sublabel="atrasadas + ≤ 35 dias"
            color="red"
            occurrences={immediateOccurrences}
          />
          <TermCardWithDetails
            label="Curto prazo"
            sublabel="≤ 35 dias"
            color="amber"
            occurrences={occurrencesByBucket.short}
          />
          <TermCardWithDetails
            label="Medio prazo"
            sublabel="36-150 dias"
            color="blue"
            occurrences={occurrencesByBucket.medium}
          />
          <TermCardWithDetails
            label="Longo prazo"
            sublabel="> 150 dias"
            color="slate"
            occurrences={occurrencesByBucket.long}
          />
          <TermCardWithDetails
            label="Atrasadas"
            sublabel="vencidas"
            color="red"
            occurrences={occurrencesByBucket.overdue}
          />
        </div>

        {/* Projecao recorrentes + parcelas de juros */}
        {(Object.keys(projectionByCurrency).length > 0 || recurringCount > 0) && (
          <div className="card card-body bg-purple-50 border-purple-200">
            <p className="text-xs text-purple-700 font-medium mb-1">
              Projecao 90 dias (recorrentes + parcelas de juros + emprestimos parcelados)
            </p>
            {Object.entries(projectionByCurrency).length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma obrigacao recorrente</p>
            ) : (
              <div className="flex gap-4 flex-wrap">
                {Object.entries(projectionByCurrency).map(([cur, val]) => (
                  <p key={cur} className="text-lg font-bold text-purple-700">
                    {formatCurrency(val, cur)}
                  </p>
                ))}
              </div>
            )}
            {recurringCount > 0 && (
              <p className="text-[10px] text-purple-600 mt-1">
                {recurringCount} divida(s) recorrente(s) ativas
              </p>
            )}
          </div>
        )}

        <DebtForm entities={activeEntities} />

        <DebtsTable debts={debts} entities={activeEntities} />
      </div>
    </>
  );
}

import type { Debt } from "@/types/database";
import type { DebtOccurrence } from "@/components/debts/TermCardWithDetails";

export const TERM_HORIZON_DAYS = 365;

export function intervalDaysFor(interval: string | null | undefined): number {
  return interval === "weekly" ? 7 :
         interval === "biweekly" ? 14 :
         interval === "monthly" ? 30 :
         interval === "quarterly" ? 90 :
         interval === "yearly" ? 365 :
         0;
}

export function bucketName(daysFromNow: number): "overdue" | "short" | "medium" | "long" {
  if (daysFromNow < 0) return "overdue";
  if (daysFromNow <= 35) return "short";
  if (daysFromNow <= 150) return "medium";
  return "long";
}

// Gera todas as ocorrencias futuras + atrasadas de uma divida.
// Para recorrentes/parcelados, ja desconta as ocorrencias quitadas (via amount_paid).
// Marca is_next_unpaid=true APENAS na primeira ocorrencia cronologica nao paga.
export function generateOccurrences(d: Debt, today: Date): DebtOccurrence[] {
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

  function partialCarryoverFor(perOcc: number): { paidFull: number; partial: number } {
    if (perOcc <= 0) return { paidFull: 0, partial: 0 };
    const paidFull = Math.floor(d.amount_paid / perOcc);
    const partial = d.amount_paid - paidFull * perOcc;
    return { paidFull, partial };
  }

  if (isAporteParcelado) {
    const intDays = intervalDaysFor(d.interest_payment_interval);
    const interestPerPayment = d.amount_total * (d.interest_rate_pct || 0) / 100;
    if (intDays > 0 && interestPerPayment > 0) {
      const limitDays = Math.min(daysUntilDue, TERM_HORIZON_DAYS);
      const totalInstallments = Math.max(0, Math.floor(limitDays / intDays));
      const { paidFull, partial } = partialCarryoverFor(interestPerPayment);
      for (let i = 1; i <= totalInstallments; i++) {
        if (i <= paidFull) continue;
        const isFirstUnpaid = i === paidFull + 1;
        const partialOnThis = isFirstUnpaid ? partial : 0;
        const remainingOnThis = interestPerPayment - partialOnThis;
        const paymentDate = new Date(today.getTime() + i * intDays * 86400000);
        out.push({
          ...baseFields,
          amount: remainingOnThis,
          payment_date: paymentDate.toISOString().slice(0, 10),
          days_from_today: i * intDays,
          kind: "aporte_juros",
          occurrence_index: i,
          total_occurrences: totalInstallments,
          per_occurrence_amount: interestPerPayment,
          partial_paid_on_this: partialOnThis,
          is_next_unpaid: isFirstUnpaid,
        });
      }
    }
    const balloon = remaining + commission;
    if (balloon > 0) {
      out.push({
        ...baseFields,
        amount: balloon,
        payment_date: d.due_date,
        days_from_today: daysUntilDue,
        kind: "aporte_balloon",
        per_occurrence_amount: balloon,
        partial_paid_on_this: 0,
        is_next_unpaid: false,
      });
    }
  } else if (isEmprestimoParcelado) {
    const intDays = intervalDaysFor(d.interest_payment_interval);
    if (intDays > 0) {
      const periodDays = Math.max(0, (dueDate.getTime() - issueDate.getTime()) / 86400000);
      const installmentsTotal = Math.floor(periodDays / intDays);
      if (installmentsTotal > 0) {
        const perInstallment = d.amount_total / installmentsTotal;
        const { paidFull, partial } = partialCarryoverFor(perInstallment);
        for (let i = 1; i <= installmentsTotal; i++) {
          if (i <= paidFull) continue;
          const isFirstUnpaid = i === paidFull + 1;
          const partialOnThis = isFirstUnpaid ? partial : 0;
          const remainingOnThis = perInstallment - partialOnThis;
          const paymentDate = new Date(issueDate.getTime() + i * intDays * 86400000);
          const daysFromToday = (paymentDate.getTime() - today.getTime()) / 86400000;
          out.push({
            ...baseFields,
            amount: remainingOnThis,
            payment_date: paymentDate.toISOString().slice(0, 10),
            days_from_today: daysFromToday,
            kind: "emprestimo_parcela",
            occurrence_index: i,
            total_occurrences: installmentsTotal,
            per_occurrence_amount: perInstallment,
            partial_paid_on_this: partialOnThis,
            is_next_unpaid: isFirstUnpaid,
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
          partial_paid_on_this: 0,
          is_next_unpaid: false,
        });
      }
    }
  } else if (d.is_recurring && d.recurrence_interval) {
    const intDays = intervalDaysFor(d.recurrence_interval);
    const perOccurrence = d.amount_total + commission;
    if (intDays > 0 && perOccurrence > 0) {
      const recurrenceEnd = d.recurrence_end_date ? new Date(d.recurrence_end_date) : null;
      const horizonEnd = new Date(today.getTime() + TERM_HORIZON_DAYS * 86400000);
      const lastDate = recurrenceEnd && recurrenceEnd < horizonEnd ? recurrenceEnd : horizonEnd;

      const { paidFull, partial } = partialCarryoverFor(perOccurrence);
      let occDate = new Date(dueDate);
      let occIndex = 0;
      let firstUnpaidAdded = false;
      while (occDate <= lastDate) {
        occIndex++;
        if (occIndex > paidFull) {
          const isFirstUnpaid = !firstUnpaidAdded;
          const partialOnThis = isFirstUnpaid ? partial : 0;
          const remainingOnThis = perOccurrence - partialOnThis;
          const days = (occDate.getTime() - today.getTime()) / 86400000;
          out.push({
            ...baseFields,
            amount: remainingOnThis,
            payment_date: occDate.toISOString().slice(0, 10),
            days_from_today: days,
            kind: "recorrente",
            occurrence_index: occIndex,
            per_occurrence_amount: perOccurrence,
            partial_paid_on_this: partialOnThis,
            is_next_unpaid: isFirstUnpaid,
          });
          firstUnpaidAdded = true;
        }
        occDate = new Date(occDate.getTime() + intDays * 86400000);
      }
    }
  } else {
    const total = d.amount_total + (isAporte ? commission : 0);
    const partialOnThis = Math.min(d.amount_paid, total);
    const remainingOnThis = total - partialOnThis;
    out.push({
      ...baseFields,
      amount: remainingOnThis,
      payment_date: d.due_date,
      days_from_today: daysUntilDue,
      kind: "pontual",
      per_occurrence_amount: total,
      partial_paid_on_this: partialOnThis,
      is_next_unpaid: true,
    });
  }

  return out;
}

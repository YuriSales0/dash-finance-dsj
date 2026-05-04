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

  // Total a pagar por moeda — calculado APOS os buckets pra ser consistente
  // (a soma dos buckets de prazo)
  const pendingByCurrency: Record<string, number> = {};
  // Montante a vencer nos proximos 30 dias por moeda — overdue + curto prazo
  const next30ByCurrency: Record<string, number> = {};
  const today = new Date();

  // Os calculos de pendingByCurrency e next30ByCurrency sao feitos APOS o
  // loop dos buckets (no final desta funcao), pra serem consistentes.

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

  // Classificar dividas por prazo de vencimento (TODOS os pagamentos futuros, nao so o due_date)
  // Curto: dias [0, 35] | Medio: (35, 150] | Longo: (150, infinito) | Atrasadas: dias < 0
  // Curto = 35d (nao 30d) pra captar pagamentos mensais com calendar drift
  // (ex: salario com due_date 31 dias depois do issue, mes com 31 dias)
  type TermBucket = Record<string, number>;
  const shortTerm: TermBucket = {};
  const mediumTerm: TermBucket = {};
  const longTerm: TermBucket = {};
  const overdueByCurrency: TermBucket = {};

  function bucketFor(daysFromNow: number): TermBucket {
    if (daysFromNow < 0) return overdueByCurrency;
    if (daysFromNow <= 35) return shortTerm;
    if (daysFromNow <= 150) return mediumTerm;
    return longTerm;
  }

  function intervalDaysFor(interval: string | null | undefined): number {
    return interval === "weekly" ? 7 :
           interval === "biweekly" ? 14 :
           interval === "monthly" ? 30 :
           interval === "quarterly" ? 90 :
           interval === "yearly" ? 365 :
           0;
  }

  // Janela de projecao: ate o vencimento da divida ou recorrencia (cap em 1 ano pra long prazo)
  const TERM_HORIZON_DAYS = 365;

  for (const d of debts) {
    if (d.status === "paid") continue;
    const remaining = d.amount_total - d.amount_paid;
    if (remaining <= 0) continue;

    const dueDate = new Date(d.due_date);
    const daysUntilDue = (dueDate.getTime() - today.getTime()) / 86400000;
    const isAporte = d.category === "aporte_investidor";
    const isAporteParcelado = isAporte && !!d.interest_payment_interval;
    const commission = d.fixed_commission || 0;

    if (isAporteParcelado) {
      // 1) Parcelas de juros em cada bucket
      const intDays = intervalDaysFor(d.interest_payment_interval);
      const interestPerPayment = d.amount_total * (d.interest_rate_pct || 0) / 100;
      if (intDays > 0 && interestPerPayment > 0) {
        // Quantas parcelas cabem ate o vencimento (ou ate o horizonte)
        const limitDays = Math.min(daysUntilDue, TERM_HORIZON_DAYS);
        const installments = Math.floor(limitDays / intDays);
        for (let i = 1; i <= installments; i++) {
          const paymentDay = i * intDays;
          const bucket = bucketFor(paymentDay);
          bucket[d.currency] = (bucket[d.currency] || 0) + interestPerPayment;
        }
      }
      // 2) Balloon final (principal + comissao) no bucket do due_date
      const balloon = remaining + commission;
      const bucket = bucketFor(daysUntilDue);
      bucket[d.currency] = (bucket[d.currency] || 0) + balloon;
    } else if (d.is_recurring && d.recurrence_interval) {
      // Recorrencia normal (salario, assinatura): cada ocorrencia entra no bucket pelo dia
      const intDays = intervalDaysFor(d.recurrence_interval);
      const perOccurrence = d.amount_total + commission;
      const recurrenceEnd = d.recurrence_end_date ? new Date(d.recurrence_end_date) : null;
      const recurrenceLimitDays = recurrenceEnd
        ? Math.min(TERM_HORIZON_DAYS, (recurrenceEnd.getTime() - today.getTime()) / 86400000)
        : TERM_HORIZON_DAYS;

      if (intDays > 0 && perOccurrence > 0) {
        // Primeira ocorrencia: o due_date original (pode ser passado, presente ou futuro)
        let occDays = daysUntilDue;
        // Se due_date ja passou, avanca pra proxima ocorrencia futura
        while (occDays < 0) occDays += intDays;
        while (occDays <= recurrenceLimitDays) {
          const bucket = bucketFor(occDays);
          bucket[d.currency] = (bucket[d.currency] || 0) + perOccurrence;
          occDays += intDays;
        }
        // Atrasadas (due_date < today): a primeira ocorrencia atrasada
        if (daysUntilDue < 0) {
          overdueByCurrency[d.currency] = (overdueByCurrency[d.currency] || 0) + perOccurrence;
        }
      }
    } else {
      // Divida pontual (nao recorrente, nao aporte parcelado)
      const total = remaining + (isAporte ? commission : 0);
      const bucket = bucketFor(daysUntilDue);
      bucket[d.currency] = (bucket[d.currency] || 0) + total;
    }
  }

  // Popular pendingByCurrency e next30ByCurrency a partir dos buckets
  // "A pagar" agora = obrigacoes IMEDIATAS (atrasadas + curto prazo)
  // Para projecao de longo prazo, ver os cards de Medio e Longo separadamente.
  const allCurrencies = Array.from(new Set<string>([
    ...Object.keys(shortTerm),
    ...Object.keys(mediumTerm),
    ...Object.keys(longTerm),
    ...Object.keys(overdueByCurrency),
  ]));
  for (const cur of allCurrencies) {
    const immediate = (overdueByCurrency[cur] || 0) + (shortTerm[cur] || 0);
    if (immediate > 0) pendingByCurrency[cur] = immediate;
    if (immediate > 0) next30ByCurrency[cur] = immediate;
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
            sublabel="≤ 35 dias"
            data={shortTerm}
            color="amber"
          />
          <TermCard
            label="Medio prazo"
            sublabel="36-150 dias"
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

import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { formatCurrency } from "@/lib/format";
import { DebtForm } from "@/components/debts/DebtForm";
import { DebtsTable } from "@/components/debts/DebtsTable";
import { TermCardWithDetails, type DebtOccurrence } from "@/components/debts/TermCardWithDetails";
import { generateOccurrences, bucketName } from "@/lib/debts/occurrences";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";


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

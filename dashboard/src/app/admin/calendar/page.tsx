import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import {
  WeeklyCalendar,
  type CalendarDay,
  type CalendarInflow,
  type CalendarOutflow,
} from "@/components/calendar/WeeklyCalendar";
import { generateOccurrences } from "@/lib/debts/occurrences";
import { isTestReceivable } from "@/lib/receivables/isTest";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// L9: helpers de data sempre em "local-iso" (YYYY-MM-DD via componentes
// locais, nao toISOString que retorna UTC). Antes mistura local/UTC podia
// shiftar 1 dia em timezones nao-UTC (Brasil eh UTC-3).
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date): string {
  const day = d.getDay(); // 0=domingo, 1=segunda, ..., 6=sabado
  const offset = day === 0 ? -6 : 1 - day; // segunda como inicio
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + offset);
  return toLocalIso(monday);
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toLocalIso(d);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { week?: string };
}) {
  const today = new Date();
  const todayIso = toLocalIso(today);
  // weekStart: dia 'segunda' da semana selecionada
  const weekStart = searchParams.week
    ? mondayOf(new Date(searchParams.week + "T00:00:00"))
    : mondayOf(today);

  const weekEnd = addDaysIso(weekStart, 6);

  const [debts, allReceivables] = await Promise.all([
    repository.getDebts(),
    repository.getReceivables(),
  ]);
  const receivables = allReceivables.filter((r) => !isTestReceivable(r));

  // Gerar ocorrencias de divida (mesma logica de /admin/debts)
  const allOccurrences = debts.flatMap((d) => generateOccurrences(d, today));

  // Inicializar 7 dias
  const dayMap: Record<string, CalendarDay> = {};
  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(weekStart, i);
    dayMap[date] = { date, inflows: [], outflows: [] };
  }

  // Popular saidas (debt occurrences) que caem na semana
  for (const o of allOccurrences) {
    const date = o.payment_date;
    if (date < weekStart || date > weekEnd) continue;
    if (!dayMap[date]) continue;
    const out: CalendarOutflow = {
      debt_id: o.debt_id,
      description: o.description,
      creditor: o.creditor,
      entity_id: o.entity_id,
      amount: o.amount,
      currency: o.currency,
      kind: o.kind,
      occurrence_index: o.occurrence_index,
      total_occurrences: o.total_occurrences,
    };
    dayMap[date].outflows.push(out);
  }

  // Popular entradas (recebiveis) que vencem na semana
  for (const r of receivables) {
    if (r.status === "paid" || r.status === "defaulted") continue;
    const remaining = r.amount_total - r.amount_received;
    if (remaining <= 0) continue;
    const date = r.due_date;
    if (date < weekStart || date > weekEnd) continue;
    if (!dayMap[date]) continue;
    const inflow: CalendarInflow = {
      receivable_id: r.id,
      description: r.description,
      counterparty: r.counterparty,
      entity_id: r.entity_id,
      amount: remaining,
      currency: r.currency,
    };
    dayMap[date].inflows.push(inflow);
  }

  // Ordenar dias
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysIso(weekStart, i);
    days.push(dayMap[date]);
  }

  return (
    <>
      <Header
        title="Calendario semanal"
        subtitle="Pagamentos a fazer + recebiveis a receber, dia a dia"
      />
      <div className="p-6">
        <WeeklyCalendar weekStart={weekStart} days={days} todayIso={todayIso} />
      </div>
    </>
  );
}

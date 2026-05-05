import { repository } from "@/lib/data/repository";
import { InvestorHomeView } from "@/components/investor/InvestorHomeView";

export const dynamic = "force-dynamic";

export default async function InvestorHome() {
  const [metrics, pnl12m, allReceivables] = await Promise.all([
    repository.getInvestorMetrics(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 12 }),
    repository.getReceivables(),
  ]);

  const open = allReceivables.filter(
    (r) => r.open_for_financing && r.status !== "paid"
  );

  // Pipeline: recebiveis em aberto vencendo no ano corrente, por moeda.
  // Exclui paid/defaulted; soma o saldo restante (amount_total - amount_received).
  const pipelineYear = new Date().getFullYear();
  const pipelineByCurrency: Record<string, number> = {};
  for (const r of allReceivables) {
    if (r.status === "paid" || r.status === "defaulted") continue;
    if (!r.due_date || !r.currency) continue;
    const dueYear = new Date(r.due_date).getFullYear();
    if (dueYear !== pipelineYear) continue;
    const remaining = r.amount_total - r.amount_received;
    if (remaining <= 0) continue;
    pipelineByCurrency[r.currency] = (pipelineByCurrency[r.currency] || 0) + remaining;
  }

  return (
    <InvestorHomeView
      metrics={metrics}
      pnl12m={pnl12m}
      openReceivables={open}
      pipelineByCurrency={pipelineByCurrency}
      pipelineYear={pipelineYear}
    />
  );
}

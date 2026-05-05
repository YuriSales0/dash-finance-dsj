import { repository } from "@/lib/data/repository";
import { InvestorHomeView } from "@/components/investor/InvestorHomeView";

export const dynamic = "force-dynamic";

export default async function InvestorHome() {
  const [metrics, pnl12m, openReceivables] = await Promise.all([
    repository.getInvestorMetrics(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 12 }),
    repository.getReceivables({ open_for_financing: true }),
  ]);

  const open = openReceivables.filter((r) => r.status !== "paid");

  return (
    <InvestorHomeView
      metrics={metrics}
      pnl12m={pnl12m}
      openReceivables={open}
    />
  );
}

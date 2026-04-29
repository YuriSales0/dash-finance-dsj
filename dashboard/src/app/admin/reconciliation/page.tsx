import { Header } from "@/components/layout/Header";
import { ReconciliationView } from "@/components/reconciliation/ReconciliationView";
import { repository } from "@/lib/data/repository";
import { entityNames } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; account?: string };
}) {
  const accounts = await repository.getBankAccounts();

  return (
    <>
      <Header
        title="Reconciliacao"
        subtitle="Entrada vs saida por conta, categoria e mes"
      />
      <div className="p-6 space-y-6">
        <ReconciliationView
          accounts={accounts.map((a) => ({
            id: a.id,
            label: `${entityNames[a.entity_id] || a.entity_id} - ${a.bank_name} (${a.currency})`,
            currency: a.currency,
            entity_id: a.entity_id,
          }))}
          initialFrom={searchParams.from}
          initialTo={searchParams.to}
          initialAccount={searchParams.account}
        />
      </div>
    </>
  );
}

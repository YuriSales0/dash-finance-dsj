import { Header } from "@/components/layout/Header";
import { TransactionsTabs } from "@/components/transactions/TransactionsTabs";
import { repository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const [transactions, accounts, entities] = await Promise.all([
    repository.getTransactions({ limit: 5000 }),
    repository.getBankAccounts(),
    repository.getEntities(),
  ]);

  const reviewCount = transactions.filter((t) => t.needs_review).length;
  const tab = (searchParams.tab as "list" | "reconciliation" | "audit") || "list";

  return (
    <>
      <Header
        title="Transacoes"
        subtitle={`${transactions.length} transacoes • ${reviewCount} para revisar`}
        pendingReviews={reviewCount}
      />
      <div className="p-6">
        <TransactionsTabs
          activeTab={tab}
          transactions={transactions}
          accounts={accounts}
          entities={entities.map((e) => ({ id: e.id, name: e.name }))}
        />
      </div>
    </>
  );
}

import { Header } from "@/components/layout/Header";
import { TransactionsList } from "@/components/transactions/TransactionsList";
import { repository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [transactions, accounts, entities] = await Promise.all([
    repository.getTransactions({ limit: 5000 }),
    repository.getBankAccounts(),
    repository.getEntities(),
  ]);

  const reviewCount = transactions.filter((t) => t.needs_review).length;

  return (
    <>
      <Header
        title="Transacoes"
        subtitle={`${transactions.length} transacoes`}
        pendingReviews={reviewCount}
      />
      <div className="p-6">
        <TransactionsList
          transactions={transactions}
          accounts={accounts}
          entities={entities.map((e) => ({ id: e.id, name: e.name }))}
        />
      </div>
    </>
  );
}

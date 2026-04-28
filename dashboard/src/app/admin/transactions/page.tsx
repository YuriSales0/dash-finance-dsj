import { Header } from "@/components/layout/Header";
import { TransactionsList } from "@/components/transactions/TransactionsList";
import { repository } from "@/lib/data/repository";

export default async function TransactionsPage() {
  const [transactions, accounts] = await Promise.all([
    repository.getTransactions(),
    repository.getBankAccounts(),
  ]);

  const reviewCount = transactions.filter((t) => t.needs_review).length;

  return (
    <>
      <Header
        title="Transacoes"
        subtitle={`${transactions.length} transacoes nos ultimos 60 dias`}
        pendingReviews={reviewCount}
      />
      <div className="p-6">
        <TransactionsList transactions={transactions} accounts={accounts} />
      </div>
    </>
  );
}

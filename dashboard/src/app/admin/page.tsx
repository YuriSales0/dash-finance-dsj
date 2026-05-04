import { Header } from "@/components/layout/Header";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { BookkeepingStatus } from "@/components/dashboard/BookkeepingStatus";
import { PnlOverview } from "@/components/dashboard/PnlOverview";
import { Badge } from "@/components/ui/Badge";
import { repository } from "@/lib/data/repository";
import { formatCurrency, entityColors, entityNames } from "@/lib/format";
import { AlertTriangle, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function OverviewPage() {
  const [accounts, pnl24m, cashflow24m, allPendingTx, receivables, debts] = await Promise.all([
    repository.getBankAccounts(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 24 }),
    repository.getMonthlyCashflow(24),
    repository.getTransactions({ needs_review: true }),
    repository.getReceivables(),
    repository.getDebts(),
  ]);
  const pendingReviewCount = allPendingTx.length;

  const today = new Date();
  const receivablesOverdue = receivables.filter(
    (r) => r.status !== "paid" && new Date(r.due_date) < today
  ).length;
  const debtsOverdue = debts.filter(
    (d) => d.status !== "paid" && new Date(d.due_date) < today
  ).length;

  // Saldos agrupados por moeda (sem conversao)
  const balanceByCurrency: Record<string, number> = {};
  for (const acc of accounts) {
    balanceByCurrency[acc.currency] = (balanceByCurrency[acc.currency] || 0) + acc.balance_current;
  }

  // Recebiveis pendentes por moeda
  const receivablesByCurrency: Record<string, number> = {};
  for (const r of receivables) {
    if (r.status === "paid" || !r.currency) continue;
    const remaining = r.amount_total - r.amount_received;
    if (remaining <= 0) continue;
    receivablesByCurrency[r.currency] = (receivablesByCurrency[r.currency] || 0) + remaining;
  }

  // Dividas pendentes por moeda
  const debtsByCurrency: Record<string, number> = {};
  for (const d of debts) {
    if (d.status === "paid" || !d.currency) continue;
    const remaining = d.amount_total - d.amount_paid;
    if (remaining <= 0) continue;
    debtsByCurrency[d.currency] = (debtsByCurrency[d.currency] || 0) + remaining;
  }

  // Ultima atualizacao
  const lastSyncedAccount = accounts
    .filter((a) => a.last_synced_at)
    .sort((a, b) => (b.last_synced_at || "").localeCompare(a.last_synced_at || ""))[0];

  // Moedas usadas
  const allCurrencies = Array.from(
    new Set([
      ...Object.keys(balanceByCurrency),
      ...Object.keys(receivablesByCurrency),
      ...Object.keys(debtsByCurrency),
    ])
  ).filter((c) => c);

  return (
    <>
      <Header
        title="Visao Geral"
        subtitle="Saldos por moeda + metricas das empresas"
        pendingReviews={pendingReviewCount}
        lastSyncedAt={lastSyncedAccount?.last_synced_at}
      />
      <div className="p-6 space-y-6">
        <BookkeepingStatus
          pendingReviews={pendingReviewCount}
          receivablesOverdue={receivablesOverdue}
          debtsOverdue={debtsOverdue}
          lastSyncedAt={lastSyncedAccount?.last_synced_at || null}
          lastPnlGeneratedAt={pnl24m.length > 0 ? pnl24m[pnl24m.length - 1]?.generated_at : null}
        />

        {/* P&L: Receita / Despesas / Lucro + Reconciliacao — filtro por ano + mes */}
        <PnlOverview pnl={pnl24m} cashflow={cashflow24m} />

        {/* Caixa Total por moeda (saldo + recebiveis + dividas) */}
        <div className="card card-body bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-brand-50 rounded-lg">
              <Wallet size={18} className="text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Caixa Total</p>
              <p className="text-xs text-slate-500">Saldos bancarios + recebiveis - dividas, por moeda</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allCurrencies.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma conta com saldo</p>
            ) : (
              allCurrencies.map((currency) => {
                const bal = balanceByCurrency[currency] || 0;
                const recv = receivablesByCurrency[currency] || 0;
                const debt = debtsByCurrency[currency] || 0;
                return (
                  <div key={currency} className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold bg-slate-100 px-1.5 py-0.5 rounded">{currency}</span>
                    </div>
                    <p className={`text-xl font-bold ${bal >= 0 ? "text-slate-900" : "text-red-600"}`}>
                      {formatCurrency(bal, currency)}
                    </p>
                    <div className="mt-1.5 space-y-0.5 text-[11px]">
                      {recv > 0 && (
                        <p className="text-green-600">+ {formatCurrency(recv, currency)} a receber</p>
                      )}
                      {debt > 0 && (
                        <p className="text-red-600">- {formatCurrency(debt, currency)} a pagar</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alertas */}
        {pendingReviewCount > 0 && (
          <div className="card card-body bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-amber-900">
                  {pendingReviewCount} transacoes pendentes de revisao
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  AI classificou com baixa confianca. Revise para melhorar o aprendizado.
                </p>
                <a href="/admin/transactions" className="text-sm text-amber-900 font-medium underline mt-1 inline-block">
                  Ir para revisao &rarr;
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Saldos por empresa (moeda original) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from(new Set(accounts.map((a) => a.entity_id))).map((entityId) => {
            const entityAccounts = accounts.filter((a) => a.entity_id === entityId);
            return (
              <div key={entityId} className="card card-body">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: entityColors[entityId] }}
                  />
                  <h3 className="font-semibold text-sm">{entityNames[entityId]}</h3>
                </div>
                <div className="space-y-1">
                  {entityAccounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {a.bank_name} ({a.currency})
                      </span>
                      <span className={`font-mono font-semibold ${a.balance_current >= 0 ? "text-slate-700" : "text-red-600"}`}>
                        {formatCurrency(a.balance_current, a.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Gráfico 12 meses */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">Receita x Custos x Lucro (24 meses)</h3>
            <Badge variant="info">Consolidado</Badge>
          </div>
          <div className="card-body">
            <RevenueChart data={pnl24m} />
          </div>
        </div>
      </div>
    </>
  );
}

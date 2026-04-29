import { Header } from "@/components/layout/Header";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { BookkeepingStatus } from "@/components/dashboard/BookkeepingStatus";
import { Badge } from "@/components/ui/Badge";
import { repository } from "@/lib/data/repository";
import { formatCurrency, formatPercent, entityColors, entityNames } from "@/lib/format";
import { convertToUsd } from "@/lib/fx/rates";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function OverviewPage() {
  const [accounts, pnl12m, transactions, receivables, debts] = await Promise.all([
    repository.getBankAccounts(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 12 }),
    repository.getTransactions({ needs_review: true, limit: 100 }),
    repository.getReceivables(),
    repository.getDebts(),
  ]);

  const today = new Date();
  const receivablesOverdue = receivables.filter(
    (r) => r.status !== "paid" && new Date(r.due_date) < today
  ).length;
  const debtsOverdue = debts.filter(
    (d) => d.status !== "paid" && new Date(d.due_date) < today
  ).length;

  // Saldo total em USD (converte GBP/EUR/BRL com cotacao do dia)
  let totalBalanceUsd = 0;
  for (const acc of accounts) {
    if (acc.currency === "USD") {
      totalBalanceUsd += acc.balance_current;
    } else {
      const converted = await convertToUsd(acc.balance_current, acc.currency);
      totalBalanceUsd += converted.amount_usd;
    }
  }

  // Recebiveis pendentes (entrada futura) em USD
  let receivablesPendingUsd = 0;
  for (const r of receivables) {
    if (r.status === "paid") continue;
    const remaining = r.amount_total - r.amount_received;
    if (remaining <= 0) continue;
    const usd = r.currency === "USD"
      ? remaining
      : (await convertToUsd(remaining, r.currency)).amount_usd;
    receivablesPendingUsd += usd;
  }

  // Dividas pendentes (saida futura) em USD
  let debtsPendingUsd = 0;
  for (const d of debts) {
    if (d.status === "paid") continue;
    const remaining = d.amount_total - d.amount_paid;
    if (remaining <= 0) continue;
    const usd = d.currency === "USD"
      ? remaining
      : (await convertToUsd(remaining, d.currency)).amount_usd;
    debtsPendingUsd += usd;
  }

  // Posicao projetada (caixa + recebiveis - dividas)
  const projectedPosition = totalBalanceUsd + receivablesPendingUsd - debtsPendingUsd;

  // Mês mais recente COM DADOS (revenue > 0 ou costs > 0)
  // Se mes atual ta vazio, busca o mais recente com dados
  const currentMonthRaw = pnl12m[pnl12m.length - 1];
  const monthsWithData = pnl12m.filter(
    (p) => p.revenue > 0 || p.total_costs > 0
  );
  const currentMonth = monthsWithData.length > 0
    ? monthsWithData[monthsWithData.length - 1]
    : currentMonthRaw;
  const isShowingHistorical = currentMonth && currentMonth !== currentMonthRaw;

  const currentIdx = pnl12m.findIndex((p) => p === currentMonth);
  const previousMonth = currentIdx > 0 ? pnl12m[currentIdx - 1] : null;
  const revenueGrowth = previousMonth && previousMonth.revenue > 0
    ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100
    : 0;

  // Burn rate = custos totais medios dos meses com dados (max 3)
  const recentWithData = monthsWithData.slice(-3);
  const burnRate = recentWithData.length > 0
    ? recentWithData.reduce((sum, p) => sum + p.total_costs, 0) / recentWithData.length
    : 0;
  const runway = burnRate > 0 ? totalBalanceUsd / burnRate : 0;

  // Saldos por empresa
  const balanceByEntity: Record<string, number> = {};
  for (const a of accounts) {
    const usd = a.currency === "USD"
      ? a.balance_current
      : (await convertToUsd(a.balance_current, a.currency)).amount_usd;
    balanceByEntity[a.entity_id] = (balanceByEntity[a.entity_id] || 0) + usd;
  }

  // Ultima atualizacao
  const lastSyncedAccount = accounts
    .filter((a) => a.last_synced_at)
    .sort((a, b) => (b.last_synced_at || "").localeCompare(a.last_synced_at || ""))[0];

  return (
    <>
      <Header
        title="Visao Geral"
        subtitle="Saldos consolidados + metricas das empresas"
        pendingReviews={transactions.length}
        lastSyncedAt={lastSyncedAccount?.last_synced_at}
      />
      <div className="p-6 space-y-6">
        <BookkeepingStatus
          pendingReviews={transactions.length}
          receivablesOverdue={receivablesOverdue}
          debtsOverdue={debtsOverdue}
          lastSyncedAt={lastSyncedAccount?.last_synced_at || null}
          lastPnlGeneratedAt={currentMonth?.generated_at || null}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card card-body">
            <p className="text-sm text-slate-500">Saldo Total (USD)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(totalBalanceUsd)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{accounts.length} contas</p>
          </div>
          <div className="card card-body">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              Receita
              {isShowingHistorical && currentMonth && (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                  {new Date(currentMonth.month).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </span>
              )}
            </p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(currentMonth?.revenue || 0)}
            </p>
            <p className={`text-xs mt-1 ${revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatPercent(revenueGrowth)} vs mes anterior
            </p>
          </div>
          <div className="card card-body">
            <p className="text-sm text-slate-500">Burn Rate</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(burnRate)}
            </p>
            <p className="text-xs text-slate-400 mt-1">media 3 meses</p>
          </div>
          <div className="card card-body">
            <p className="text-sm text-slate-500">Runway</p>
            <p className={`text-2xl font-bold mt-1 ${runway < 2 ? "text-red-600" : "text-slate-900"}`}>
              {runway > 0 ? runway.toFixed(1) : "-"}
            </p>
            <p className="text-xs text-slate-400 mt-1">meses</p>
          </div>
        </div>

        {/* Valores futuros: recebiveis + dividas + posicao projetada */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/admin/receivables" className="card card-body hover:shadow-md transition-shadow">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <span>Recebiveis</span>
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">a receber</span>
            </p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              +{formatCurrency(receivablesPendingUsd)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {receivables.filter((r) => r.status !== "paid").length} pendente(s)
              {receivablesOverdue > 0 && (
                <span className="ml-2 text-red-600">• {receivablesOverdue} atrasado(s)</span>
              )}
            </p>
          </a>

          <a href="/admin/debts" className="card card-body hover:shadow-md transition-shadow">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <span>Dividas</span>
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">a pagar</span>
            </p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              -{formatCurrency(debtsPendingUsd)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {debts.filter((d) => d.status !== "paid").length} pendente(s)
              {debtsOverdue > 0 && (
                <span className="ml-2 text-red-600">• {debtsOverdue} atrasada(s)</span>
              )}
            </p>
          </a>

          <div className="card card-body bg-slate-50 border-slate-300">
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <span>Posicao Projetada</span>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">caixa + recebiveis - dividas</span>
            </p>
            <p className={`text-2xl font-bold mt-1 ${projectedPosition >= 0 ? "text-slate-900" : "text-red-600"}`}>
              {formatCurrency(projectedPosition)}
            </p>
            <p className="text-xs text-slate-400 mt-1">apos quitacao</p>
          </div>
        </div>

        {/* Alertas */}
        {transactions.length > 0 && (
          <div className="card card-body bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-amber-900">
                  {transactions.length} transacoes pendentes de revisao
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  AI classificou com baixa confianca. Revise para melhorar o aprendizado.
                </p>
                <a href="/transactions" className="text-sm text-amber-900 font-medium underline mt-1 inline-block">
                  Ir para revisao &rarr;
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Saldos por empresa */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(["dsj_network", "universal_mkt", "dsj_connect"] as const).map((entityId) => {
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
                <p className="text-2xl font-bold">
                  {formatCurrency(balanceByEntity[entityId] || 0)}
                </p>
                <div className="mt-3 space-y-1">
                  {entityAccounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {a.bank_name} ({a.currency})
                      </span>
                      <span className="font-mono text-slate-700">
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
            <h3 className="font-semibold">Receita x Custos x Lucro (12 meses)</h3>
            <Badge variant="info">Consolidado USD</Badge>
          </div>
          <div className="card-body">
            <RevenueChart data={pnl12m} />
          </div>
        </div>
      </div>
    </>
  );
}

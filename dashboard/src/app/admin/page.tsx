import { Header } from "@/components/layout/Header";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { BookkeepingStatus } from "@/components/dashboard/BookkeepingStatus";
import { PnlOverview } from "@/components/dashboard/PnlOverview";
import { BalanceCheck } from "@/components/dashboard/BalanceCheck";
import { CaixaTotalCard } from "@/components/dashboard/CaixaTotalCard";
import {
  CashflowProjectionCard,
  type ReceivableEntry,
} from "@/components/dashboard/CashflowProjectionCard";
import { Badge } from "@/components/ui/Badge";
import { repository } from "@/lib/data/repository";
import { formatCurrency, entityColors, entityNames } from "@/lib/format";
import { generateOccurrences, bucketName } from "@/lib/debts/occurrences";
import { isTestReceivable } from "@/lib/receivables/isTest";
import type { DebtOccurrence } from "@/components/debts/TermCardWithDetails";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function OverviewPage() {
  const [
    accounts,
    pnl24m,
    cashflow24m,
    cashflowByCurrency24m,
    balanceCheck,
    allPendingTx,
    allReceivables,
    debts,
  ] = await Promise.all([
    repository.getBankAccounts(),
    repository.getMonthlyPnl({ entity_id: "consolidated", months: 24 }),
    repository.getMonthlyCashflow(24),
    repository.getMonthlyCashflowByCurrency(24),
    repository.getBalanceVerification(),
    repository.getTransactions({ needs_review: true }),
    repository.getReceivables(),
    repository.getDebts(),
  ]);
  const pendingReviewCount = allPendingTx.length;

  // Filtra recebiveis de teste (seed do SCP) — eles aparecem so em
  // /admin/receivables e /admin/investments (com badge), nunca poluem
  // as projecoes contabeis da Visao Geral.
  const receivables = allReceivables.filter((r) => !isTestReceivable(r));

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

  // Dividas IMEDIATAS (atrasadas + curto prazo) — alinhado com /admin/debts.
  // Usa a mesma logica de occurrences pra deixar os numeros consistentes
  // entre Visao Geral (Caixa Total) e Dividas (card "A pagar imediato").
  const allDebtOccurrences: DebtOccurrence[] = [];
  for (const d of debts) {
    allDebtOccurrences.push(...generateOccurrences(d, today));
  }
  const immediateOccurrences = allDebtOccurrences.filter((o) => {
    const b = bucketName(o.days_from_today);
    return b === "overdue" || b === "short";
  });
  const mediumDebtOccurrences = allDebtOccurrences.filter(
    (o) => bucketName(o.days_from_today) === "medium"
  );

  // Bucketizar recebiveis (pra projecao de entradas)
  const allReceivableEntries: ReceivableEntry[] = receivables
    .filter((r) => r.status !== "paid" && r.currency)
    .map((r) => {
      const remaining = r.amount_total - r.amount_received;
      const days = (new Date(r.due_date).getTime() - today.getTime()) / 86400000;
      return {
        receivable_id: r.id,
        description: r.description,
        counterparty: r.counterparty,
        entity_id: r.entity_id,
        amount: remaining,
        currency: r.currency,
        due_date: r.due_date,
        days_from_today: days,
      };
    })
    .filter((e) => e.amount > 0);

  // Curto prazo: atrasados + curto (<=35d). Medio: 36-150d.
  const shortReceivables = allReceivableEntries.filter((e) => {
    const b = bucketName(e.days_from_today);
    return b === "overdue" || b === "short";
  });
  const mediumReceivables = allReceivableEntries.filter(
    (e) => bucketName(e.days_from_today) === "medium"
  );

  // Agrupar por moeda pra montar BucketCurrencyData
  function groupByCurrency(rs: ReceivableEntry[], occs: DebtOccurrence[]) {
    const all = new Set<string>();
    rs.forEach((r) => all.add(r.currency));
    occs.forEach((o) => all.add(o.currency));
    return Array.from(all).map((cur) => {
      const recvs = rs.filter((r) => r.currency === cur);
      const ds = occs.filter((o) => o.currency === cur);
      const entradas = recvs.reduce((s, r) => s + r.amount, 0);
      const saidas = ds.reduce((s, o) => s + o.amount, 0);
      return {
        currency: cur,
        entradas,
        saidas,
        liquido: entradas - saidas,
        receivables: recvs,
        debtOccurrences: ds,
      };
    });
  }

  // Pra projecao de fluxo de caixa, considerar SOMENTE dividas nao-operacionais
  // (emprestimos, aportes de investidor, outros, sem categoria). Custos operacionais
  // (cost_*) sao pagos pela receita corrente — incluir na projecao seria enganoso
  // ja que o lado da receita futura (vendas) nao esta nos recebiveis.
  function isCapitalDebt(o: DebtOccurrence): boolean {
    if (!o.category) return true; // sem categoria = inclui (conservador)
    if (o.category.startsWith("cost_")) return false;
    return true; // emprestimo, aporte_investidor, outros, etc.
  }
  const immediateCapitalOccurrences = immediateOccurrences.filter(isCapitalDebt);
  const mediumCapitalOccurrences = mediumDebtOccurrences.filter(isCapitalDebt);

  const projectionShort = {
    label: "Curto prazo",
    sublabel: "atrasadas + ≤ 35 dias",
    byCurrency: groupByCurrency(shortReceivables, immediateCapitalOccurrences),
  };
  const projectionMedium = {
    label: "Medio prazo",
    sublabel: "36 a 150 dias",
    byCurrency: groupByCurrency(mediumReceivables, mediumCapitalOccurrences),
  };

  // Ultima atualizacao
  const lastSyncedAccount = accounts
    .filter((a) => a.last_synced_at)
    .sort((a, b) => (b.last_synced_at || "").localeCompare(a.last_synced_at || ""))[0];

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
        <PnlOverview pnl={pnl24m} cashflow={cashflow24m} cashflowByCurrency={cashflowByCurrency24m} />

        {/* Verificacao: Lucro acumulado bate com variacao real do saldo? */}
        <BalanceCheck rows={balanceCheck} />

        {/* Caixa Total por moeda — clicavel pra ver detalhamento */}
        <CaixaTotalCard
          balanceByCurrency={balanceByCurrency}
          receivables={receivables}
          debts={debts}
          immediateOccurrences={immediateOccurrences}
        />

        {/* Projecao de fluxo de caixa por prazo (curto + medio), por moeda */}
        <CashflowProjectionCard curto={projectionShort} medio={projectionMedium} />

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

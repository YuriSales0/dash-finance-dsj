import { repository } from "@/lib/data/repository";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { effectivePeriodRatePct } from "@/lib/finance/return";
import { Calendar, TrendingUp, Clock } from "lucide-react";
import { FinancingButton } from "@/components/investor/FinancingButton";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const receivables = await repository.getReceivables({ open_for_financing: true });
  const open = receivables.filter((r) => r.status !== "paid");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Oportunidades</h1>
        <p className="text-sm text-slate-500 mt-1">
          Recebiveis abertos para financiamento. Voce antecipa um valor e recebe principal + juros no prazo.
        </p>
      </div>

      {open.length === 0 ? (
        <div className="card card-body text-center py-12 text-slate-400">
          Nenhuma oportunidade aberta no momento.
        </div>
      ) : (
        <div className="space-y-4">
          {open.map((r) => {
            const available = r.amount_total - (r.financing_raised || 0);
            const pct = ((r.financing_raised || 0) / r.amount_total) * 100;
            const daysToReceive = Math.round(
              (new Date(r.due_date).getTime() - new Date().getTime()) / 86400000
            );
            const periodRate = effectivePeriodRatePct(
              r.financing_interest_rate_pct || 0,
              r.financing_redemption_days || 0
            );

            return (
              <div key={r.id} className="card">
                <div className="card-body">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      {/* Investidor nao ve description/counterparty (info sensivel
                          de cliente DSJ). Ve entity emissora + termos publicos. */}
                      <h3 className="font-semibold text-lg">
                        Operacao #{r.id} ({r.currency})
                      </h3>
                      <p className="text-sm text-slate-500">
                        Emitido por {entityNames[r.entity_id] || r.entity_id}
                      </p>
                    </div>
                    <span className="badge-info">Aberto</span>
                  </div>

                  {r.financing_terms ? (
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg mb-4">
                      {r.financing_terms}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic mb-4">
                      Sem detalhes publicados pela DSJ.
                    </p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <Stat icon={<TrendingUp size={14} />} label="Taxa de juros">
                      {r.financing_interest_rate_pct}% ao mes
                      <br />
                      <span className="text-[10px] text-slate-400">
                        {periodRate.toFixed(2)}% no periodo (compostos)
                      </span>
                    </Stat>
                    <Stat icon={<Clock size={14} />} label="Prazo">
                      {r.financing_redemption_days} dias
                    </Stat>
                    <Stat icon={<Calendar size={14} />} label="Vencimento">
                      {formatDate(r.due_date)} ({daysToReceive}d)
                    </Stat>
                    <Stat label="Minimo">
                      {formatCurrency(r.financing_min_amount || 0, r.currency)}
                    </Stat>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">
                        Captado: {formatCurrency(r.financing_raised || 0, r.currency)} / {formatCurrency(r.amount_total, r.currency)}
                      </span>
                      <span className="font-semibold">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-600" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Disponivel: {formatCurrency(available, r.currency)}
                    </p>
                  </div>

                  <FinancingButton
                    receivableId={r.id}
                    minAmount={r.financing_min_amount || 0}
                    maxAmount={Math.min(r.financing_max_amount || available, available)}
                    rate={r.financing_interest_rate_pct || 0}
                    days={r.financing_redemption_days || 0}
                    currency={r.currency}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
        {icon}
        {label}
      </div>
      <p className="font-semibold text-sm">{children}</p>
    </div>
  );
}

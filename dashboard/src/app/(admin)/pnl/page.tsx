import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PnlTable } from "@/components/dashboard/PnlTable";
import { CostBreakdown } from "@/components/dashboard/CostBreakdown";
import { repository } from "@/lib/data/repository";
import { entityNames, entityColors } from "@/lib/format";
import type { EntityId } from "@/types/database";

const ENTITIES: EntityId[] = ["consolidated", "dsj_network", "universal_mkt", "dsj_connect"];

export default async function PnlPage({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  const selectedEntity = (searchParams.entity || "consolidated") as EntityId;

  const pnl = await repository.getMonthlyPnl({
    entity_id: selectedEntity,
    months: 12,
  });

  const currentMonth = pnl[pnl.length - 1];
  const recent = pnl.slice(-6);

  return (
    <>
      <Header
        title="P&L Mensal"
        subtitle={entityNames[selectedEntity]}
      />
      <div className="p-6 space-y-6">
        {/* Seletor de empresa */}
        <div className="flex gap-2 flex-wrap">
          {ENTITIES.map((entityId) => {
            const isSelected = selectedEntity === entityId;
            return (
              <Link
                key={entityId}
                href={`/pnl?entity=${entityId}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: entityColors[entityId] }}
                />
                {entityNames[entityId]}
              </Link>
            );
          })}
        </div>

        {/* Composição de custos do mês atual */}
        {currentMonth && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Composicao de Custos (mes atual)</h3>
              </div>
              <div className="card-body">
                <CostBreakdown pnl={currentMonth} />
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Resumo do Mes Atual</h3>
              </div>
              <div className="card-body space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-600">Receita</span>
                  <span className="text-2xl font-bold text-green-600">
                    ${currentMonth.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-600">Custos Totais</span>
                  <span className="text-2xl font-bold text-red-600">
                    ${currentMonth.total_costs.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline border-t border-slate-200 pt-4">
                  <span className="text-slate-700 font-medium">Lucro Liquido</span>
                  <span className="text-3xl font-bold text-blue-600">
                    ${currentMonth.net_profit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-600">Margem</span>
                  <span className="text-xl font-semibold">
                    {currentMonth.margin_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabela P&L últimos 6 meses */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">P&L (ultimos 6 meses)</h3>
          </div>
          <div className="card-body">
            <PnlTable rows={recent} />
          </div>
        </div>
      </div>
    </>
  );
}

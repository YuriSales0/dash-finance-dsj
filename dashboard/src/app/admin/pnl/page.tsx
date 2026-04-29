import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PnlTable } from "@/components/dashboard/PnlTable";
import { CostBreakdown } from "@/components/dashboard/CostBreakdown";
import { repository } from "@/lib/data/repository";
import { entityColors } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PnlPage({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  // Pega empresas do banco dinamicamente
  const entitiesFromDb = await repository.getEntities();

  // Monta lista de seletores: Consolidado + todas as empresas
  const selectorEntities = [
    { id: "consolidated", name: "Consolidado" },
    ...entitiesFromDb
      .filter((e) => e.id !== "consolidated")
      .map((e) => ({ id: e.id, name: e.name })),
  ];

  const selectedEntityId = searchParams.entity || "consolidated";
  const selectedEntity =
    selectorEntities.find((e) => e.id === selectedEntityId) || selectorEntities[0];

  const pnl = await repository.getMonthlyPnl({
    entity_id: selectedEntity.id,
    months: 12,
  });

  const currentMonth = pnl[pnl.length - 1];
  const recent = pnl.slice(-6);

  return (
    <>
      <Header title="P&L Mensal" subtitle={selectedEntity.name} />
      <div className="p-6 space-y-6">
        {/* Seletor de empresa */}
        <div className="flex gap-2 flex-wrap">
          {selectorEntities.map((entity) => {
            const isSelected = selectedEntity.id === entity.id;
            const color = entityColors[entity.id] || "#64748b";
            return (
              <Link
                key={entity.id}
                href={`/admin/pnl?entity=${entity.id}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: color }}
                />
                {entity.name}
              </Link>
            );
          })}
        </div>

        {currentMonth ? (
          <>
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

            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">P&L (ultimos 6 meses)</h3>
              </div>
              <div className="card-body">
                <PnlTable rows={recent} />
              </div>
            </div>
          </>
        ) : (
          <div className="card card-body text-center py-12 text-slate-400">
            <p className="text-sm">Sem dados de P&L para {selectedEntity.name}.</p>
            <p className="text-xs mt-2">
              Importe transacoes em <Link href="/admin/import" className="text-brand-600 underline">/admin/import</Link>
              {" "}e gere o P&L automaticamente.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

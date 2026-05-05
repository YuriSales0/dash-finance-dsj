import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PnlOverview } from "@/components/dashboard/PnlOverview";
import { repository } from "@/lib/data/repository";
import { entityColors } from "@/lib/format";
import type { EntityId } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function PnlPage({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  const entitiesFromDb = await repository.getEntities();

  const selectorEntities = [
    { id: "consolidated" as EntityId, name: "Consolidado" },
    ...entitiesFromDb
      .filter((e) => e.id !== "consolidated")
      .map((e) => ({ id: e.id as EntityId, name: e.name })),
  ];

  const selectedEntityId = (searchParams.entity || "consolidated") as EntityId;
  const selectedEntity =
    selectorEntities.find((e) => e.id === selectedEntityId) || selectorEntities[0];

  const [pnl, cashflowByCurrency] = await Promise.all([
    repository.getMonthlyPnl({ entity_id: selectedEntity.id, months: 24 }),
    repository.getMonthlyCashflowByCurrency(24, selectedEntity.id),
  ]);

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

        {cashflowByCurrency.length === 0 && pnl.length === 0 ? (
          <div className="card card-body text-center py-12 text-slate-400">
            <p className="text-sm">Sem dados de P&L para {selectedEntity.name}.</p>
            <p className="text-xs mt-2">
              Importe transacoes em{" "}
              <Link href="/admin/import" className="text-brand-600 underline">
                /admin/import
              </Link>{" "}
              e gere o P&L automaticamente.
            </p>
          </div>
        ) : (
          <PnlOverview pnl={pnl} cashflowByCurrency={cashflowByCurrency} />
        )}
      </div>
    </>
  );
}

import { Header } from "@/components/layout/Header";

export default function OverviewPage() {
  return (
    <>
      <Header
        title="Visao Geral"
        subtitle="Saldos consolidados + metricas das 3 empresas"
      />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card card-body">
            <p className="text-sm text-slate-500">Saldo Total (USD)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">--</p>
            <p className="text-xs text-slate-400 mt-1">5 contas</p>
          </div>
          <div className="card card-body">
            <p className="text-sm text-slate-500">Receita do Mes</p>
            <p className="text-2xl font-bold text-green-600 mt-1">--</p>
            <p className="text-xs text-slate-400 mt-1">Consolidado</p>
          </div>
          <div className="card card-body">
            <p className="text-sm text-slate-500">Burn Rate</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">--</p>
            <p className="text-xs text-slate-400 mt-1">/mes</p>
          </div>
          <div className="card card-body">
            <p className="text-sm text-slate-500">Runway</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">--</p>
            <p className="text-xs text-slate-400 mt-1">meses</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="card card-body">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-entity-dsj_network" />
              <h3 className="font-semibold text-sm">DSJ Network LLC</h3>
            </div>
            <p className="text-lg font-bold">--</p>
            <p className="text-xs text-slate-400">Mercury + Revolut (USD)</p>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-entity-universal_mkt" />
              <h3 className="font-semibold text-sm">Universal MKT LLP</h3>
            </div>
            <p className="text-lg font-bold">--</p>
            <p className="text-xs text-slate-400">Airwallex + Revolut (GBP)</p>
          </div>
          <div className="card card-body">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full bg-entity-dsj_connect" />
              <h3 className="font-semibold text-sm">DSJ Connect LLC</h3>
            </div>
            <p className="text-lg font-bold">--</p>
            <p className="text-xs text-slate-400">Mercury (USD)</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Receita x Custos (12 meses)</h3>
          </div>
          <div className="card-body h-64 flex items-center justify-center text-slate-400">
            Grafico sera renderizado apos conexao com banco de dados
          </div>
        </div>
      </div>
    </>
  );
}

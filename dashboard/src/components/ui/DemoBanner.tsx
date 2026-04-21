import { Info } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2">
      <div className="flex items-center gap-2 text-amber-800 text-sm">
        <Info size={14} />
        <span>
          <strong>Modo Demo</strong> — Dados ficticios. Para conectar bancos
          reais, configurar Supabase + APIs e setar <code className="bg-amber-100 px-1 rounded">DEMO_MODE=false</code>.
        </span>
      </div>
    </div>
  );
}

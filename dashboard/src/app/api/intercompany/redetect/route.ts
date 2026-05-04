import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const maxDuration = 60;

// Re-detecta intercompany usando a funcao SQL (que respeita:
//   - Mercury/Airwallex exclusion (migration 024)
//   - Regra de ouro: exige nome da outra empresa na descricao (migration 025)
//   - Nao mexe em marcacoes humanas)
export async function POST(request: Request) {
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const body = await request.json().catch(() => ({}));
  const hoursWindow = Number(body.hours_window) || 720; // default 30 dias

  const sb = createServerClient();

  let pairsDetected = 0;
  try {
    const { data } = await sb.rpc("detect_intercompany", {
      p_hours_window: hoursWindow,
    });
    pairsDetected = (data as number) || 0;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // Regenerar P&L dos ultimos 12 meses se detectou algo
  const monthsRegenerated: string[] = [];
  if (pairsDetected > 0) {
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toISOString().slice(0, 10);
      try {
        await sb.rpc("generate_consolidated_pnl", { p_month: month });
        monthsRegenerated.push(month);
      } catch {}
    }
  }

  return NextResponse.json({
    ok: true,
    pairs_detected: pairsDetected,
    transactions_marked: pairsDetected * 2,
    months_regenerated: monthsRegenerated,
  });
}

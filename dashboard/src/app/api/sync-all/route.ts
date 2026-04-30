import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const maxDuration = 60;

// Sincroniza tudo: recalcula saldos + regenera P&L + detecta intercompany
// Chamado pelo botao "Sincronizar overview" na visao geral
export async function POST() {
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const sb = createServerClient();
  const log: string[] = [];

  // Saldos sao manuais — nao mais recalculados automaticamente
  log.push("Saldos: nao alterados (gestao manual)");

  // 2. Detectar intercompany
  try {
    const { data: ic } = await sb.rpc("detect_intercompany", {
      p_hours_window: 720,
    });
    log.push(`Intercompany detectados: ${ic || 0} pares`);
  } catch (e: any) {
    log.push(`Erro intercompany: ${e.message}`);
  }

  // 3. Regenerar P&L dos ultimos 12 meses
  try {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 10));
    }

    let regenerated = 0;
    for (const m of months) {
      try {
        await sb.rpc("generate_consolidated_pnl", { p_month: m });
        regenerated++;
      } catch {}
    }
    log.push(`P&L regenerado: ${regenerated}/12 meses`);
  } catch (e: any) {
    log.push(`Erro P&L: ${e.message}`);
  }

  return NextResponse.json({ ok: true, log });
}

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const maxDuration = 60;

// Gera P&L de um ou mais meses para todas as empresas + consolidado
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { months } = body as { months?: string[] };

    if (isDemoMode) {
      return NextResponse.json({
        ok: true,
        demo: true,
        message: "Modo demo: P&L nao e regenerado",
      });
    }

    const sb = createServerClient();

    // Lista de meses a gerar
    let targetMonths: string[];
    if (months && months.length > 0) {
      targetMonths = months;
    } else {
      // Por padrao: ultimos 12 meses
      targetMonths = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        targetMonths.push(d.toISOString().slice(0, 10));
      }
    }

    const results: { month: string; ok: boolean; error?: string }[] = [];

    for (const month of targetMonths) {
      try {
        const { error } = await sb.rpc("generate_consolidated_pnl", { p_month: month });
        if (error) throw error;
        results.push({ month, ok: true });
      } catch (err: any) {
        results.push({ month, ok: false, error: err.message });
      }
    }

    // Tambem detectar intercompany das transacoes recentes
    let intercompanyCount = 0;
    try {
      const { data, error } = await sb.rpc("detect_intercompany", { p_hours_window: 168 });
      if (!error && data) intercompanyCount = data as number;
    } catch {
      // nao critico
    }

    return NextResponse.json({
      ok: true,
      months_processed: results.length,
      results,
      intercompany_detected: intercompanyCount,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

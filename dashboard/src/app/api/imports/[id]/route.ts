import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

export const maxDuration = 60;

// Reverter um import: deletar transacoes, regenerar P&L
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (isDemoMode) {
      return NextResponse.json({ ok: true, demo: true });
    }

    const batchId = Number(params.id);
    if (!batchId) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    const sb = createServerClient();

    // Buscar batch
    const { data: batch, error: batchErr } = await sb
      .from("import_batches")
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchErr || !batch) {
      return NextResponse.json({ error: "Batch nao encontrado" }, { status: 404 });
    }

    if ((batch as any).reverted_at) {
      return NextResponse.json({ error: "Batch ja foi revertido" }, { status: 400 });
    }

    // Coletar meses afetados antes de deletar (pra regenerar P&L depois)
    const { data: txsToDelete } = await sb
      .from("transactions")
      .select("timestamp")
      .eq("import_batch_id", batchId);

    const monthsAffected = new Set<string>();
    for (const t of (txsToDelete as any[]) || []) {
      const d = new Date(t.timestamp);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      monthsAffected.add(monthStart.toISOString().slice(0, 10));
    }

    // Deletar transacoes do batch
    const { error: delErr, count } = await sb
      .from("transactions")
      .delete({ count: "exact" })
      .eq("import_batch_id", batchId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // Marcar batch como revertido
    let reverter = "admin";
    const session = await getSession();
    if (session) reverter = session.email || session.name || "admin";

    await sb
      .from("import_batches")
      .update({
        reverted_at: new Date().toISOString(),
        reverted_by: reverter,
      })
      .eq("id", batchId);

    // Regenerar P&L dos meses afetados
    const monthsArray = Array.from(monthsAffected);
    for (const month of monthsArray) {
      try {
        await sb.rpc("generate_consolidated_pnl", { p_month: month });
      } catch {
        // nao critico
      }
    }

    return NextResponse.json({
      ok: true,
      deleted: count,
      months_regenerated: monthsArray,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

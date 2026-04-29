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
      return NextResponse.json({ error: "Batch nao encontrado: " + (batchErr?.message || "") }, { status: 404 });
    }

    if ((batch as any).reverted_at) {
      return NextResponse.json({ error: "Batch ja foi revertido" }, { status: 400 });
    }

    // Buscar IDs das transacoes deste batch
    const { data: txsToDelete, error: fetchErr } = await sb
      .from("transactions")
      .select("id, timestamp")
      .eq("import_batch_id", batchId);

    if (fetchErr) {
      return NextResponse.json({ error: "Erro ao buscar transacoes: " + fetchErr.message }, { status: 500 });
    }

    const ids = ((txsToDelete as any[]) || []).map((t) => t.id);
    const monthsAffected = new Set<string>();
    for (const t of (txsToDelete as any[]) || []) {
      const d = new Date(t.timestamp);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      monthsAffected.add(monthStart.toISOString().slice(0, 10));
    }

    if (ids.length > 0) {
      // 1. Limpar linked_transaction_id de OUTRAS transacoes que apontam para essas
      // (essas precisam ser desvinculadas antes de deletar)
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const { error: unlinkErr } = await sb
          .from("transactions")
          .update({ linked_transaction_id: null })
          .in("linked_transaction_id", chunk);
        if (unlinkErr) {
          return NextResponse.json({
            error: "Erro ao desvincular intercompany: " + unlinkErr.message,
            stage: "unlink_external"
          }, { status: 500 });
        }
      }

      // 2. Limpar linked_transaction_id das proprias transacoes a deletar
      // (caso a FK tenha CASCADE seria automatico, mas garantimos)
      const { error: unlinkSelfErr } = await sb
        .from("transactions")
        .update({ linked_transaction_id: null })
        .in("id", ids);
      if (unlinkSelfErr) {
        return NextResponse.json({
          error: "Erro ao limpar links proprios: " + unlinkSelfErr.message,
          stage: "unlink_self"
        }, { status: 500 });
      }

      // 3. Deletar em chunks
      let totalDeleted = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const { error: delErr, count } = await sb
          .from("transactions")
          .delete({ count: "exact" })
          .in("id", chunk);
        if (delErr) {
          return NextResponse.json({
            error: "Erro ao deletar transacoes: " + delErr.message,
            stage: "delete",
            deleted_so_far: totalDeleted,
          }, { status: 500 });
        }
        totalDeleted += count || 0;
      }

      // 4. Marcar batch como revertido
      let reverter = "admin";
      const session = await getSession();
      if (session) reverter = session.email || session.name || "admin";

      const { error: updErr } = await sb
        .from("import_batches")
        .update({
          reverted_at: new Date().toISOString(),
          reverted_by: reverter,
        })
        .eq("id", batchId);

      if (updErr) {
        return NextResponse.json({
          error: "Transacoes deletadas mas erro ao marcar batch: " + updErr.message,
          deleted: totalDeleted,
        }, { status: 500 });
      }

      // 5. Regenerar P&L dos meses afetados
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
        deleted: totalDeleted,
        months_regenerated: monthsArray,
      });
    } else {
      // Sem transacoes pra deletar, so marcar como revertido
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

      return NextResponse.json({ ok: true, deleted: 0 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}

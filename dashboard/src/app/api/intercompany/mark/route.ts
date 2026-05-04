import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

// Marcar uma ou mais transacoes como intercompany manualmente
// body: { ids: [1, 2], pair?: true }  // se pair=true, linka as 2 entre si
export async function POST(request: Request) {
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const { ids, pair = false } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids obrigatorio" }, { status: 400 });
  }

  const sb = createServerClient();

  if (pair && ids.length === 2) {
    // Buscar as 2 para descobrir entity_id
    const { data: txs } = await sb
      .from("transactions")
      .select("id, entity_id")
      .in("id", ids);
    const list = (txs as any[]) || [];
    if (list.length !== 2) {
      return NextResponse.json({ error: "transacoes nao encontradas" }, { status: 404 });
    }
    const [t1, t2] = list;
    await sb.from("transactions").update({
      is_intercompany: true,
      category_id: "transfer_intercompany",
      classified_by: "human",
      classification_confidence: 100,
      linked_transaction_id: t2.id,
      counterpart_entity_id: t2.entity_id,
      needs_review: false,
    }).eq("id", t1.id);
    await sb.from("transactions").update({
      is_intercompany: true,
      category_id: "transfer_intercompany",
      classified_by: "human",
      classification_confidence: 100,
      linked_transaction_id: t1.id,
      counterpart_entity_id: t1.entity_id,
      needs_review: false,
    }).eq("id", t2.id);
  } else {
    await sb.from("transactions").update({
      is_intercompany: true,
      category_id: "transfer_intercompany",
      classified_by: "human",
      classification_confidence: 100,
      needs_review: false,
    }).in("id", ids);
  }

  // Regenerar P&L dos meses afetados
  await regenPnlForIds(sb, ids);

  return NextResponse.json({ ok: true, updated: ids.length });
}

// Desmarcar
export async function DELETE(request: Request) {
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids obrigatorio" }, { status: 400 });
  }

  const sb = createServerClient();
  await sb.from("transactions").update({
    is_intercompany: false,
    linked_transaction_id: null,
    counterpart_entity_id: null,
  }).in("id", ids);

  await regenPnlForIds(sb, ids);

  return NextResponse.json({ ok: true });
}

async function regenPnlForIds(sb: any, ids: number[]) {
  try {
    const { data } = await sb
      .from("transactions")
      .select("timestamp")
      .in("id", ids);
    const months = new Set<string>();
    for (const t of (data || []) as any[]) {
      const d = new Date(t.timestamp);
      months.add(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
    }
    for (const m of Array.from(months)) {
      await sb.rpc("generate_consolidated_pnl", { p_month: m });
    }
  } catch {
    // nao critico
  }
}

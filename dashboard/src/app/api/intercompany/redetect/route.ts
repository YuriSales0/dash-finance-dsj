import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const maxDuration = 60;

// Re-detecta intercompany com janela e tolerancia configuraveis
export async function POST(request: Request) {
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const body = await request.json().catch(() => ({}));
  const days = Number(body.days) || 30;
  const tolerance_pct = Number(body.tolerance_pct) || 5; // %

  const sb = createServerClient();

  // Buscar todas transacoes nao intercompany do periodo
  const since = new Date();
  since.setDate(since.getDate() - days * 2); // janela mais ampla
  const { data: txs } = await sb
    .from("transactions")
    .select("id, bank_account_id, entity_id, timestamp, amount_usd, is_intercompany, category_id")
    .gte("timestamp", since.toISOString())
    .eq("is_intercompany", false)
    .order("timestamp");

  const transactions = (txs as any[]) || [];

  // Encontrar pares: t1 negativo (saida) com t2 positivo (entrada) de outra empresa
  const negatives = transactions.filter((t) => Number(t.amount_usd) < 0);
  const positives = transactions.filter((t) => Number(t.amount_usd) > 0);

  const usedIds = new Set<number>();
  const pairs: { out: any; in: any }[] = [];
  const tolerance = tolerance_pct / 100;
  const windowMs = days * 24 * 60 * 60 * 1000;

  for (const out of negatives) {
    if (usedIds.has(out.id)) continue;
    const outAmount = Math.abs(Number(out.amount_usd));
    const outTime = new Date(out.timestamp).getTime();

    let bestMatch = null;
    let bestDiff = Infinity;

    for (const inn of positives) {
      if (usedIds.has(inn.id)) continue;
      if (inn.entity_id === out.entity_id) continue; // diferente empresa

      const inAmount = Number(inn.amount_usd);
      const diffPct = Math.abs(inAmount - outAmount) / outAmount;
      if (diffPct > tolerance) continue;

      const inTime = new Date(inn.timestamp).getTime();
      const timeDiff = Math.abs(outTime - inTime);
      if (timeDiff > windowMs) continue;

      if (diffPct < bestDiff) {
        bestDiff = diffPct;
        bestMatch = inn;
      }
    }

    if (bestMatch) {
      pairs.push({ out, in: bestMatch });
      usedIds.add(out.id);
      usedIds.add(bestMatch.id);
    }
  }

  // Marcar pares como intercompany
  for (const pair of pairs) {
    await sb.from("transactions").update({
      is_intercompany: true,
      category_id: "transfer_intercompany",
      classified_by: "rule",
      classification_confidence: 90,
      linked_transaction_id: pair.in.id,
      counterpart_entity_id: pair.in.entity_id,
      needs_review: false,
    }).eq("id", pair.out.id);

    await sb.from("transactions").update({
      is_intercompany: true,
      category_id: "transfer_intercompany",
      classified_by: "rule",
      classification_confidence: 90,
      linked_transaction_id: pair.out.id,
      counterpart_entity_id: pair.out.entity_id,
      needs_review: false,
    }).eq("id", pair.in.id);
  }

  // Regenerar P&L dos meses afetados
  const monthsAffected = new Set<string>();
  for (const pair of pairs) {
    [pair.out, pair.in].forEach((t) => {
      const d = new Date(t.timestamp);
      monthsAffected.add(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
    });
  }
  for (const month of Array.from(monthsAffected)) {
    try { await sb.rpc("generate_consolidated_pnl", { p_month: month }); } catch {}
  }

  return NextResponse.json({
    ok: true,
    pairs_detected: pairs.length,
    transactions_marked: pairs.length * 2,
    months_regenerated: Array.from(monthsAffected),
    sample_pairs: pairs.slice(0, 10).map((p) => ({
      out_id: p.out.id,
      out_entity: p.out.entity_id,
      out_amount_usd: p.out.amount_usd,
      in_id: p.in.id,
      in_entity: p.in.entity_id,
      in_amount_usd: p.in.amount_usd,
    })),
  });
}

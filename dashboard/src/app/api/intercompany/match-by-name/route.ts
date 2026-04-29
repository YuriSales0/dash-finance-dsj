import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const maxDuration = 60;

// Marca como intercompany todas transacoes onde counterparty/description
// contem nome de uma das empresas DSJ. Pareia automaticamente quando possivel.
export async function POST(request: Request) {
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const body = await request.json().catch(() => ({}));
  // Patterns padrao - empresas do grupo DSJ
  const defaultPatterns = [
    "DSJ NETWORK",
    "DSJ Network",
    "UNIVERSAL MKT",
    "Universal MKT",
    "Universal MKT LLP",
    "DSJ CONNECT",
    "DSJ Connect",
    "DSJ COMMERCE",
    "DSJ Commerce",
  ];
  const patterns: string[] = body.patterns || defaultPatterns;
  const dryRun: boolean = !!body.dry_run;

  const sb = createServerClient();

  // Buscar entidades pra mapear nome -> id
  const { data: entities } = await sb.from("entities").select("id, name").neq("id", "consolidated");
  const entityNameMap = new Map<string, string>(); // lowercased name -> id
  for (const e of (entities as any[]) || []) {
    entityNameMap.set(e.name.toLowerCase(), e.id);
    // Tambem alias curto: "DSJ Network LLC" -> tenta matchar "DSJ Network"
    const short = e.name.replace(/\s+(LLC|LLP|LTDA|INC|SA|S\.A\.)$/i, "").toLowerCase();
    if (short !== e.name.toLowerCase()) entityNameMap.set(short, e.id);
  }

  // Construir filter OR para procurar matches em counterparty ou description
  // Buscar todas transacoes nao intercompany ainda
  const { data: txs } = await sb
    .from("transactions")
    .select("id, entity_id, counterparty, description, amount_usd, timestamp")
    .eq("is_intercompany", false)
    .limit(10000);

  const transactions = (txs as any[]) || [];

  // Encontrar matches: counterparty ou description contem padrao
  const matches: { tx: any; matchedEntity: string }[] = [];
  for (const t of transactions) {
    const counterparty = (t.counterparty || "").toLowerCase();
    const description = (t.description || "").toLowerCase();

    let matchedEntityId: string | null = null;
    for (const [name, id] of Array.from(entityNameMap.entries())) {
      if (id === t.entity_id) continue; // mesma empresa, nao eh intercompany

      if (counterparty.includes(name) || description.includes(name)) {
        matchedEntityId = id;
        break;
      }
    }

    if (matchedEntityId) {
      matches.push({ tx: t, matchedEntity: matchedEntityId });
    }
  }

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      total_matches: matches.length,
      sample: matches.slice(0, 20).map((m) => ({
        id: m.tx.id,
        counterparty: m.tx.counterparty,
        amount_usd: m.tx.amount_usd,
        from_entity: m.tx.entity_id,
        to_entity: m.matchedEntity,
      })),
    });
  }

  // Tentar parear (mesma transacao com contraparte espelho)
  // Para cada match, procurar o par
  const ids = matches.map((m) => m.tx.id);
  const usedAsPair = new Set<number>();
  const pairs: { aId: number; bId: number; aEntity: string; bEntity: string }[] = [];

  for (const m of matches) {
    if (usedAsPair.has(m.tx.id)) continue;
    const target = matches.find(
      (x) =>
        x.tx.id !== m.tx.id &&
        !usedAsPair.has(x.tx.id) &&
        x.tx.entity_id === m.matchedEntity &&
        x.matchedEntity === m.tx.entity_id &&
        Math.abs(Math.abs(x.tx.amount_usd) - Math.abs(m.tx.amount_usd)) /
          Math.max(Math.abs(m.tx.amount_usd), 0.01) <= 0.05 &&
        Math.abs(
          new Date(x.tx.timestamp).getTime() - new Date(m.tx.timestamp).getTime()
        ) <=
          7 * 24 * 60 * 60 * 1000
    );

    if (target) {
      usedAsPair.add(m.tx.id);
      usedAsPair.add(target.tx.id);
      pairs.push({
        aId: m.tx.id,
        bId: target.tx.id,
        aEntity: m.tx.entity_id,
        bEntity: target.tx.entity_id,
      });
    }
  }

  // Marcar todas as matches como intercompany (mesmo as nao pareadas)
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      await sb
        .from("transactions")
        .update({
          is_intercompany: true,
          category_id: "transfer_intercompany",
          classified_by: "rule",
          classification_confidence: 95,
          needs_review: false,
        })
        .in("id", chunk);
    }
  }

  // Para os pares, vincular linked_transaction_id e counterpart_entity_id
  for (const p of pairs) {
    await sb
      .from("transactions")
      .update({
        linked_transaction_id: p.bId,
        counterpart_entity_id: p.bEntity,
      })
      .eq("id", p.aId);
    await sb
      .from("transactions")
      .update({
        linked_transaction_id: p.aId,
        counterpart_entity_id: p.aEntity,
      })
      .eq("id", p.bId);
  }

  // Para nao pareadas, definir counterpart_entity_id baseado no match
  for (const m of matches) {
    if (usedAsPair.has(m.tx.id)) continue;
    await sb
      .from("transactions")
      .update({ counterpart_entity_id: m.matchedEntity })
      .eq("id", m.tx.id);
  }

  // Regenerar P&L dos meses afetados
  const monthsAffected = new Set<string>();
  for (const m of matches) {
    const d = new Date(m.tx.timestamp);
    monthsAffected.add(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
  }

  const monthsRegenerated: string[] = [];
  for (const month of Array.from(monthsAffected)) {
    try {
      await sb.rpc("generate_consolidated_pnl", { p_month: month });
      monthsRegenerated.push(month);
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    total_matches: matches.length,
    pairs_linked: pairs.length,
    unpaired: matches.length - pairs.length * 2,
    months_regenerated: monthsRegenerated,
  });
}

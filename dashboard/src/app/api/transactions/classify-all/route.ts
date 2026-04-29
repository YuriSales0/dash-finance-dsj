import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { classify, getLastClaudeError } from "@/lib/import/classify";
import { getAnthropicKey } from "@/lib/anthropic/key";

export const maxDuration = 60;

// Classifica em lote todas transacoes uncategorized ou needs_review usando Claude AI.
// Pode ser chamado multiplas vezes ate processar tudo.
// Body: { limit?: number, only_uncategorized?: bool }
export async function POST(request: Request) {
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const apiKey = await getAnthropicKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Configure a chave Anthropic em /admin/settings?tab=ai primeiro" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 100, 200);
  const onlyUncategorized = body.only_uncategorized !== false; // default true

  const sb = createServerClient();

  // Buscar entidades pra mapear nomes (a classify usa)
  const { data: entities } = await sb.from("entities").select("id, name");
  const entityMap = new Map<string, string>();
  for (const e of (entities as any[]) || []) {
    entityMap.set(e.id, e.name);
  }

  // Buscar contas pra mapear nomes de banco
  const { data: accounts } = await sb.from("bank_accounts").select("id, bank_name");
  const bankMap = new Map<string, string>();
  for (const a of (accounts as any[]) || []) {
    bankMap.set(a.id, a.bank_name);
  }

  // Pegar transacoes a classificar
  let q = sb
    .from("transactions")
    .select("id, bank_account_id, entity_id, timestamp, description, counterparty, amount_original, currency_original, amount_usd, fx_rate, category_id, needs_review, is_intercompany");

  if (onlyUncategorized) {
    q = q.or("category_id.is.null,needs_review.eq.true");
  }
  q = q.eq("is_intercompany", false).limit(limit);

  const { data: txs, error: fetchErr } = await q;
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const transactions = (txs as any[]) || [];
  if (transactions.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, remaining: 0, message: "Nada pra classificar" });
  }

  let classified = 0;
  let stillReview = 0;
  let errors = 0;
  const monthsAffected = new Set<string>();

  // Processar paralelizado em chunks de 5 (evitar rate limit)
  const chunkSize = 5;
  for (let i = 0; i < transactions.length; i += chunkSize) {
    const chunk = transactions.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (tx) => {
        try {
          const entityName = entityMap.get(tx.entity_id) || tx.entity_id;
          const bankName = bankMap.get(tx.bank_account_id) || "Bank";
          const cls = await classify(
            {
              external_id: "", // nao usado
              bank_account_id: tx.bank_account_id,
              entity_id: tx.entity_id,
              timestamp: tx.timestamp,
              description: tx.description,
              counterparty: tx.counterparty,
              amount_original: tx.amount_original,
              currency_original: tx.currency_original,
              fx_rate: tx.fx_rate || 1,
              amount_usd: tx.amount_usd,
            },
            entityName,
            bankName
          );

          if (cls.category_id) {
            await sb
              .from("transactions")
              .update({
                category_id: cls.category_id,
                classified_by: cls.classified_by,
                classification_confidence: cls.confidence,
                needs_review: cls.needs_review,
              })
              .eq("id", tx.id);

            classified++;
            if (cls.needs_review) stillReview++;

            const d = new Date(tx.timestamp);
            monthsAffected.add(
              new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
            );
          }
        } catch (err) {
          errors++;
        }
      })
    );
  }

  // Regenerar P&L
  const monthsRegenerated: string[] = [];
  for (const month of Array.from(monthsAffected)) {
    try {
      await sb.rpc("generate_consolidated_pnl", { p_month: month });
      monthsRegenerated.push(month);
    } catch {}
  }

  // Contar restantes
  const { count: remaining } = await sb
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .or("category_id.is.null,needs_review.eq.true")
    .eq("is_intercompany", false);

  // Pegar ultimo erro do Claude (caso tenha falhado)
  const lastErr = getLastClaudeError();

  return NextResponse.json({
    ok: true,
    processed: transactions.length,
    classified,
    still_review: stillReview,
    errors,
    remaining: remaining || 0,
    months_regenerated: monthsRegenerated.length,
    last_claude_error: lastErr,
  });
}

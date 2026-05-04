import { NextResponse } from "next/server";
import { repository, isDemoMode } from "@/lib/data/repository";
import { createServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/supabase/session";

export async function POST(request: Request) {
  const body = await request.json();
  const { id, category_id, learn = true, apply_to_similar = true } = body;

  if (!id || !category_id) {
    return NextResponse.json({ error: "id e category_id obrigatorios" }, { status: 400 });
  }

  let reviewer = "admin";
  if (!isDemoMode) {
    const session = await getSession();
    if (session) reviewer = session.email || session.name || "admin";
  }

  await repository.updateTransactionCategory(id, category_id, reviewer);

  if (isDemoMode) {
    return NextResponse.json({ success: true, demo: true });
  }

  let learnedRuleId: number | null = null;
  let appliedToCount = 0;

  if (learn) {
    try {
      const sb = createServerClient();

      // Buscar a transacao corrigida para extrair contraparte
      const { data: tx } = await sb
        .from("transactions")
        .select("counterparty, description, entity_id")
        .eq("id", id)
        .single();

      if (tx) {
        const t = tx as any;
        const pattern = t.counterparty || t.description?.slice(0, 100);
        const patternType = t.counterparty ? "counterparty" : "description";

        if (pattern) {
          // Verificar se ja existe regra com mesmo padrao
          const { data: existing } = await sb
            .from("classification_rules")
            .select("id, category_id")
            .eq("pattern_type", patternType)
            .ilike("pattern_value", pattern)
            .limit(1);

          if (!existing || existing.length === 0) {
            // Criar nova regra aprendida
            const { data: newRule } = await sb
              .from("classification_rules")
              .insert({
                pattern_type: patternType,
                pattern_value: pattern,
                category_id,
                source: "learned",
                active: true,
                times_applied: 1,
              })
              .select("id")
              .single();

            if (newRule) learnedRuleId = (newRule as any).id;
          } else {
            // Regra ja existe mas com categoria diferente - atualiza
            const ex = existing[0] as any;
            if (ex.category_id !== category_id) {
              await sb
                .from("classification_rules")
                .update({
                  category_id,
                  times_overridden: 0,
                  times_applied: 1,
                })
                .eq("id", ex.id);
              learnedRuleId = ex.id;
            }
          }

          // Aplicar regra a transacoes similares pendentes de review
          if (apply_to_similar && pattern) {
            const filter = patternType === "counterparty"
              ? { col: "counterparty", value: pattern }
              : null;

            if (filter) {
              const { data: similar, count } = await sb
                .from("transactions")
                .update({
                  category_id,
                  classified_by: "rule",
                  classification_confidence: 95,
                  needs_review: false,
                  reviewed_by: reviewer,
                  reviewed_at: new Date().toISOString(),
                }, { count: "exact" })
                .eq("counterparty", pattern)
                .eq("needs_review", true)
                .neq("id", id)
                .select("id");

              appliedToCount = count || 0;
            }
          }
        }
      }
    } catch (err) {
      console.error("Learning error (non-critical):", err);
    }
  }

  // Regenerar P&L dos meses afetados pela reclassificacao
  try {
    const sb2 = createServerClient();
    const { data: txRow } = await sb2
      .from("transactions")
      .select("timestamp")
      .eq("id", id)
      .single();
    if (txRow) {
      const d = new Date((txRow as any).timestamp);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      await sb2.rpc("generate_consolidated_pnl", { p_month: monthStart });
    }
  } catch {
    // nao critico
  }

  return NextResponse.json({
    success: true,
    learned_rule_id: learnedRuleId,
    applied_to_similar: appliedToCount,
  });
}

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

export const maxDuration = 60;

// Classifica em lote transacoes de uma conta especifica
// body: {
//   bank_account_id: string,
//   inflow_category: string | null,    // categoria para amounts > 0
//   outflow_category: string | null,   // categoria para amounts < 0
//   only_uncategorized: bool,          // so afeta sem categoria + needs_review (default true)
//   exclude_intercompany: bool,        // default true
// }
export async function POST(request: Request) {
  try {
    if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

    const body = await request.json();
    const {
      bank_account_id,
      inflow_category,
      outflow_category,
      only_uncategorized = true,
      exclude_intercompany = true,
    } = body;

    if (!bank_account_id) {
      return NextResponse.json({ error: "bank_account_id obrigatorio" }, { status: 400 });
    }
    if (!inflow_category && !outflow_category) {
      return NextResponse.json({ error: "informe pelo menos uma categoria (inflow ou outflow)" }, { status: 400 });
    }

    const sb = createServerClient();
    let reviewer = "admin";
    const session = await getSession();
    if (session) reviewer = session.email || session.name || "admin";

    let appliedInflow = 0;
    let appliedOutflow = 0;
    const monthsAffected = new Set<string>();

    // Inflows (positivos)
    if (inflow_category) {
      let q = sb
        .from("transactions")
        .select("id, timestamp")
        .gt("amount_original", 0);

      if (bank_account_id !== "all") {
        q = q.eq("bank_account_id", bank_account_id);
      }
      if (only_uncategorized) {
        q = q.or("category_id.is.null,needs_review.eq.true");
      }
      if (exclude_intercompany) {
        q = q.eq("is_intercompany", false);
      }

      const { data: inflows } = await q;
      const ids = ((inflows as any[]) || []).map((r) => r.id);
      ((inflows as any[]) || []).forEach((r) => {
        const d = new Date(r.timestamp);
        monthsAffected.add(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
      });

      if (ids.length > 0) {
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          await sb.from("transactions").update({
            category_id: inflow_category,
            classified_by: "human",
            classification_confidence: 100,
            needs_review: false,
            reviewed_by: reviewer,
            reviewed_at: new Date().toISOString(),
          }).in("id", chunk);
        }
        appliedInflow = ids.length;
      }
    }

    // Outflows (negativos)
    if (outflow_category) {
      let q = sb
        .from("transactions")
        .select("id, timestamp")
        .lt("amount_original", 0);

      if (bank_account_id !== "all") {
        q = q.eq("bank_account_id", bank_account_id);
      }
      if (only_uncategorized) {
        q = q.or("category_id.is.null,needs_review.eq.true");
      }
      if (exclude_intercompany) {
        q = q.eq("is_intercompany", false);
      }

      const { data: outflows } = await q;
      const ids = ((outflows as any[]) || []).map((r) => r.id);
      ((outflows as any[]) || []).forEach((r) => {
        const d = new Date(r.timestamp);
        monthsAffected.add(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
      });

      if (ids.length > 0) {
        for (let i = 0; i < ids.length; i += 500) {
          const chunk = ids.slice(i, i + 500);
          await sb.from("transactions").update({
            category_id: outflow_category,
            classified_by: "human",
            classification_confidence: 100,
            needs_review: false,
            reviewed_by: reviewer,
            reviewed_at: new Date().toISOString(),
          }).in("id", chunk);
        }
        appliedOutflow = ids.length;
      }
    }

    // Regenerar P&L dos meses afetados
    const monthsRegenerated: string[] = [];
    for (const month of Array.from(monthsAffected)) {
      try {
        await sb.rpc("generate_consolidated_pnl", { p_month: month });
        monthsRegenerated.push(month);
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      applied_inflow: appliedInflow,
      applied_outflow: appliedOutflow,
      total_classified: appliedInflow + appliedOutflow,
      months_regenerated: monthsRegenerated,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

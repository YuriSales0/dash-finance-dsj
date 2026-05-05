import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";
import { isTestReceivable } from "@/lib/receivables/isTest";

// POST /api/admin/cleanup-test-data
// Remove TODOS os recebiveis de teste (criados pelo seed) + cascata:
//   1. Cancela e deleta financings vinculados
//   2. Deleta invite_codes apontando pra eles
//   3. Deleta os recebiveis
//
// Auth: apenas role=dsj.
export async function POST() {
  if (isDemoMode) {
    return NextResponse.json({ ok: true, demo: true, deleted: 0 });
  }

  const session = await getSession();
  if (!session || session.role !== "dsj") {
    return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
  }

  const sb = createServerClient();

  // Buscar todos os recebiveis e filtrar os de teste
  const { data: allRecvs, error: recvErr } = await sb
    .from("receivables")
    .select("id, description, notes");
  if (recvErr) {
    return NextResponse.json({ error: recvErr.message }, { status: 500 });
  }

  const testRecvs = (allRecvs || []).filter((r: any) => isTestReceivable(r));
  const testIds = testRecvs.map((r: any) => r.id);

  if (testIds.length === 0) {
    return NextResponse.json({
      ok: true,
      deleted_receivables: 0,
      deleted_financings: 0,
      deleted_invites: 0,
    });
  }

  let deletedFinancings = 0;
  let deletedInvites = 0;

  // 1. Deletar financings vinculados (cascata via receivable_id)
  try {
    const { data: fins } = await sb
      .from("financings")
      .select("id")
      .in("receivable_id", testIds);
    if (fins && fins.length > 0) {
      const finIds = (fins as any[]).map((f) => f.id);
      // Deletar payment_schedule primeiro (FK)
      await sb.from("payment_schedule").delete().in("financing_id", finIds);
      // Deletar financings (trigger update_receivable_raised vai recalcular)
      const { error } = await sb.from("financings").delete().in("id", finIds);
      if (!error) deletedFinancings = finIds.length;
    }
  } catch {
    // best effort
  }

  // 2. Deletar invite_codes vinculados
  try {
    const { data: invs } = await sb
      .from("invite_codes")
      .select("code")
      .in("receivable_id", testIds);
    if (invs && invs.length > 0) {
      const codes = (invs as any[]).map((i) => i.code);
      const { error } = await sb.from("invite_codes").delete().in("code", codes);
      if (!error) deletedInvites = codes.length;
    }
  } catch {
    // best effort
  }

  // 3. Deletar receivables de teste
  const { error: delErr } = await sb.from("receivables").delete().in("id", testIds);
  if (delErr) {
    return NextResponse.json(
      {
        error: delErr.message,
        deleted_financings: deletedFinancings,
        deleted_invites: deletedInvites,
      },
      { status: 500 }
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/receivables");
  revalidatePath("/admin/investments");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/debts");
  revalidatePath("/admin/pnl");
  revalidatePath("/investor");
  revalidatePath("/investor/opportunities");
  revalidatePath("/investor/portfolio");
  revalidatePath("/invest/[code]", "layout");

  return NextResponse.json({
    ok: true,
    deleted_receivables: testIds.length,
    deleted_financings: deletedFinancings,
    deleted_invites: deletedInvites,
  });
}

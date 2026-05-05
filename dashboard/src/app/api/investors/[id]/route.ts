import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

// PATCH /api/investors/[id] — approve|reject investor pendente.
// Apenas admin (role=dsj) pode chamar.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    const body = await request.json();
    const action = body?.action as string | undefined;
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "action deve ser 'approve' ou 'reject'" },
        { status: 400 }
      );
    }

    if (isDemoMode) {
      return NextResponse.json({ ok: true, demo: true });
    }

    const session = await getSession();
    if (!session || session.role !== "dsj") {
      return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
    }

    const sb = createServerClient();
    const newStatus = action === "approve" ? "approved" : "rejected";
    const updates: any = {
      status: newStatus,
    };
    if (action === "approve") {
      updates.approved_by = session.email || session.name || "admin";
      updates.approved_at = new Date().toISOString();
    } else {
      updates.rejected_by = session.email || session.name || "admin";
      updates.rejected_at = new Date().toISOString();
      if (body.reason) updates.rejection_reason = body.reason;
    }

    const { error } = await sb.from("investors").update(updates).eq("id", id);
    if (error) {
      // Alguns campos podem nao existir no schema (rejected_by/at/reason). Retry sem eles.
      if (action === "reject") {
        const { error: e2 } = await sb
          .from("investors")
          .update({ status: newStatus })
          .eq("id", id);
        if (e2) throw e2;
      } else {
        throw error;
      }
    }

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

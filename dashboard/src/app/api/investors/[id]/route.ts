import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

// PATCH /api/investors/[id] — duas modalidades:
//   1) action: "approve" | "reject" → muda status (KYC manual)
//   2) sem action, com campos diretos → edita dados do investidor
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

    if (isDemoMode) {
      return NextResponse.json({ ok: true, demo: true });
    }

    const session = await getSession();
    if (!session || session.role !== "dsj") {
      return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
    }

    const sb = createServerClient();

    // Modo 1: approve/reject
    if (action === "approve" || action === "reject") {
      const newStatus = action === "approve" ? "approved" : "rejected";
      const updates: any = { status: newStatus };
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
      revalidatePath("/admin/investments");
      return NextResponse.json({ ok: true, status: newStatus });
    }

    // Modo 2: edicao de dados. Whitelist de campos editaveis.
    // CPF e email sao read-only (CPF e legal ID; email tied to auth).
    // status pode ser atualizado pra suspender/reativar.
    const updates: any = {};
    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.phone === "string") updates.phone = body.phone || null;
    if (typeof body.bank_name === "string") updates.bank_name = body.bank_name || null;
    if (typeof body.bank_agency === "string") updates.bank_agency = body.bank_agency || null;
    if (typeof body.bank_account === "string") updates.bank_account = body.bank_account || null;
    if (typeof body.pix_key === "string") updates.pix_key = body.pix_key || null;
    if (
      body.status &&
      ["pending", "approved", "rejected", "suspended"].includes(body.status)
    ) {
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo valido pra atualizar" },
        { status: 400 }
      );
    }

    const { error } = await sb.from("investors").update(updates).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/investments");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

// DELETE /api/investors/[id] — exclui investidor.
// Bloqueia se houver financings ativos/pendentes (analogo a /api/receivables).
// Tambem deleta o user_role e tenta deletar o auth user.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    if (isDemoMode) {
      return NextResponse.json({ ok: true, demo: true });
    }

    const session = await getSession();
    if (!session || session.role !== "dsj") {
      return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
    }

    const sb = createServerClient();

    // Buscar investor pra checar financings ativos + obter auth_user_id
    const { data: investor, error: invErr } = await sb
      .from("investors")
      .select("id, auth_user_id")
      .eq("id", id)
      .single();
    if (invErr || !investor) {
      return NextResponse.json({ error: "Investidor nao encontrado" }, { status: 404 });
    }

    // Bloquear se houver financings ativos/pendentes
    try {
      const { data: actives, count } = await sb
        .from("financings")
        .select("id", { count: "exact", head: true })
        .eq("investor_id", id)
        .in("status", ["active", "pending"]);
      const n = (actives && (actives as any).length) || count || 0;
      if (n > 0) {
        return NextResponse.json(
          {
            error: `Investidor tem ${n} financiamento(s) ativo(s). Resgate ou cancele antes de excluir.`,
          },
          { status: 409 }
        );
      }
    } catch {
      // best effort
    }

    // Liberar invite_code (volta a active=true, used_by=null) — caso queira
    // reutilizar o convite. So opcional, ignora erro.
    try {
      await sb
        .from("invite_codes")
        .update({ used_by: null, used_at: null, active: true })
        .eq("used_by", id);
    } catch {
      // best effort
    }

    // Deletar registro investors
    const { error: delErr } = await sb.from("investors").delete().eq("id", id);
    if (delErr) throw delErr;

    // Deletar user_roles + auth user (best effort — se falhar, o admin
    // pode limpar manualmente; investor record ja foi removido).
    const authUserId = (investor as any).auth_user_id;
    if (authUserId) {
      try {
        await sb.from("user_roles").delete().eq("user_id", authUserId);
      } catch {}
      try {
        await sb.auth.admin.deleteUser(authUserId);
      } catch {}
    }

    revalidatePath("/admin/investments");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

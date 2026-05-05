import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

// GET /api/investor/me — retorna dados do investidor logado pra preencher
// contrato (nome, CPF, email, telefone, banco, status).
export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({
      id: 1,
      name: "Investidor Demo",
      cpf: "000.000.000-00",
      email: "demo@example.com",
      phone: "+55 11 99999-9999",
      bank_name: null,
      bank_agency: null,
      bank_account: null,
      pix_key: null,
      status: "approved",
      demo: true,
    });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (session.role !== "investor") {
    return NextResponse.json({ error: "Apenas investidores" }, { status: 403 });
  }

  const sb = createServerClient();
  const { data, error } = await sb
    .from("investors")
    .select(
      "id, name, cpf, email, phone, bank_name, bank_agency, bank_account, pix_key, status, total_invested, total_returned"
    )
    .eq("auth_user_id", session.user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Investidor nao encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH /api/investor/me — investidor atualiza dados bancarios antes de
// assinar o contrato. Campos sensiveis (status, cpf, email, name) nao sao
// editaveis — admin precisa intervir.
export async function PATCH(request: Request) {
  if (isDemoMode) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (session.role !== "investor") {
    return NextResponse.json({ error: "Apenas investidores" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  // Whitelist de campos editaveis pelo proprio investidor
  const updates: any = {};
  if (typeof body.phone === "string") updates.phone = body.phone || null;
  if (typeof body.bank_name === "string") updates.bank_name = body.bank_name || null;
  if (typeof body.bank_agency === "string") updates.bank_agency = body.bank_agency || null;
  if (typeof body.bank_account === "string") updates.bank_account = body.bank_account || null;
  if (typeof body.pix_key === "string") updates.pix_key = body.pix_key || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo valido pra atualizar" }, { status: 400 });
  }

  const sb = createServerClient();
  const { error } = await sb
    .from("investors")
    .update(updates)
    .eq("auth_user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/investor");
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, cpf, phone, password, bank_name, bank_agency, bank_account, pix_key, invite_code } = body;

    if (!name || !email || !cpf || !password || !invite_code) {
      return NextResponse.json({ error: "Campos obrigatorios: nome, email, CPF, senha, codigo" }, { status: 400 });
    }

    if (isDemoMode) {
      return NextResponse.json({ id: 999, name, email, status: "approved", demo: true });
    }

    const sb = createServerClient();

    // Verificar convite
    const { data: invite, error: invErr } = await sb
      .from("invite_codes")
      .select("*")
      .eq("code", invite_code)
      .eq("active", true)
      .is("used_by", null)
      .single();

    if (invErr || !invite) {
      return NextResponse.json({ error: "Codigo de convite invalido ou ja utilizado" }, { status: 400 });
    }

    // Criar usuario no Supabase Auth
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (authErr) {
      if (authErr.message.includes("already")) {
        return NextResponse.json({ error: "Email ja cadastrado. Faca login." }, { status: 400 });
      }
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    const userId = authData.user.id;

    // Criar role
    await sb.from("user_roles").insert({
      user_id: userId,
      role: "investor",
      name,
      email,
    });

    // Criar registro em investors
    const { data: investor, error: invInsErr } = await sb
      .from("investors")
      .insert({
        name,
        cpf,
        email,
        phone: phone || null,
        bank_name: bank_name || null,
        bank_agency: bank_agency || null,
        bank_account: bank_account || null,
        pix_key: pix_key || null,
        invite_code,
        auth_user_id: userId,
        status: "approved",
        approved_by: "auto",
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invInsErr) {
      return NextResponse.json({ error: invInsErr.message }, { status: 500 });
    }

    // Marcar convite como usado
    await sb.from("invite_codes").update({
      used_by: (investor as any).id,
      used_at: new Date().toISOString(),
      active: false,
    }).eq("code", invite_code);

    return NextResponse.json(investor);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

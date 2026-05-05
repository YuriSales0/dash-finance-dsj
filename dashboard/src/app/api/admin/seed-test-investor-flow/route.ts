import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

// POST /api/admin/seed-test-investor-flow
// Cria um recebivel de teste + convite + retorna URLs pra fazer o fluxo
// completo end-to-end (registro → contrato → assinatura → verificar hash).
//
// Auth: apenas role=dsj.

function genCode(prefix: string, len: number = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = prefix;
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export async function POST(request: Request) {
  if (isDemoMode) {
    return NextResponse.json({
      receivable_id: 999,
      invite_code: "TEST_DEMO",
      invite_url: "/invest/TEST_DEMO",
      demo: true,
    });
  }

  const session = await getSession();
  if (!session || session.role !== "dsj") {
    return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
  }

  const sb = createServerClient();

  // Buscar entity_id da DSJ Network LLC (ou primeira USD encontrada) pra usar
  // como emissora do recebivel teste.
  let entityId: string = "dsj_network_llc";
  try {
    const { data: ents } = await sb
      .from("entities")
      .select("id, currency_default")
      .eq("currency_default", "USD")
      .limit(1);
    if (ents && ents.length > 0) {
      entityId = (ents[0] as any).id;
    }
  } catch {
    // fallback ja setado
  }

  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 90);

  // Criar recebivel de teste
  const { data: recv, error: rErr } = await sb
    .from("receivables")
    .insert({
      entity_id: entityId,
      description: "TEST — Recebivel de teste para fluxo de investimento",
      counterparty: "Cliente Teste (admin only)",
      amount_total: 10000,
      amount_received: 0,
      currency: "USD",
      issue_date: today.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      status: "pending",
      open_for_financing: true,
      financing_interest_rate_pct: 1.5,
      financing_redemption_days: 60,
      financing_min_amount: 100,
      financing_max_amount: 5000,
      financing_terms:
        "Operacao de teste para validar o fluxo SCP. Capital aberto pra antecipacao por investidores aprovados.",
      financing_raised: 0,
      notes: "Recebivel criado pelo seed de teste.",
    })
    .select()
    .single();
  if (rErr || !recv) {
    return NextResponse.json(
      { error: rErr?.message || "Erro ao criar recebivel" },
      { status: 500 }
    );
  }

  // Criar convite vinculado
  let code = genCode("TEST");
  // tentar 3 vezes em caso de colisao
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error: cErr } = await sb.from("invite_codes").insert({
      code,
      receivable_id: (recv as any).id,
      investor_name: "Investidor Teste",
      message:
        "Convite de teste — DSJ Finance. Use pra validar o fluxo de registro, contrato e assinatura.",
      created_by: session.email || session.name || "admin",
      active: true,
    });
    if (!cErr) break;
    if (attempt === 2) {
      return NextResponse.json(
        { error: cErr.message || "Erro ao criar convite" },
        { status: 500 }
      );
    }
    code = genCode("TEST");
  }

  revalidatePath("/admin/investments");
  revalidatePath("/admin/receivables");

  return NextResponse.json({
    receivable_id: (recv as any).id,
    invite_code: code,
    invite_url: `/invest/${code}`,
    register_url: `/invest/${code}/register`,
    contract_url: `/invest/${code}/contract`,
    next_steps: [
      "1) Abra invite_url numa janela privada (pra simular novo investidor sem cookies)",
      "2) Clique 'Quero investir' → preencha o registro (nome, CPF, email, senha, banco/PIX)",
      "3) Apos registrar, voce volta pra landing com 'Aguardando aprovacao' (status=pending)",
      "4) Volte aqui em /admin/investments aba 'Investidores e oportunidades' e aprove o investidor pendente",
      "5) Logado como investidor, retorne a invite_url — vai aparecer 'Cadastro aprovado' com botao 'Assinar contrato'",
      "6) Assine: confira dados, marque declaracao e clique 'Assinar contrato'",
      "7) Em /investor/portfolio, clique 'Verificar autenticidade do contrato' pra conferir o hash SHA-256",
    ],
  });
}

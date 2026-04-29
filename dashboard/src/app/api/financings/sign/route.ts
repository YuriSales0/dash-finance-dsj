import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode, repository } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      invite_code,
      receivable_id,
      amount_invested,
      interest_rate_pct,
      redemption_days,
      expected_return,
    } = body;

    if (!amount_invested || amount_invested <= 0) {
      return NextResponse.json({ error: "Valor invalido" }, { status: 400 });
    }

    if (isDemoMode) {
      return NextResponse.json({
        id: 999,
        status: "active",
        amount_invested,
        expected_return,
        demo: true,
      });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    }

    const sb = createServerClient();

    // Buscar investor_id
    const { data: investor } = await sb
      .from("investors")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .single();

    if (!investor) {
      return NextResponse.json({ error: "Investidor nao encontrado" }, { status: 404 });
    }

    const now = new Date();
    const redemptionDate = new Date(now);
    redemptionDate.setDate(redemptionDate.getDate() + redemption_days);

    // Gerar hash do contrato
    const contractText = JSON.stringify({
      investor_id: (investor as any).id,
      receivable_id,
      amount_invested,
      interest_rate_pct,
      redemption_days,
      expected_return,
      signed_at: now.toISOString(),
    });
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(contractText));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contractHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Criar financiamento
    const { data: financing, error: finErr } = await sb
      .from("financings")
      .insert({
        receivable_id,
        investor_id: (investor as any).id,
        amount_invested,
        interest_rate_pct,
        redemption_days,
        expected_return,
        status: "active",
        contract_hash: contractHash,
        contract_text: contractText,
        contract_signed_at: now.toISOString(),
        contract_accepted_at: now.toISOString(),
        contract_ip: request.headers.get("x-forwarded-for") || "unknown",
        confirmed_at: now.toISOString(),
        redemption_date: redemptionDate.toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (finErr) throw finErr;

    // Criar cronograma de pagamento (parcela unica)
    await sb.from("payment_schedule").insert({
      financing_id: (financing as any).id,
      installment_number: 1,
      due_date: redemptionDate.toISOString().slice(0, 10),
      amount_principal: amount_invested,
      amount_interest: expected_return - amount_invested,
      amount_total: expected_return,
      status: "scheduled",
    });

    // Atualizar totais do investidor
    try {
      await sb
        .from("investors")
        .update({
          total_invested: (investor as any).total_invested + amount_invested,
        })
        .eq("id", (investor as any).id);
    } catch {
      // nao critico
    }

    return NextResponse.json(financing);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

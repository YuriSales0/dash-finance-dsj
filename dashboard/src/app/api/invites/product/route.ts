import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode, repository } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (isDemoMode) {
    const recvs = await repository.getReceivables({ open_for_financing: true });
    const r = recvs.find((x) => x.status !== "paid");
    if (!r) return NextResponse.json({});
    return NextResponse.json({
      receivable_id: r.id,
      description: r.description,
      currency: r.currency,
      interest_rate: r.financing_interest_rate_pct,
      redemption_days: r.financing_redemption_days,
      min_amount: r.financing_min_amount,
      max_amount: r.financing_max_amount,
    });
  }

  if (!code) {
    return NextResponse.json({ error: "code obrigatorio" }, { status: 400 });
  }

  // H8: bloquear acesso ao contract page sem investidor APROVADO logado.
  // Antes, qualquer um com URL podia ver os termos do recebivel.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  if (session.role !== "investor") {
    return NextResponse.json({ error: "Apenas investidores" }, { status: 403 });
  }

  const sb = createServerClient();

  // Validar status do investidor
  const { data: investor } = await sb
    .from("investors")
    .select("status")
    .eq("auth_user_id", session.user.id)
    .single();
  if (!investor) {
    return NextResponse.json({ error: "Investidor nao encontrado" }, { status: 404 });
  }
  if ((investor as any).status !== "approved") {
    return NextResponse.json(
      { error: "Investidor pendente de aprovacao" },
      { status: 403 }
    );
  }

  const { data: invite } = await sb
    .from("invite_codes")
    .select("receivable_id")
    .eq("code", code)
    .single();

  if (!invite?.receivable_id) {
    return NextResponse.json({ error: "Convite invalido" }, { status: 404 });
  }

  const { data: recv } = await sb
    .from("receivables")
    .select("*")
    .eq("id", invite.receivable_id)
    .single();

  if (!recv) {
    return NextResponse.json({ error: "Recebivel nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    receivable_id: (recv as any).id,
    // description e counterparty NAO retornados — investidor nao precisa ver
    // dados sensiveis (cliente DSJ) na pagina de contrato.
    currency: (recv as any).currency,
    interest_rate: (recv as any).financing_interest_rate_pct,
    redemption_days: (recv as any).financing_redemption_days,
    min_amount: (recv as any).financing_min_amount,
    max_amount: (recv as any).financing_max_amount,
    financing_terms: (recv as any).financing_terms,
  });
}

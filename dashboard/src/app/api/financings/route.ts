import { NextResponse } from "next/server";
import { repository, isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let investor_id: number = body.investor_id;

    if (!isDemoMode) {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
      if (session.role !== "investor") return NextResponse.json({ error: "Apenas investidores" }, { status: 403 });

      const sb = createServerClient();
      const { data: investor } = await sb
        .from("investors")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .single();
      if (!investor) return NextResponse.json({ error: "Investidor nao encontrado" }, { status: 404 });
      investor_id = (investor as { id: number }).id;
    } else {
      investor_id = investor_id || 1;
    }

    const created = await repository.createFinancing({
      receivable_id: body.receivable_id,
      investor_id,
      amount_invested: body.amount_invested,
      interest_rate_pct: body.interest_rate_pct,
      redemption_days: body.redemption_days,
      expected_return: body.expected_return,
    });

    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

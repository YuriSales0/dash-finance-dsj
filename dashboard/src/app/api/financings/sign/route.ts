import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { receivable_id, amount_invested } = body;

    if (!receivable_id) {
      return NextResponse.json({ error: "receivable_id obrigatorio" }, { status: 400 });
    }
    const amount = Number(amount_invested);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor invalido" }, { status: 400 });
    }

    if (isDemoMode) {
      return NextResponse.json({
        id: 999,
        status: "active",
        amount_invested: amount,
        demo: true,
      });
    }

    const session = await getSession();
    if (!session || session.role !== "investor") {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    }

    const sb = createServerClient();

    // Buscar investor logado
    const { data: investor, error: invErr } = await sb
      .from("investors")
      .select("id, total_invested, status")
      .eq("auth_user_id", session.user.id)
      .single();
    if (invErr || !investor) {
      return NextResponse.json({ error: "Investidor nao encontrado" }, { status: 404 });
    }
    if ((investor as any).status !== "approved") {
      return NextResponse.json(
        { error: "Investidor pendente de aprovacao" },
        { status: 403 }
      );
    }

    // C2: validar receivable existe, esta aberto, e amount cabe nos limites
    const { data: receivable, error: rErr } = await sb
      .from("receivables")
      .select(
        "id, amount_total, financing_raised, financing_min_amount, financing_max_amount, " +
          "financing_interest_rate_pct, financing_redemption_days, financing_terms, " +
          "open_for_financing, status, due_date"
      )
      .eq("id", receivable_id)
      .single();
    if (rErr || !receivable) {
      return NextResponse.json({ error: "Recebivel nao encontrado" }, { status: 404 });
    }
    const r = receivable as any;
    if (!r.open_for_financing) {
      return NextResponse.json(
        { error: "Recebivel nao esta aberto pra financiamento" },
        { status: 400 }
      );
    }
    if (r.status === "paid" || r.status === "defaulted") {
      return NextResponse.json(
        { error: `Recebivel com status ${r.status}` },
        { status: 400 }
      );
    }
    const amountTotal = Number(r.amount_total || 0);
    const raised = Number(r.financing_raised || 0);
    const available = amountTotal - raised;
    const minAmount = Number(r.financing_min_amount || 0);
    const maxAmount = r.financing_max_amount != null ? Number(r.financing_max_amount) : null;

    if (amount < minAmount) {
      return NextResponse.json(
        { error: `Valor abaixo do minimo (${minAmount})` },
        { status: 400 }
      );
    }
    if (maxAmount != null && amount > maxAmount) {
      return NextResponse.json(
        { error: `Valor acima do maximo (${maxAmount})` },
        { status: 400 }
      );
    }
    if (amount > available + 0.005) {
      return NextResponse.json(
        { error: `Valor excede disponivel (${available.toFixed(2)})` },
        { status: 400 }
      );
    }

    // C2: calcular expected_return server-side (NUNCA confiar no cliente)
    const interestRatePct = Number(r.financing_interest_rate_pct || 0);
    const redemptionDays = Number(r.financing_redemption_days || 0);
    const expectedReturn = Math.round(amount * (1 + interestRatePct / 100) * 100) / 100;

    const now = new Date();
    const redemptionDate = new Date(now);
    redemptionDate.setDate(redemptionDate.getDate() + redemptionDays);

    // Hash do contrato
    const contractText = JSON.stringify({
      investor_id: (investor as any).id,
      receivable_id,
      amount_invested: amount,
      interest_rate_pct: interestRatePct,
      redemption_days: redemptionDays,
      expected_return: expectedReturn,
      signed_at: now.toISOString(),
    });
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(contractText));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contractHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Criar financiamento (status='active' dispara o trigger update_receivable_raised)
    const { data: financing, error: finErr } = await sb
      .from("financings")
      .insert({
        receivable_id,
        investor_id: (investor as any).id,
        amount_invested: amount,
        interest_rate_pct: interestRatePct,
        redemption_days: redemptionDays,
        expected_return: expectedReturn,
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
    const financingId = (financing as any).id;

    // C3: sanity check pos-insert. O trigger update_receivable_raised
    // recalcula financing_raised somando todos os ativos. Se overshooting
    // (race condition: outro investidor inseriu em paralelo), DELETE este.
    const { data: rAfter } = await sb
      .from("receivables")
      .select("amount_total, financing_raised")
      .eq("id", receivable_id)
      .single();
    if (rAfter) {
      const newRaised = Number((rAfter as any).financing_raised || 0);
      const total = Number((rAfter as any).amount_total || 0);
      if (newRaised > total + 0.005) {
        // Reverter — outra captacao ocorreu em paralelo
        await sb.from("financings").delete().eq("id", financingId);
        return NextResponse.json(
          {
            error: "Captacao concorrente detectada. O recebivel ja foi totalmente captado. Tente outro.",
          },
          { status: 409 }
        );
      }
      // H10: ao bater 100%, fechar o recebivel pra novas captacoes
      // (saiu da lista de oportunidades; admin ainda ve em /admin/receivables).
      if (newRaised >= total - 0.005) {
        try {
          await sb
            .from("receivables")
            .update({ open_for_financing: false })
            .eq("id", receivable_id);
        } catch {
          // nao critico
        }
      }
    }

    // Criar cronograma de pagamento (parcela unica)
    await sb.from("payment_schedule").insert({
      financing_id: financingId,
      installment_number: 1,
      due_date: redemptionDate.toISOString().slice(0, 10),
      amount_principal: amount,
      amount_interest: expectedReturn - amount,
      amount_total: expectedReturn,
      status: "scheduled",
    });

    // Atualizar totais do investidor
    try {
      await sb
        .from("investors")
        .update({
          total_invested: Number((investor as any).total_invested || 0) + amount,
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

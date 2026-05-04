import { NextResponse } from "next/server";
import { repository, isDemoMode } from "@/lib/data/repository";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await repository.createDebt(body);

    // Aporte de investidor: creditar saldo + criar transaction (pra reconciliacao bater)
    if (body.category === "aporte_investidor" && !isDemoMode) {
      try {
        const sb = createServerClient();
        // Buscar primeira conta ativa da empresa na mesma moeda
        const { data: accounts } = await sb
          .from("bank_accounts")
          .select("id, balance_current")
          .eq("entity_id", body.entity_id)
          .eq("currency", body.currency || "BRL")
          .eq("active", true)
          .limit(1);

        if (accounts && accounts.length > 0) {
          const acc = accounts[0] as any;
          const amount = Number(body.amount_total || 0);
          const newBalance = Number(acc.balance_current || 0) + amount;

          // 1) Atualizar saldo
          await sb
            .from("bank_accounts")
            .update({
              balance_current: Math.round(newBalance * 100) / 100,
              balance_updated_at: new Date().toISOString(),
              balance_notes: `Aporte investidor: ${body.creditor || "N/A"} +${amount}`,
            })
            .eq("id", acc.id);

          // 2) Criar transaction representando a entrada de caixa
          // external_id unico: aporte:{debt_id} — permite dedup contra CSV futuro
          const debtId = (created as any)?.id;
          const externalId = debtId ? `aporte:${debtId}` : `aporte:${Date.now()}`;
          await sb.from("transactions").insert({
            external_id: externalId,
            bank_account_id: acc.id,
            entity_id: body.entity_id,
            timestamp: body.issue_date ? new Date(body.issue_date).toISOString() : new Date().toISOString(),
            description: `Aporte investidor: ${body.creditor || "N/A"}`,
            counterparty: body.creditor || null,
            amount_original: amount,
            currency_original: body.currency || "BRL",
            amount_usd: amount,
            fx_rate: 1,
            category_id: "investment_scp_in",
            classified_by: "rule",
            classification_confidence: 100,
            needs_review: false,
          });

          return NextResponse.json({
            ...created,
            balance_credited: true,
            account_id: acc.id,
            new_balance: Math.round(newBalance * 100) / 100,
            transaction_created: true,
          });
        }
      } catch (e: any) {
        console.error("Erro ao creditar saldo do aporte:", e.message);
      }
    }

    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
    await repository.updateDebt(id, data);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
    await repository.deleteDebt(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

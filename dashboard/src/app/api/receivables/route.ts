import { NextResponse } from "next/server";
import { repository, isDemoMode } from "@/lib/data/repository";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await repository.createReceivable(body);
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

    // Se amount_received aumentou, criar transaction representando o pagamento
    // (pra que P&L e reconciliacao reflitam)
    let creditedAmount = 0;
    let transactionCreated = false;
    if (!isDemoMode && typeof data.amount_received === "number") {
      try {
        const sb = createServerClient();
        const { data: existing } = await sb
          .from("receivables")
          .select("amount_received, entity_id, currency, description, counterparty")
          .eq("id", id)
          .single();

        const before = Number((existing as any)?.amount_received || 0);
        const after = Number(data.amount_received);
        creditedAmount = after - before;

        if (creditedAmount > 0) {
          // Buscar primeira conta ativa da empresa na mesma moeda
          const ent = (existing as any).entity_id;
          const cur = (existing as any).currency;
          const { data: accounts } = await sb
            .from("bank_accounts")
            .select("id, balance_current")
            .eq("entity_id", ent)
            .eq("currency", cur)
            .eq("active", true)
            .limit(1);

          if (accounts && accounts.length > 0) {
            const acc = accounts[0] as any;
            const newBalance = Number(acc.balance_current || 0) + creditedAmount;

            // Atualizar saldo
            await sb
              .from("bank_accounts")
              .update({
                balance_current: Math.round(newBalance * 100) / 100,
                balance_updated_at: new Date().toISOString(),
              })
              .eq("id", acc.id);

            // Criar transaction de receita
            // external_id unico: receivable:{id}:{timestamp} — evita dedup colisao
            const externalId = `receivable:${id}:${Date.now()}`;
            await sb.from("transactions").insert({
              external_id: externalId,
              bank_account_id: acc.id,
              entity_id: ent,
              timestamp: new Date().toISOString(),
              description: `Recebimento: ${(existing as any).description}`,
              counterparty: (existing as any).counterparty || null,
              amount_original: creditedAmount,
              currency_original: cur,
              amount_usd: creditedAmount,
              fx_rate: 1,
              category_id: "revenue_other",
              classified_by: "rule",
              classification_confidence: 100,
              needs_review: false,
            });
            transactionCreated = true;
          }
        }
      } catch (e: any) {
        console.error("Erro ao registrar recebimento:", e.message);
      }
    }

    await repository.updateReceivable(id, data);
    return NextResponse.json({ ok: true, transaction_created: transactionCreated, credited: creditedAmount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

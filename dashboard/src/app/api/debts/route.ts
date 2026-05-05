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

    // Aporte de investidor: se amount_total mudou, ajustar a transaction + saldo bancario
    // pra refletir a diferenca (delta = novo - antigo)
    let txAdjusted = false;
    let balanceDelta = 0;
    if (!isDemoMode && typeof data.amount_total === "number") {
      try {
        const sb = createServerClient();
        const externalId = `aporte:${id}`;
        const { data: tx } = await sb
          .from("transactions")
          .select("id, bank_account_id, amount_original")
          .eq("external_id", externalId)
          .maybeSingle();

        if (tx) {
          const t = tx as any;
          const oldAmount = Number(t.amount_original || 0);
          const newAmount = Number(data.amount_total);
          const delta = newAmount - oldAmount;

          if (Math.abs(delta) > 0.005) {
            // Ajustar saldo
            if (t.bank_account_id) {
              const { data: acc } = await sb
                .from("bank_accounts")
                .select("balance_current")
                .eq("id", t.bank_account_id)
                .single();
              if (acc) {
                const newBalance = Number((acc as any).balance_current || 0) + delta;
                await sb
                  .from("bank_accounts")
                  .update({
                    balance_current: Math.round(newBalance * 100) / 100,
                    balance_updated_at: new Date().toISOString(),
                    balance_notes: `Aporte ajustado: divida #${id} delta ${delta}`,
                  })
                  .eq("id", t.bank_account_id);
                balanceDelta = delta;
              }
            }

            // Atualizar transaction com novo valor
            await sb
              .from("transactions")
              .update({
                amount_original: newAmount,
                amount_usd: newAmount,
              })
              .eq("id", t.id);
            txAdjusted = true;
          }
        }
      } catch (e: any) {
        console.error("Erro ao ajustar aporte:", e.message);
      }
    }

    await repository.updateDebt(id, data);
    return NextResponse.json({ ok: true, tx_adjusted: txAdjusted, balance_delta: balanceDelta });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

    // Aporte de investidor: ao deletar, reverter a transaction de credito + ajustar saldo
    let reversedTx = false;
    let balanceAdjusted = false;
    if (!isDemoMode) {
      try {
        const sb = createServerClient();
        const externalId = `aporte:${id}`;

        // 1) Buscar a transaction criada na hora do POST
        const { data: tx } = await sb
          .from("transactions")
          .select("id, bank_account_id, amount_original")
          .eq("external_id", externalId)
          .maybeSingle();

        if (tx) {
          const t = tx as any;

          // 2) Reverter saldo (subtrair o valor que foi creditado)
          if (t.bank_account_id) {
            const { data: acc } = await sb
              .from("bank_accounts")
              .select("balance_current")
              .eq("id", t.bank_account_id)
              .single();
            if (acc) {
              const newBalance =
                Number((acc as any).balance_current || 0) - Number(t.amount_original || 0);
              await sb
                .from("bank_accounts")
                .update({
                  balance_current: Math.round(newBalance * 100) / 100,
                  balance_updated_at: new Date().toISOString(),
                  balance_notes: `Aporte revertido: divida #${id}`,
                })
                .eq("id", t.bank_account_id);
              balanceAdjusted = true;
            }
          }

          // 3) Deletar a transaction (precisa ser antes do deleteDebt se houver FK)
          await sb.from("transactions").delete().eq("id", t.id);
          reversedTx = true;
        }
      } catch (e: any) {
        console.error("Erro ao reverter aporte:", e.message);
      }
    }

    await repository.deleteDebt(id);
    return NextResponse.json({ ok: true, reversed_tx: reversedTx, balance_adjusted: balanceAdjusted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

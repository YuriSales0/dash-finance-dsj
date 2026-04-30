import { NextResponse } from "next/server";
import { listTransactions } from "@/lib/revolut/client";
import { createServerClient } from "@/lib/supabase/server";
import { classify } from "@/lib/import/classify";
import type { EntityId } from "@/types/database";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bank_account_id, days = 30 } = body;

    if (!bank_account_id) {
      return NextResponse.json({ error: "bank_account_id obrigatorio" }, { status: 400 });
    }

    const sb = createServerClient();

    // Buscar conta
    const { data: bankAccount, error: bankErr } = await sb
      .from("bank_accounts")
      .select("*")
      .eq("id", bank_account_id)
      .single();
    if (bankErr || !bankAccount) {
      return NextResponse.json({ error: "Conta nao encontrada" }, { status: 404 });
    }

    const account = bankAccount as any;

    // Buscar nome da empresa para classificacao
    const { data: entityRow } = await sb
      .from("entities")
      .select("name")
      .eq("id", account.entity_id)
      .single();
    const entityName = (entityRow as any)?.name || account.entity_id;

    // Pegar transacoes
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromStr = fromDate.toISOString().slice(0, 10);

    let revolutTxs;
    try {
      revolutTxs = await listTransactions(bank_account_id, { from: fromStr, count: 1000 });
    } catch (err: any) {
      // Salvar erro
      await sb.from("revolut_credentials")
        .update({ last_sync_error: err.message, last_sync_at: new Date().toISOString() })
        .eq("bank_account_id", bank_account_id);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    // Saldo permanece manual — apenas atualizar last_synced_at no fim

    // Normalizar
    const normalized = revolutTxs
      .filter((t) => t.state === "completed")
      .flatMap((t) =>
        t.legs.map((leg) => {
          const externalId = `revolut:${t.id}:${leg.leg_id}`;
          const description = leg.description || t.merchant?.name || t.type;
          const counterparty = t.merchant?.name || leg.counterparty?.account_id || null;

          return {
            external_id: externalId,
            bank_account_id,
            entity_id: account.entity_id as EntityId,
            timestamp: t.completed_at || t.created_at,
            description,
            counterparty,
            amount_original: leg.amount,
            currency_original: leg.currency,
            amount_usd: leg.amount, // sem conversao — mantemos no original
            fx_rate: 1,
          };
        })
      );

    // Dedup
    const externalIds = normalized.map((t) => t.external_id);
    const { data: existing } = await sb
      .from("transactions")
      .select("external_id")
      .in("external_id", externalIds);
    const existingSet = new Set((existing || []).map((e: any) => e.external_id));

    const newOnes = normalized.filter((t) => !existingSet.has(t.external_id));

    // Classificar e inserir em lotes
    let imported = 0;
    let needsReviewCount = 0;
    const batchSize = 20;

    for (let i = 0; i < newOnes.length; i += batchSize) {
      const batch = newOnes.slice(i, i + batchSize);

      const classified = await Promise.all(
        batch.map(async (tx) => {
          const cls = await classify(tx, entityName, "Revolut");
          if (cls.needs_review) needsReviewCount++;
          return {
            ...tx,
            category_id: cls.category_id,
            classified_by: cls.classified_by,
            classification_confidence: cls.confidence,
            needs_review: cls.needs_review,
          };
        })
      );

      const { error } = await sb.from("transactions").insert(classified);
      if (error) {
        await sb.from("revolut_credentials")
          .update({ last_sync_error: error.message, last_sync_at: new Date().toISOString() })
          .eq("bank_account_id", bank_account_id);
        return NextResponse.json({ error: error.message, imported }, { status: 500 });
      }
      imported += classified.length;
    }

    // Atualizar metadata de sync
    await sb.from("revolut_credentials")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_count: imported,
        last_sync_error: null,
      })
      .eq("bank_account_id", bank_account_id);

    // Atualizar last_synced_at da conta (saldo permanece manual)
    if (imported > 0 || normalized.length > 0) {
      await sb.from("bank_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", bank_account_id);
    }

    return NextResponse.json({
      ok: true,
      total_fetched: revolutTxs.length,
      legs_normalized: normalized.length,
      imported,
      duplicates_skipped: normalized.length - newOnes.length,
      needs_review: needsReviewCount,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

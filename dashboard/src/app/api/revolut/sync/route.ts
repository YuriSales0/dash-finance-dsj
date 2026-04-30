import { NextResponse } from "next/server";
import { listTransactions } from "@/lib/revolut/client";
import { createServerClient } from "@/lib/supabase/server";
import { classify } from "@/lib/import/classify";
import type { EntityId } from "@/types/database";

export const maxDuration = 300;

interface SyncBody {
  bank_account_id: string;
  // Modos:
  //  - days: ultimos N dias (default 30)
  //  - from_date: data inicial absoluta (YYYY-MM-DD)
  //  - all: true → tudo desde o inicio (sem from)
  days?: number;
  from_date?: string;
  all?: boolean;
}

export async function POST(request: Request) {
  try {
    const body: SyncBody = await request.json();
    const { bank_account_id, days = 30, from_date, all } = body;

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

    // Buscar credenciais para pegar revolut_account_id (filtro de legs)
    const { data: credsRow } = await sb
      .from("revolut_credentials")
      .select("revolut_account_id, active")
      .eq("bank_account_id", bank_account_id)
      .single();

    if (!credsRow || !(credsRow as any).active) {
      return NextResponse.json(
        { error: "Credenciais Revolut nao ativas. Autorize primeiro." },
        { status: 400 }
      );
    }

    const revolutAccountId: string | null = (credsRow as any).revolut_account_id;

    if (!revolutAccountId) {
      return NextResponse.json(
        {
          error:
            "Sub-conta Revolut nao selecionada. Use GET /api/revolut/accounts e POST /api/revolut/select-account.",
          code: "NO_ACCOUNT_SELECTED",
        },
        { status: 400 }
      );
    }

    // Buscar nome da empresa para classificacao
    const { data: entityRow } = await sb
      .from("entities")
      .select("name")
      .eq("id", account.entity_id)
      .single();
    const entityName = (entityRow as any)?.name || account.entity_id;

    // Pegar transacoes — modos: all > from_date > days
    let fromStr: string | undefined;
    if (all) {
      fromStr = undefined; // sem filtro = desde o inicio da conta
    } else if (from_date) {
      fromStr = from_date;
    } else {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      fromStr = fromDate.toISOString().slice(0, 10);
    }

    let revolutTxs;
    try {
      revolutTxs = await listTransactions(bank_account_id, { from: fromStr });
    } catch (err: any) {
      // Salvar erro
      await sb.from("revolut_credentials")
        .update({ last_sync_error: err.message, last_sync_at: new Date().toISOString() })
        .eq("bank_account_id", bank_account_id);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    // Saldo permanece manual — apenas atualizar last_synced_at no fim

    // Normalizar — apenas legs da sub-conta Revolut selecionada
    let legsForAccount = 0;
    const normalized = revolutTxs
      .filter((t) => t.state === "completed")
      .flatMap((t) =>
        t.legs
          .filter((leg) => leg.account_id === revolutAccountId)
          .map((leg) => {
            legsForAccount++;
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

    // Dedup (em chunks de 500 — limite IN do PostgREST)
    const externalIds = normalized.map((t) => t.external_id);
    const existingSet = new Set<string>();
    for (let i = 0; i < externalIds.length; i += 500) {
      const chunk = externalIds.slice(i, i + 500);
      const { data: existing } = await sb
        .from("transactions")
        .select("external_id")
        .in("external_id", chunk);
      ((existing as { external_id: string }[] | null) || []).forEach((e) =>
        existingSet.add(e.external_id)
      );
    }

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
        if (error.code === "23505") {
          // Race / dedup gap: tenta uma a uma
          for (const tx of classified) {
            const { error: singleErr } = await sb.from("transactions").insert(tx);
            if (!singleErr) imported++;
          }
        } else {
          await sb.from("revolut_credentials")
            .update({ last_sync_error: error.message, last_sync_at: new Date().toISOString() })
            .eq("bank_account_id", bank_account_id);
          return NextResponse.json({ error: error.message, imported }, { status: 500 });
        }
      } else {
        imported += classified.length;
      }
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

    // Bookkeeping automatico: regenerar P&L + detectar intercompany
    let pnlGenerated: string[] = [];
    let intercompanyDetected = 0;

    if (imported > 0) {
      const monthsAffected = new Set<string>();
      for (const tx of newOnes) {
        const d = new Date(tx.timestamp);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        monthsAffected.add(monthStart.toISOString().slice(0, 10));
      }

      try {
        const { data: ic } = await sb.rpc("detect_intercompany", { p_hours_window: 168 });
        intercompanyDetected = (ic as number) || 0;
      } catch {
        // nao critico
      }

      for (const month of Array.from(monthsAffected)) {
        try {
          await sb.rpc("generate_consolidated_pnl", { p_month: month });
          pnlGenerated.push(month);
        } catch {
          // nao critico
        }
      }
    }

    return NextResponse.json({
      ok: true,
      total_fetched: revolutTxs.length,
      legs_for_account: legsForAccount,
      legs_normalized: normalized.length,
      imported,
      duplicates_skipped: normalized.length - newOnes.length,
      needs_review: needsReviewCount,
      pnl_months_regenerated: pnlGenerated,
      intercompany_detected: intercompanyDetected,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

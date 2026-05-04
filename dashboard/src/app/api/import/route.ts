import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/import/csv";
import {
  detectFormat,
  normalizeRevolut,
  normalizeMercury,
  normalizeGeneric,
  type NormalizedTransaction,
} from "@/lib/import/normalize";
import { classify } from "@/lib/import/classify";
import { createServerClient } from "@/lib/supabase/server";
import { convertToUsd } from "@/lib/fx/rates";
import type { EntityId } from "@/types/database";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      csv_text,
      bank_account_id,
      entity_id,
      fx_rate,
      currency_override,
      format_override,
      preview_only,
      opening_balance,
    }: {
      csv_text: string;
      bank_account_id: string;
      entity_id: EntityId;
      fx_rate?: number;
      currency_override?: string;
      format_override?: "revolut" | "mercury" | "generic";
      preview_only?: boolean;
      opening_balance?: number;
    } = body;

    if (!csv_text || !bank_account_id || !entity_id) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 });
    }

    const { headers, rows } = parseCsv(csv_text);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV vazio ou invalido" }, { status: 400 });
    }

    const fmt = format_override || detectFormat(headers);
    if (fmt === "unknown") {
      return NextResponse.json(
        {
          error: "Formato de CSV nao detectado",
          detected_headers: headers,
        },
        { status: 400 }
      );
    }

    // Se fx_rate nao foi fornecido e moeda nao e USD, buscar automaticamente
    let rate = fx_rate || 1;
    const csvCurrency = currency_override || "USD";
    if (!fx_rate && csvCurrency !== "USD") {
      const live = await convertToUsd(1, csvCurrency);
      rate = live.fx_rate;
    }

    let normalized: NormalizedTransaction[] = [];
    if (fmt === "revolut") {
      normalized = normalizeRevolut(rows, bank_account_id, entity_id, rate);
    } else if (fmt === "mercury") {
      normalized = normalizeMercury(rows, bank_account_id, entity_id);
    } else {
      normalized = normalizeGeneric(rows, bank_account_id, entity_id, rate);
    }

    // Sobrescrever moeda se override foi passado
    if (csvCurrency !== "USD") {
      normalized = normalized.map((t) => ({
        ...t,
        currency_original: csvCurrency,
        fx_rate: rate,
        amount_usd: Math.round(t.amount_original * rate * 100) / 100,
      }));
    }

    const sb = createServerClient();

    // Buscar nomes para classificacao + moeda da conta para filtragem
    const { data: entityRow } = await sb
      .from("entities")
      .select("name")
      .eq("id", entity_id)
      .single();
    const { data: bankRow } = await sb
      .from("bank_accounts")
      .select("bank_name, currency")
      .eq("id", bank_account_id)
      .single();
    const entityName = (entityRow as { name: string } | null)?.name || entity_id;
    const bankInfo = bankRow as { bank_name: string; currency: string } | null;
    const bankName = bankInfo?.bank_name || "Bank";
    const accountCurrency = bankInfo?.currency || csvCurrency;

    // Filtrar transacoes que nao batem com a moeda da conta
    // (CSV multi-moeda do Revolut pode ter linhas em GBP misturadas em conta EUR)
    const beforeFilter = normalized.length;
    normalized = normalized.filter(
      (t) => t.currency_original.toUpperCase() === accountCurrency.toUpperCase()
    );
    const filteredOutByCurrency = beforeFilter - normalized.length;

    // Dedup INTRA-CSV (Revolut exporta multiplas legs com mesmo ID)
    const intraSet = new Set<string>();
    const dedupedNormalized = normalized.filter((t) => {
      if (intraSet.has(t.external_id)) return false;
      intraSet.add(t.external_id);
      return true;
    });
    const intraDuplicates = normalized.length - dedupedNormalized.length;

    // Dedup INTER-CSV: buscar external_ids ja existentes no banco
    const externalIds = dedupedNormalized.map((t) => t.external_id);
    let existingSet = new Set<string>();

    // Em chunks de 500 (limit IN clause do Supabase)
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

    const newOnes = dedupedNormalized.filter((t) => !existingSet.has(t.external_id));
    const skipped = dedupedNormalized.length - newOnes.length + intraDuplicates;

    // Modo preview: nao insere
    if (preview_only) {
      return NextResponse.json({
        format: fmt,
        total_rows: rows.length,
        normalized: normalized.length,
        new_transactions: newOnes.length,
        skipped_duplicates: skipped,
        sample: newOnes.slice(0, 10),
      });
    }

    // Criar batch de import para permitir undo
    let importBatchId: number | null = null;
    if (newOnes.length > 0) {
      const { data: batchRow } = await sb.from("import_batches").insert({
        bank_account_id,
        entity_id,
        format: fmt,
        file_name: body.file_name || null,
        total_rows: rows.length,
        rows_normalized: normalized.length,
        rows_skipped_duplicates: skipped,
      }).select("id").single();
      if (batchRow) importBatchId = (batchRow as any).id;
    }

    // Buscar dividas de aporte de investidor pendentes para matching
    // Regra: se o CSV tem uma transacao cujo counterparty/descricao bate com
    // o credor de uma divida de aporte e o valor e proximo, nao e receita —
    // e aporte de investidor (ja registrado em dividas)
    interface InvestorDebt {
      id: number;
      creditor: string;
      amount_total: number;
      amount_paid: number;
      currency: string;
    }
    let investorDebts: InvestorDebt[] = [];
    try {
      const { data: debtsData } = await sb
        .from("debts")
        .select("id, creditor, amount_total, amount_paid, currency")
        .eq("entity_id", entity_id)
        .eq("category", "aporte_investidor")
        .in("status", ["pending", "partial"]);
      investorDebts = (debtsData || []) as InvestorDebt[];
    } catch {}

    // Helper: checa se uma transacao casa com um aporte de investidor registrado
    const matchesInvestorDebt = (
      tx: { counterparty: string | null; description: string; amount_original: number; currency_original: string }
    ): InvestorDebt | null => {
      if (tx.amount_original <= 0) return null; // so entradas
      const txText = ((tx.counterparty || "") + " " + (tx.description || "")).toLowerCase();
      for (const debt of investorDebts) {
        if (!debt.creditor) continue;
        // Nome do credor aparece na descricao/counterparty?
        const creditorLower = debt.creditor.toLowerCase();
        if (!txText.includes(creditorLower)) continue;
        // Valor proximo (tolerancia 2%) e mesma moeda?
        const remaining = debt.amount_total - debt.amount_paid;
        if (remaining <= 0) continue;
        if (debt.currency !== tx.currency_original) continue;
        const diff = Math.abs(tx.amount_original - remaining) / Math.max(remaining, 0.01);
        if (diff <= 0.02) return debt;
      }
      return null;
    };

    // Classificar e inserir em lotes
    let imported = 0;
    let needsReviewCount = 0;
    let importedAmountSum = 0;
    let investorMatchCount = 0;
    const batchSize = 20;

    for (let i = 0; i < newOnes.length; i += batchSize) {
      const batch = newOnes.slice(i, i + batchSize);

      const classified = await Promise.all(
        batch.map(async (tx) => {
          // Primeiro: checar se e aporte de investidor (match com divida registrada)
          const debtMatch = matchesInvestorDebt(tx);
          let cls;
          if (debtMatch) {
            cls = {
              category_id: "investment_scp_in",
              classified_by: "rule" as const,
              confidence: 98,
              needs_review: false,
            };
            investorMatchCount++;
            // Atualizar a divida: marcar como parcial/pago
            try {
              const newPaid = debtMatch.amount_paid + tx.amount_original;
              const newStatus = newPaid >= debtMatch.amount_total ? "paid" : "partial";
              await sb
                .from("debts")
                .update({
                  amount_paid: Math.min(newPaid, debtMatch.amount_total),
                  status: newStatus,
                })
                .eq("id", debtMatch.id);
              // Evitar re-match do mesmo debt nesta importacao
              debtMatch.amount_paid = newPaid;
            } catch {}
          } else {
            cls = await classify(tx, entityName, bankName);
          }
          if (cls.needs_review) needsReviewCount++;
          return {
            external_id: tx.external_id,
            import_batch_id: importBatchId,
            bank_account_id: tx.bank_account_id,
            entity_id: tx.entity_id,
            timestamp: tx.timestamp,
            description: tx.description,
            counterparty: tx.counterparty,
            amount_original: tx.amount_original,
            currency_original: tx.currency_original,
            amount_usd: tx.amount_usd,
            fx_rate: tx.fx_rate,
            category_id: cls.category_id,
            classified_by: cls.classified_by,
            classification_confidence: cls.confidence,
            needs_review: cls.needs_review,
          };
        })
      );

      const { error } = await sb.from("transactions").insert(classified);
      if (error) {
        // Se for unique violation, tentar uma por uma (skip duplicatas)
        if (error.code === "23505") {
          for (const tx of classified) {
            const { error: singleErr } = await sb.from("transactions").insert(tx);
            if (!singleErr) {
              imported++;
              importedAmountSum += Number(tx.amount_original || 0);
            }
          }
        } else {
          return NextResponse.json(
            { error: error.message, imported_so_far: imported, batch_failed: i },
            { status: 500 }
          );
        }
      } else {
        imported += classified.length;
        for (const tx of classified) {
          importedAmountSum += Number(tx.amount_original || 0);
        }
      }
    }

    // Atualizar last_synced_at + ajustar saldo:
    // Modo A (opening_balance fornecido): saldo = abertura + sum(TODAS as transacoes da conta)
    // Modo B (sem opening_balance): saldo += delta das novas transacoes (incremental)
    let balanceDelta = 0;
    let newBalance: number | null = null;
    let usedOpeningBalance = false;
    if (imported > 0 || normalized.length > 0) {
      if (typeof opening_balance === "number") {
        // Modo A: recalcular saldo a partir da abertura + TODAS as transacoes desta conta
        const { data: allTxs } = await sb
          .from("transactions")
          .select("amount_original")
          .eq("bank_account_id", bank_account_id);
        const totalAllTxs = ((allTxs || []) as any[])
          .reduce((sum, t) => sum + Number(t.amount_original || 0), 0);
        newBalance = Math.round((opening_balance + totalAllTxs) * 100) / 100;
        balanceDelta = Math.round(importedAmountSum * 100) / 100;
        usedOpeningBalance = true;
      } else {
        // Modo B: incremental (soma delta das novas ao saldo atual)
        const { data: accBefore } = await sb
          .from("bank_accounts")
          .select("balance_current")
          .eq("id", bank_account_id)
          .single();
        const before = Number((accBefore as any)?.balance_current ?? 0);
        balanceDelta = Math.round(importedAmountSum * 100) / 100;
        newBalance = Math.round((before + balanceDelta) * 100) / 100;
      }

      await sb.from("bank_accounts").update({
        last_synced_at: new Date().toISOString(),
        balance_current: newBalance,
        opening_balance: typeof opening_balance === "number" ? opening_balance : undefined,
      }).eq("id", bank_account_id);
    }

    // Bookkeeping automatico: regenerar P&L dos meses afetados + detectar intercompany
    let pnlGenerated: string[] = [];
    let intercompanyDetected = 0;
    let fxPairsDetected = 0;

    if (imported > 0) {
      // Coletar meses unicos das transacoes importadas
      const monthsAffected = new Set<string>();
      for (const tx of newOnes) {
        const d = new Date(tx.timestamp);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        monthsAffected.add(monthStart.toISOString().slice(0, 10));
      }

      // Detectar intercompany das transacoes recentes
      try {
        const { data: ic } = await sb.rpc("detect_intercompany", { p_hours_window: 168 });
        intercompanyDetected = (ic as number) || 0;
      } catch {
        // nao critico
      }

      // Detectar pares FX: reclassificar inflows que sao contrapartida de outflows FX
      try {
        const { data: fx } = await sb.rpc("detect_fx_pairs", { p_hours_window: 168 });
        fxPairsDetected = (fx as number) || 0;
      } catch {
        // nao critico — funcao pode nao existir ainda
      }

      // Regenerar P&L para cada mes afetado (todas empresas + consolidado)
      const monthsArray = Array.from(monthsAffected);
      for (const month of monthsArray) {
        try {
          await sb.rpc("generate_consolidated_pnl", { p_month: month });
          pnlGenerated.push(month);
        } catch {
          // nao critico - admin pode regerar manualmente
        }
      }
    }

    // Atualizar contagens finais no batch
    if (importBatchId) {
      await sb.from("import_batches").update({
        rows_imported: imported,
        rows_needs_review: needsReviewCount,
        pnl_months_regenerated: pnlGenerated,
        intercompany_detected: intercompanyDetected,
      }).eq("id", importBatchId);
    }

    return NextResponse.json({
      batch_id: importBatchId,
      format: fmt,
      total_rows: rows.length,
      normalized: normalized.length,
      imported,
      skipped_duplicates: skipped,
      needs_review: needsReviewCount,
      pnl_months_regenerated: pnlGenerated,
      intercompany_detected: intercompanyDetected,
      balance_delta: balanceDelta,
      new_balance: newBalance,
      used_opening_balance: usedOpeningBalance,
      opening_balance: typeof opening_balance === "number" ? opening_balance : undefined,
      investor_matches: investorMatchCount,
      fx_pairs_detected: fxPairsDetected,
      filtered_out_by_currency: filteredOutByCurrency,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

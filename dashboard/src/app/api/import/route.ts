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
    }: {
      csv_text: string;
      bank_account_id: string;
      entity_id: EntityId;
      fx_rate?: number;
      currency_override?: string;
      format_override?: "revolut" | "mercury" | "generic";
      preview_only?: boolean;
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

    // Buscar nomes para classificacao
    const { data: entityRow } = await sb
      .from("entities")
      .select("name")
      .eq("id", entity_id)
      .single();
    const { data: bankRow } = await sb
      .from("bank_accounts")
      .select("bank_name")
      .eq("id", bank_account_id)
      .single();
    const entityName = (entityRow as { name: string } | null)?.name || entity_id;
    const bankName = (bankRow as { bank_name: string } | null)?.bank_name || "Bank";

    // Dedup: buscar external_ids ja existentes
    const externalIds = normalized.map((t) => t.external_id);
    const { data: existing } = await sb
      .from("transactions")
      .select("external_id")
      .in("external_id", externalIds);

    const existingSet = new Set((existing as { external_id: string }[] | null)?.map((e) => e.external_id) || []);
    const newOnes = normalized.filter((t) => !existingSet.has(t.external_id));
    const skipped = normalized.length - newOnes.length;

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

    // Classificar e inserir em lotes
    let imported = 0;
    let needsReviewCount = 0;
    const batchSize = 20;

    for (let i = 0; i < newOnes.length; i += batchSize) {
      const batch = newOnes.slice(i, i + batchSize);

      const classified = await Promise.all(
        batch.map(async (tx) => {
          const cls = await classify(tx, entityName, bankName);
          if (cls.needs_review) needsReviewCount++;
          return {
            external_id: tx.external_id,
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
        return NextResponse.json(
          { error: error.message, imported_so_far: imported, batch_failed: i },
          { status: 500 }
        );
      }
      imported += classified.length;
    }

    return NextResponse.json({
      format: fmt,
      total_rows: rows.length,
      normalized: normalized.length,
      imported,
      skipped_duplicates: skipped,
      needs_review: needsReviewCount,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

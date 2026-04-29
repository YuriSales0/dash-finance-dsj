import type { EntityId } from "@/types/database";

export interface NormalizedTransaction {
  external_id: string;
  bank_account_id: string;
  entity_id: EntityId;
  timestamp: string;
  description: string;
  counterparty: string | null;
  amount_original: number;
  currency_original: string;
  fx_rate: number;
  amount_usd: number;
}

export type ImportFormat = "revolut" | "mercury" | "generic" | "unknown";

// Detectar formato baseado nos headers
export function detectFormat(headers: string[]): ImportFormat {
  const lower = headers.map((h) => h.toLowerCase());
  const has = (s: string) => lower.some((h) => h.includes(s));

  if (has("date started") && has("type") && (has("payer") || has("beneficiary"))) {
    return "revolut";
  }
  if (has("posted at") || (has("counterparty") && has("kind"))) {
    return "mercury";
  }
  if (has("date") && has("amount") && (has("description") || has("counterparty"))) {
    return "generic";
  }
  return "unknown";
}

// Pegar valor case-insensitive
function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    for (const k in row) {
      if (k.toLowerCase().trim() === key.toLowerCase().trim()) {
        return row[k];
      }
    }
  }
  return "";
}

// Limpar e parsear numero (suporta -1,234.56 ou 1.234,56 ou 1234.56)
function parseAmount(value: string): number {
  if (!value) return 0;
  let s = value.replace(/[^\d.,\-]/g, "").trim();
  // Detecta se virgula e separador decimal (ex: "1.234,56") ou de milhar
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseDate(value: string): string {
  if (!value) return new Date().toISOString();
  // Tenta varios formatos
  const native = new Date(value);
  if (!isNaN(native.getTime())) return native.toISOString();
  // dd/mm/yyyy ou dd-mm-yyyy
  const m = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(year, Number(mo) - 1, Number(d));
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

export function normalizeRevolut(
  rows: Record<string, string>[],
  bankAccountId: string,
  entityId: EntityId,
  fxRate: number = 1
): NormalizedTransaction[] {
  return rows
    .map((row) => {
      const id = getField(row, "ID", "Reference", "Transaction ID");
      const dateRaw = getField(row, "Date completed (UTC)", "Date completed", "Date started (UTC)", "Date started", "Date");
      const type = getField(row, "Type");
      const description = getField(row, "Description") || type || "Sem descricao";
      const payer = getField(row, "Payer", "Beneficiary", "Beneficiary account number");
      const reference = getField(row, "Reference");
      const amount = parseAmount(getField(row, "Total amount", "Payment amount", "Amount"));
      const currency = (getField(row, "Currency", "Payment currency") || "USD").toUpperCase();

      if (!id || amount === 0) return null;

      const counterparty = payer || reference || null;
      const isGbp = currency === "GBP";
      const amountUsd = isGbp ? amount * fxRate : amount;

      return {
        external_id: `revolut:${id}`,
        bank_account_id: bankAccountId,
        entity_id: entityId,
        timestamp: parseDate(dateRaw),
        description,
        counterparty,
        amount_original: amount,
        currency_original: currency,
        fx_rate: isGbp ? fxRate : 1,
        amount_usd: amountUsd,
      };
    })
    .filter((t): t is NormalizedTransaction => t !== null);
}

export function normalizeMercury(
  rows: Record<string, string>[],
  bankAccountId: string,
  entityId: EntityId
): NormalizedTransaction[] {
  return rows
    .map((row) => {
      const id = getField(row, "ID", "Transaction ID");
      const date = getField(row, "Posted At", "Date", "Created At");
      const description = getField(row, "Description", "Note") || "Sem descricao";
      const counterparty = getField(row, "Counterparty Name", "Counterparty");
      const amount = parseAmount(getField(row, "Amount"));

      if (!id || amount === 0) return null;

      return {
        external_id: `mercury:${id}`,
        bank_account_id: bankAccountId,
        entity_id: entityId,
        timestamp: parseDate(date),
        description,
        counterparty: counterparty || null,
        amount_original: amount,
        currency_original: "USD",
        fx_rate: 1,
        amount_usd: amount,
      };
    })
    .filter((t): t is NormalizedTransaction => t !== null);
}

export function normalizeGeneric(
  rows: Record<string, string>[],
  bankAccountId: string,
  entityId: EntityId,
  fxRate: number = 1
): NormalizedTransaction[] {
  return rows
    .map((row, idx) => {
      const id = getField(row, "ID", "Transaction ID", "Reference") || `imported-${Date.now()}-${idx}`;
      const date = getField(row, "Date", "Timestamp", "Posted At");
      const description = getField(row, "Description", "Note", "Memo") || "Sem descricao";
      const counterparty = getField(row, "Counterparty", "Payer", "Beneficiary", "Recipient");
      const amount = parseAmount(getField(row, "Amount", "Total amount", "Value"));
      const currency = (getField(row, "Currency") || "USD").toUpperCase();

      if (amount === 0) return null;

      const isGbp = currency === "GBP";
      const amountUsd = isGbp ? amount * fxRate : amount;

      return {
        external_id: `manual:${id}`,
        bank_account_id: bankAccountId,
        entity_id: entityId,
        timestamp: parseDate(date),
        description,
        counterparty: counterparty || null,
        amount_original: amount,
        currency_original: currency,
        fx_rate: isGbp ? fxRate : 1,
        amount_usd: amountUsd,
      };
    })
    .filter((t): t is NormalizedTransaction => t !== null);
}

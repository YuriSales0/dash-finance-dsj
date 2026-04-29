// Servico de cotacao de moedas — usa Frankfurter API (gratuita, sem API key)
// Fonte: Banco Central Europeu (ECB)
// https://www.frankfurter.app/

const FRANKFURTER_BASE = "https://api.frankfurter.app";

interface RateCache {
  date: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RateCache | null = null;
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 horas

export type Currency = "USD" | "GBP" | "EUR" | "BRL";

export const SUPPORTED_CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: "USD", label: "Dolar americano", symbol: "$" },
  { code: "GBP", label: "Libra esterlina", symbol: "£" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "BRL", label: "Real brasileiro", symbol: "R$" },
];

// Buscar cotacoes do dia (base USD)
export async function getLatestRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.rates;
  }

  try {
    const res = await fetch(`${FRANKFURTER_BASE}/latest?from=USD&to=GBP,EUR,BRL`, {
      next: { revalidate: 14400 },
    });
    if (!res.ok) throw new Error(`Frankfurter API ${res.status}`);
    const data = await res.json();

    // Frankfurter retorna: { "base": "USD", "date": "2026-04-29", "rates": { "GBP": 0.79, "EUR": 0.92, "BRL": 5.70 } }
    const rates: Record<string, number> = { USD: 1, ...data.rates };
    cache = { date: data.date, rates, fetchedAt: Date.now() };
    return rates;
  } catch (err) {
    console.error("FX fetch failed, using fallback:", err);
    return getFallbackRates();
  }
}

// Buscar cotacao de data especifica
export async function getHistoricalRate(date: string, from: string, to: string): Promise<number> {
  if (from === to) return 1;

  try {
    const res = await fetch(`${FRANKFURTER_BASE}/${date}?from=${from}&to=${to}`);
    if (!res.ok) throw new Error(`Frankfurter API ${res.status}`);
    const data = await res.json();
    return data.rates[to] || 1;
  } catch (err) {
    console.error("Historical FX fetch failed:", err);
    const fallback = getFallbackRates();
    return convertViaUsd(from, to, fallback);
  }
}

// Converter valor de uma moeda pra outra
export async function convertToUsd(amount: number, fromCurrency: string): Promise<{
  amount_usd: number;
  fx_rate: number;
  rate_date: string;
}> {
  if (fromCurrency === "USD") {
    return { amount_usd: amount, fx_rate: 1, rate_date: new Date().toISOString().slice(0, 10) };
  }

  const rates = await getLatestRates();
  const fromRate = rates[fromCurrency];

  if (!fromRate) {
    return { amount_usd: amount, fx_rate: 1, rate_date: new Date().toISOString().slice(0, 10) };
  }

  // rates sao USD -> X (ex: USD -> GBP = 0.79)
  // entao pra converter GBP -> USD: amount / rate
  const fx_rate = 1 / fromRate;
  const amount_usd = amount * fx_rate;

  return {
    amount_usd: Math.round(amount_usd * 100) / 100,
    fx_rate: Math.round(fx_rate * 1000000) / 1000000,
    rate_date: cache?.date || new Date().toISOString().slice(0, 10),
  };
}

// Converter entre quaisquer 2 moedas via USD
function convertViaUsd(from: string, to: string, rates: Record<string, number>): number {
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  return toRate / fromRate;
}

// Fallback para quando API nao responde
function getFallbackRates(): Record<string, number> {
  return {
    USD: 1,
    GBP: 0.79,
    EUR: 0.92,
    BRL: 5.70,
  };
}

// Formatar cotacao para exibicao
export function formatFxDisplay(rates: Record<string, number>): string {
  const parts: string[] = [];
  if (rates.GBP) parts.push(`1 USD = ${rates.GBP.toFixed(4)} GBP`);
  if (rates.EUR) parts.push(`1 USD = ${rates.EUR.toFixed(4)} EUR`);
  if (rates.BRL) parts.push(`1 USD = ${rates.BRL.toFixed(2)} BRL`);
  return parts.join(" | ");
}

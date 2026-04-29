import { createServerClient } from "@/lib/supabase/server";
import type { NormalizedTransaction } from "./normalize";

export interface ClassificationResult {
  category_id: string | null;
  classified_by: "rule" | "ai" | null;
  confidence: number;
  needs_review: boolean;
}

interface Rule {
  id: number;
  pattern_type: string;
  pattern_value: string;
  category_id: string;
}

let cachedRules: Rule[] | null = null;

async function loadRules(): Promise<Rule[]> {
  if (cachedRules) return cachedRules;
  const sb = createServerClient();
  const { data } = await sb
    .from("classification_rules")
    .select("id, pattern_type, pattern_value, category_id")
    .eq("active", true);
  cachedRules = ((data || []) as Rule[]);
  return cachedRules;
}

export async function classifyByRules(
  tx: NormalizedTransaction
): Promise<ClassificationResult | null> {
  const rules = await loadRules();
  const counterparty = (tx.counterparty || "").toLowerCase();
  const description = (tx.description || "").toLowerCase();

  for (const rule of rules) {
    const pat = rule.pattern_value.toLowerCase();
    if (rule.pattern_type === "counterparty" && counterparty.includes(pat)) {
      return {
        category_id: rule.category_id,
        classified_by: "rule",
        confidence: counterparty === pat ? 100 : 85,
        needs_review: false,
      };
    }
    if (rule.pattern_type === "description" && description.includes(pat)) {
      return {
        category_id: rule.category_id,
        classified_by: "rule",
        confidence: 80,
        needs_review: false,
      };
    }
  }
  return null;
}

const CATEGORY_LIST = [
  "revenue_shopify (vendas Shopify/payouts)",
  "revenue_other (outras receitas)",
  "cost_ads_meta (Meta/Facebook Ads)",
  "cost_ads_tiktok (TikTok Ads)",
  "cost_ads_google (Google Ads)",
  "cost_products (fornecedores/produtos)",
  "cost_shipping (frete/embalagem)",
  "cost_gateway (taxas processador)",
  "cost_chargebacks (chargebacks)",
  "cost_refunds (reembolsos)",
  "cost_team (salarios/freelancers)",
  "cost_saas (Shopify, MSync, ferramentas)",
  "cost_infra (hosting/dominios)",
  "cost_legal (juridico/contabilidade)",
  "cost_office (escritorio/operacional)",
  "transfer_intercompany (entre empresas DSJ)",
  "transfer_interbank (entre bancos mesma empresa)",
  "transfer_fx (cambio)",
];

export async function classifyByAI(
  tx: NormalizedTransaction,
  entityName: string,
  bankName: string
): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      category_id: null,
      classified_by: null,
      confidence: 0,
      needs_review: true,
    };
  }

  const prompt = `Classifique esta transacao bancaria.

Empresa: ${entityName}
Banco: ${bankName}
Descricao: ${tx.description}
Contraparte: ${tx.counterparty || "n/a"}
Valor: ${tx.amount_original} ${tx.currency_original}
Data: ${tx.timestamp.slice(0, 10)}

Categorias disponiveis:
${CATEGORY_LIST.join("\n")}

Retorne APENAS JSON: {"category_id": "string", "confidence": 0-100, "reasoning": "1 frase"}

REGRAS:
- Contraparte com nome de outra empresa do grupo (DSJ Network, Universal MKT, DSJ Connect): transfer_intercompany
- Mesmo banco mesma empresa: transfer_interbank
- "exchange"/"FX"/"conversion" no description: transfer_fx
- Na duvida entre receita e custo: escolha o mais conservador (custo)`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`AI ${res.status}`);
    const data = await res.json();
    const text = data.content[0].text as string;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON nao encontrado");
    const parsed = JSON.parse(match[0]);

    const confidence = Number(parsed.confidence) || 0;
    return {
      category_id: parsed.category_id || null,
      classified_by: "ai",
      confidence,
      needs_review: confidence < 70,
    };
  } catch (err) {
    return {
      category_id: null,
      classified_by: null,
      confidence: 0,
      needs_review: true,
    };
  }
}

export async function classify(
  tx: NormalizedTransaction,
  entityName: string,
  bankName: string
): Promise<ClassificationResult> {
  const byRule = await classifyByRules(tx);
  if (byRule) return byRule;
  return classifyByAI(tx, entityName, bankName);
}

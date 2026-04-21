import type {
  BankAccount,
  Transaction,
  MonthlyPnl,
  Investor,
  Opportunity,
  Investment,
  InvestorMetrics,
  EntityId,
} from "@/types/database";

// ============================================================
// MOCK DATA — Dados realistas para demo
// Trocar para Supabase real via env DEMO_MODE=false
// ============================================================

export const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: "dsj_net_mercury",
    entity_id: "dsj_network",
    bank_name: "Mercury",
    currency: "USD",
    api_provider: "mercury",
    last_synced_at: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
    balance_current: 142_580.34,
    balance_available: 138_290.10,
    active: true,
  },
  {
    id: "dsj_net_revolut",
    entity_id: "dsj_network",
    bank_name: "Revolut",
    currency: "USD",
    api_provider: "revolut",
    last_synced_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    balance_current: 38_420.91,
    balance_available: 38_420.91,
    active: true,
  },
  {
    id: "uni_mkt_airwallex",
    entity_id: "universal_mkt",
    bank_name: "Airwallex",
    currency: "GBP",
    api_provider: "airwallex",
    last_synced_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    balance_current: 64_120.50,
    balance_available: 62_500.00,
    active: true,
  },
  {
    id: "uni_mkt_revolut",
    entity_id: "universal_mkt",
    bank_name: "Revolut",
    currency: "GBP",
    api_provider: "revolut",
    last_synced_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    balance_current: 21_890.43,
    balance_available: 21_890.43,
    active: true,
  },
  {
    id: "dsj_con_mercury",
    entity_id: "dsj_connect",
    bank_name: "Mercury",
    currency: "USD",
    api_provider: "mercury",
    last_synced_at: new Date(Date.now() - 1000 * 60 * 41).toISOString(),
    balance_current: 28_450.00,
    balance_available: 28_450.00,
    active: true,
  },
];

// Câmbio fictício GBP→USD (atual)
export const MOCK_FX_GBP_USD = 1.27;

// ============================================================
// TRANSAÇÕES MOCK (realistas, últimos 60 dias)
// ============================================================

const TX_TEMPLATES = [
  // Receitas
  { counterparty: "Shopify Payments", desc: "Shopify payout #4823", category: "revenue_shopify", group: "revenue", amounts: [4500, 6800, 8200, 12500, 5400] },
  { counterparty: "Stripe", desc: "Stripe payout", category: "revenue_shopify", group: "revenue", amounts: [3200, 5100, 7800] },
  // Custos variáveis
  { counterparty: "Meta Platforms Ireland", desc: "Meta Ads invoice", category: "cost_ads_meta", group: "cost", amounts: [2400, 3800, 5200, 6100, 8400] },
  { counterparty: "TikTok Ads", desc: "TikTok For Business charge", category: "cost_ads_tiktok", group: "cost", amounts: [1200, 2400, 3100] },
  { counterparty: "Google Ads", desc: "Google Ads billing", category: "cost_ads_google", group: "cost", amounts: [800, 1400, 2200] },
  { counterparty: "CJ Dropshipping", desc: "Order fulfillment batch", category: "cost_products", group: "cost", amounts: [1800, 2400, 3200, 4800] },
  { counterparty: "Zendrop", desc: "Product sourcing", category: "cost_products", group: "cost", amounts: [950, 1500, 2100] },
  { counterparty: "Stripe Fees", desc: "Stripe processing fees", category: "cost_gateway", group: "cost", amounts: [120, 240, 380, 510] },
  { counterparty: "PayPal", desc: "PayPal chargeback", category: "cost_chargebacks", group: "cost", amounts: [180, 290] },
  { counterparty: "DHL Express", desc: "Shipping label batch", category: "cost_shipping", group: "cost", amounts: [340, 580, 720] },
  // Custos fixos
  { counterparty: "Shopify Inc", desc: "Shopify Plus monthly", category: "cost_saas", group: "cost", amounts: [2000] },
  { counterparty: "Vercel Inc", desc: "Vercel hosting", category: "cost_infra", group: "cost", amounts: [180] },
  { counterparty: "Anthropic", desc: "Claude API usage", category: "cost_infra", group: "cost", amounts: [120, 240] },
  { counterparty: "Joao Silva (PJ)", desc: "Freelance dev payment", category: "cost_team", group: "cost", amounts: [3500, 4200] },
  { counterparty: "Maria Costa", desc: "CMO salary", category: "cost_team", group: "cost", amounts: [5500] },
  { counterparty: "Stone Advogados", desc: "Legal retainer", category: "cost_legal", group: "cost", amounts: [1200] },
  // Transferências (intercompany / câmbio)
  { counterparty: "Universal MKT LLP", desc: "Intercompany transfer", category: "transfer_intercompany", group: "transfer", amounts: [5000, 8000] },
  { counterparty: "DSJ Network LLC", desc: "Intercompany transfer", category: "transfer_intercompany", group: "transfer", amounts: [5000, 8000] },
];

function genTransactions(): Transaction[] {
  const accounts = MOCK_BANK_ACCOUNTS;
  const txs: Transaction[] = [];
  let id = 1;
  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;

  for (let day = 0; day < 60; day++) {
    const txCount = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < txCount; i++) {
      const acc = accounts[Math.floor(Math.random() * accounts.length)];
      const tpl = TX_TEMPLATES[Math.floor(Math.random() * TX_TEMPLATES.length)];
      const amount = tpl.amounts[Math.floor(Math.random() * tpl.amounts.length)];
      const sign = tpl.group === "revenue" ? 1 : -1;
      const amount_original = amount * sign;
      const amount_usd = acc.currency === "GBP" ? amount_original * MOCK_FX_GBP_USD : amount_original;
      const fx_rate = acc.currency === "GBP" ? MOCK_FX_GBP_USD : 1.0;

      // 8% das transações marcadas como needs_review (low confidence)
      const needsReview = Math.random() < 0.08;
      const confidence = needsReview ? 45 + Math.random() * 20 : 75 + Math.random() * 25;

      txs.push({
        id: id++,
        external_id: `mock_${acc.id}_${id}`,
        bank_account_id: acc.id,
        entity_id: acc.entity_id,
        timestamp: new Date(now - day * DAY - Math.random() * DAY).toISOString(),
        description: tpl.desc,
        counterparty: tpl.counterparty,
        amount_original: parseFloat(amount_original.toFixed(2)),
        currency_original: acc.currency,
        amount_usd: parseFloat(amount_usd.toFixed(2)),
        fx_rate,
        category_id: needsReview ? null : tpl.category,
        is_intercompany: tpl.category === "transfer_intercompany",
        linked_transaction_id: null,
        counterpart_entity_id: null,
        classified_by: needsReview ? "ai" : Math.random() > 0.3 ? "rule" : "ai",
        classification_confidence: parseFloat(confidence.toFixed(1)),
        needs_review: needsReview,
        reviewed_by: null,
        reviewed_at: null,
        notes: null,
        created_at: new Date(now - day * DAY).toISOString(),
      });
    }
  }

  return txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export const MOCK_TRANSACTIONS: Transaction[] = genTransactions();

// ============================================================
// P&L MENSAL MOCK (últimos 12 meses)
// ============================================================

function genMonthlyPnl(): MonthlyPnl[] {
  const result: MonthlyPnl[] = [];
  const entities: EntityId[] = ["dsj_network", "universal_mkt", "dsj_connect"];
  const now = new Date();
  let id = 1;

  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const monthStr = monthDate.toISOString().slice(0, 10);
    let consolidated = {
      revenue: 0, cost_ads: 0, cost_products: 0, cost_shipping: 0,
      cost_gateway: 0, cost_chargebacks: 0, cost_refunds: 0,
      cost_team: 0, cost_saas: 0, cost_infra: 0, cost_legal: 0, cost_other: 0,
    };

    for (const entity of entities) {
      // crescimento mês a mês
      const growth = 1 + (11 - monthsAgo) * 0.04;
      const base = entity === "dsj_network" ? 85_000 : entity === "universal_mkt" ? 45_000 : 12_000;
      const revenue = base * growth * (0.85 + Math.random() * 0.3);
      const cost_ads = revenue * (0.32 + Math.random() * 0.06);
      const cost_products = revenue * (0.28 + Math.random() * 0.04);
      const cost_shipping = revenue * (0.05 + Math.random() * 0.02);
      const cost_gateway = revenue * 0.029;
      const cost_chargebacks = revenue * 0.008;
      const cost_refunds = revenue * 0.012;
      const cost_team = entity === "dsj_network" ? 12_000 : entity === "universal_mkt" ? 6_000 : 0;
      const cost_saas = entity === "dsj_network" ? 2_400 : 1_200;
      const cost_infra = 600;
      const cost_legal = entity === "dsj_network" ? 1_200 : 800;
      const cost_other = 400;
      const total_costs = cost_ads + cost_products + cost_shipping + cost_gateway
        + cost_chargebacks + cost_refunds + cost_team + cost_saas + cost_infra + cost_legal + cost_other;
      const net_profit = revenue - total_costs;
      const margin_pct = (net_profit / revenue) * 100;

      const row: MonthlyPnl = {
        id: id++,
        month: monthStr,
        entity_id: entity,
        revenue: parseFloat(revenue.toFixed(2)),
        cost_ads: parseFloat(cost_ads.toFixed(2)),
        cost_products: parseFloat(cost_products.toFixed(2)),
        cost_shipping: parseFloat(cost_shipping.toFixed(2)),
        cost_gateway: parseFloat(cost_gateway.toFixed(2)),
        cost_chargebacks: parseFloat(cost_chargebacks.toFixed(2)),
        cost_refunds: parseFloat(cost_refunds.toFixed(2)),
        cost_team: parseFloat(cost_team.toFixed(2)),
        cost_saas: parseFloat(cost_saas.toFixed(2)),
        cost_infra: parseFloat(cost_infra.toFixed(2)),
        cost_legal: parseFloat(cost_legal.toFixed(2)),
        cost_other: parseFloat(cost_other.toFixed(2)),
        total_costs: parseFloat(total_costs.toFixed(2)),
        net_profit: parseFloat(net_profit.toFixed(2)),
        margin_pct: parseFloat(margin_pct.toFixed(2)),
        pending_review_count: monthsAgo === 0 ? 3 : 0,
        generated_at: new Date().toISOString(),
      };

      result.push(row);
      consolidated.revenue += row.revenue;
      consolidated.cost_ads += row.cost_ads;
      consolidated.cost_products += row.cost_products;
      consolidated.cost_shipping += row.cost_shipping;
      consolidated.cost_gateway += row.cost_gateway;
      consolidated.cost_chargebacks += row.cost_chargebacks;
      consolidated.cost_refunds += row.cost_refunds;
      consolidated.cost_team += row.cost_team;
      consolidated.cost_saas += row.cost_saas;
      consolidated.cost_infra += row.cost_infra;
      consolidated.cost_legal += row.cost_legal;
      consolidated.cost_other += row.cost_other;
    }

    const total_costs = Object.values(consolidated).reduce((a, b) => a + b, 0) - consolidated.revenue;
    const net_profit = consolidated.revenue - total_costs;
    const margin_pct = (net_profit / consolidated.revenue) * 100;

    result.push({
      id: id++,
      month: monthStr,
      entity_id: "consolidated",
      ...consolidated,
      revenue: parseFloat(consolidated.revenue.toFixed(2)),
      total_costs: parseFloat(total_costs.toFixed(2)),
      net_profit: parseFloat(net_profit.toFixed(2)),
      margin_pct: parseFloat(margin_pct.toFixed(2)),
      pending_review_count: monthsAgo === 0 ? 3 : 0,
      generated_at: new Date().toISOString(),
    });
  }

  return result;
}

export const MOCK_MONTHLY_PNL: MonthlyPnl[] = genMonthlyPnl();

// ============================================================
// INVESTIDORES + OPORTUNIDADES + INVESTIMENTOS
// ============================================================

export const MOCK_INVESTORS: Investor[] = [
  {
    id: 1, name: "Carlos Mendes", cpf: "123.456.789-01", email: "carlos@example.com",
    phone: "+55 11 98765-4321", bank_name: "Itau", bank_agency: "0001",
    bank_account: "12345-6", pix_key: "carlos@example.com",
    invite_code: "DSJ001", invited_by: null, auth_user_id: null,
    status: "approved", approved_by: "admin", approved_at: "2026-01-15T10:00:00Z",
    total_invested: 25000, total_returned: 32000,
    created_at: "2026-01-10T10:00:00Z",
  },
  {
    id: 2, name: "Ana Paula Souza", cpf: "987.654.321-09", email: "ana@example.com",
    phone: "+55 21 91234-5678", bank_name: "Nubank", bank_agency: "0001",
    bank_account: "98765-4", pix_key: "ana@example.com",
    invite_code: "DSJ002", invited_by: 1, auth_user_id: null,
    status: "approved", approved_by: "admin", approved_at: "2026-02-08T14:00:00Z",
    total_invested: 15000, total_returned: 18750,
    created_at: "2026-02-05T10:00:00Z",
  },
  {
    id: 3, name: "Rodrigo Almeida", cpf: "456.789.123-45", email: "rodrigo@example.com",
    phone: "+55 11 95555-1234", bank_name: "Bradesco", bank_agency: "1234",
    bank_account: "56789-0", pix_key: "+5511955551234",
    invite_code: "DSJ003", invited_by: 1, auth_user_id: null,
    status: "pending", approved_by: null, approved_at: null,
    total_invested: 0, total_returned: 0,
    created_at: "2026-04-18T10:00:00Z",
  },
];

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: 1, title: "Operacao Q2 — Linha Fitness", description: "Capital para escalar produto validado: garrafa termica 1L com 4.8 ROAS comprovado em testes.",
    product_name: "Garrafa Termica Premium 1L", target_amount: 50000, raised_amount: 50000,
    min_investment: 2500, duration_days: 60,
    return_estimate_min: 18, return_estimate_max: 28,
    proven_roas: 4.8, proven_margin: 32, proven_sales: 850, proven_chargeback_rate: 0.4,
    allocation_ads_pct: 60, allocation_products_pct: 25, allocation_shipping_pct: 10, allocation_reserve_pct: 5,
    status: "active", risks_description: "Risco de saturacao do publico, competidores...",
    created_by: "admin", opened_at: "2026-03-01T10:00:00Z", funded_at: "2026-03-15T10:00:00Z",
    completed_at: null, actual_return_pct: null,
    created_at: "2026-02-25T10:00:00Z",
  },
  {
    id: 2, title: "Operacao Q2 — Linha Pet", description: "Brinquedo interativo para pets, validado com 5.2 ROAS em mercado USA.",
    product_name: "Pet Interactive Toy", target_amount: 75000, raised_amount: 32500,
    min_investment: 5000, duration_days: 90,
    return_estimate_min: 22, return_estimate_max: 35,
    proven_roas: 5.2, proven_margin: 38, proven_sales: 420, proven_chargeback_rate: 0.3,
    allocation_ads_pct: 55, allocation_products_pct: 30, allocation_shipping_pct: 10, allocation_reserve_pct: 5,
    status: "open", risks_description: "Mercado pet competitivo, sazonalidade...",
    created_by: "admin", opened_at: "2026-04-10T10:00:00Z", funded_at: null,
    completed_at: null, actual_return_pct: null,
    created_at: "2026-04-05T10:00:00Z",
  },
  {
    id: 3, title: "Operacao Q1 — Beleza", description: "Linha skincare validada com retorno de 26%.",
    product_name: "Vitamin C Serum", target_amount: 40000, raised_amount: 40000,
    min_investment: 2500, duration_days: 75,
    return_estimate_min: 15, return_estimate_max: 25,
    proven_roas: 4.5, proven_margin: 35, proven_sales: 920, proven_chargeback_rate: 0.5,
    allocation_ads_pct: 58, allocation_products_pct: 28, allocation_shipping_pct: 9, allocation_reserve_pct: 5,
    status: "completed", risks_description: "Concluida com sucesso.",
    created_by: "admin", opened_at: "2025-12-01T10:00:00Z", funded_at: "2025-12-15T10:00:00Z",
    completed_at: "2026-02-28T10:00:00Z", actual_return_pct: 26,
    created_at: "2025-11-25T10:00:00Z",
  },
];

export const MOCK_INVESTMENTS: Investment[] = [
  { id: 1, investor_id: 1, opportunity_id: 1, amount: 15000, status: "active",
    contract_hash: "abc123", contract_signed_at: "2026-03-15T10:00:00Z",
    confirmed_at: "2026-03-15T11:00:00Z", return_amount: null, return_pct: null,
    returned_at: null, created_at: "2026-03-14T10:00:00Z" },
  { id: 2, investor_id: 1, opportunity_id: 3, amount: 10000, status: "returned",
    contract_hash: "def456", contract_signed_at: "2025-12-15T10:00:00Z",
    confirmed_at: "2025-12-15T11:00:00Z", return_amount: 12600, return_pct: 26,
    returned_at: "2026-02-28T10:00:00Z", created_at: "2025-12-14T10:00:00Z" },
  { id: 3, investor_id: 2, opportunity_id: 1, amount: 7500, status: "active",
    contract_hash: "ghi789", contract_signed_at: "2026-03-15T10:00:00Z",
    confirmed_at: "2026-03-15T11:00:00Z", return_amount: null, return_pct: null,
    returned_at: null, created_at: "2026-03-14T10:00:00Z" },
  { id: 4, investor_id: 2, opportunity_id: 3, amount: 7500, status: "returned",
    contract_hash: "jkl012", contract_signed_at: "2025-12-15T10:00:00Z",
    confirmed_at: "2025-12-15T11:00:00Z", return_amount: 9450, return_pct: 26,
    returned_at: "2026-02-28T10:00:00Z", created_at: "2025-12-14T10:00:00Z" },
];

export const MOCK_INVESTOR_METRICS: InvestorMetrics = {
  id: 1,
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  total_revenue_usd: 195_400,
  margin_pct: 18.5,
  active_operations: 1,
  months_operating: 14,
  opportunities_completed: 3,
  opportunities_avg_return: 24,
  opportunities_loss_count: 0,
  total_capital_returned: 90_000,
  visible: true,
  generated_at: new Date().toISOString(),
};

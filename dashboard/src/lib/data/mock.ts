import type {
  Entity,
  BankAccount,
  Transaction,
  MonthlyPnl,
  Investor,
  Opportunity,
  Investment,
  InvestorMetrics,
  EntityId,
  Receivable,
  Debt,
  Financing,
  RiskMetric,
} from "@/types/database";

// ============================================================
// MOCK DATA — Dados realistas para demo
// Trocar para Supabase real via env DEMO_MODE=false
// ============================================================

export const MOCK_ENTITIES: Entity[] = [
  { id: "dsj_network", name: "DSJ Network LLC", jurisdiction: "Florida, USA", currency_default: "USD" },
  { id: "universal_mkt", name: "Universal MKT LLP", jurisdiction: "London, UK", currency_default: "GBP" },
  { id: "dsj_connect", name: "DSJ Connect LLC", jurisdiction: "Delaware, USA", currency_default: "USD" },
  { id: "dsj_commerce", name: "DSJ Commerce LTDA", jurisdiction: "Brasil", currency_default: "BRL" },
];

export const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    id: "dsj_net_revolut",
    entity_id: "dsj_network",
    bank_name: "Revolut",
    currency: "USD",
    api_provider: "revolut",
    last_synced_at: null,
    balance_current: 142_580.34,
    balance_available: 138_290.10,
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
    id: "dsj_con_revolut",
    entity_id: "dsj_connect",
    bank_name: "Revolut",
    currency: "USD",
    api_provider: "revolut",
    last_synced_at: null,
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

// ============================================================
// RECEIVABLES — Recebiveis (DSJ tem direito a receber)
// ============================================================
const today = new Date();
const daysFrom = (d: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

export const MOCK_RECEIVABLES: Receivable[] = [
  {
    id: 1, entity_id: "dsj_network", description: "Payout Shopify - vendas Mar/26",
    counterparty: "Shopify Payments", amount_total: 45_200, amount_received: 0,
    currency: "USD", issue_date: daysFrom(-3), due_date: daysFrom(11),
    status: "pending", open_for_financing: true,
    financing_interest_rate_pct: 2.5, financing_min_amount: 1000,
    financing_max_amount: 30_000, financing_redemption_days: 14,
    financing_terms: "Antecipacao de payout Shopify. Garantido pelos pedidos ja capturados.",
    financing_raised: 7500, source: "manual", source_ref: "PAY-2026-0312",
    notes: null, created_by: null, created_at: daysFrom(-3) + "T10:00:00Z",
  },
  {
    id: 2, entity_id: "dsj_network", description: "Stripe - reserva 3% sobre vendas",
    counterparty: "Stripe", amount_total: 12_800, amount_received: 0,
    currency: "USD", issue_date: daysFrom(-30), due_date: daysFrom(60),
    status: "pending", open_for_financing: true,
    financing_interest_rate_pct: 3.5, financing_min_amount: 500,
    financing_max_amount: 10_000, financing_redemption_days: 60,
    financing_terms: "Reserva tecnica do Stripe sera liberada em 60 dias.",
    financing_raised: 0, source: "manual", source_ref: null,
    notes: "Reserva atual de 3% sobre processamento", created_by: null,
    created_at: daysFrom(-30) + "T10:00:00Z",
  },
  {
    id: 3, entity_id: "universal_mkt", description: "Payout PayPal Europa",
    counterparty: "PayPal", amount_total: 18_500, amount_received: 0,
    currency: "GBP", issue_date: daysFrom(-1), due_date: daysFrom(7),
    status: "pending", open_for_financing: false,
    financing_interest_rate_pct: null, financing_min_amount: null,
    financing_max_amount: null, financing_redemption_days: null,
    financing_terms: null, financing_raised: 0, source: "manual",
    source_ref: "PP-EU-2026-0408", notes: null, created_by: null,
    created_at: daysFrom(-1) + "T10:00:00Z",
  },
  {
    id: 4, entity_id: "dsj_network", description: "Reembolso Meta Ads (creditos)",
    counterparty: "Meta Platforms", amount_total: 3_200, amount_received: 3_200,
    currency: "USD", issue_date: daysFrom(-60), due_date: daysFrom(-15),
    status: "paid", open_for_financing: false,
    financing_interest_rate_pct: null, financing_min_amount: null,
    financing_max_amount: null, financing_redemption_days: null,
    financing_terms: null, financing_raised: 0, source: "manual",
    source_ref: null, notes: "Pago em 12/Mar", created_by: null,
    created_at: daysFrom(-60) + "T10:00:00Z",
  },
];

// ============================================================
// DEBTS — Dividas (DSJ tem que pagar)
// ============================================================
export const MOCK_DEBTS: Debt[] = [
  {
    id: 1, entity_id: "dsj_network", description: "Fatura CJ Dropshipping Mar/26",
    creditor: "CJ Dropshipping", amount_total: 28_400, amount_paid: 0,
    currency: "USD", issue_date: daysFrom(-10), due_date: daysFrom(20),
    interest_rate_pct: 0, status: "pending", category: "cost_products",
    source: "manual", notes: null, created_by: null,
    created_at: daysFrom(-10) + "T10:00:00Z",
  },
  {
    id: 2, entity_id: "dsj_network", description: "Salarios equipe Mar/26",
    creditor: "Folha de pagamento", amount_total: 22_000, amount_paid: 0,
    currency: "USD", issue_date: daysFrom(-2), due_date: daysFrom(3),
    interest_rate_pct: 0, status: "pending", category: "cost_team",
    source: "manual", notes: null, created_by: null,
    created_at: daysFrom(-2) + "T10:00:00Z",
  },
  {
    id: 3, entity_id: "universal_mkt", description: "Tributos UK Q1/26",
    creditor: "HMRC", amount_total: 8_900, amount_paid: 0,
    currency: "GBP", issue_date: daysFrom(-15), due_date: daysFrom(45),
    interest_rate_pct: 5, status: "pending", category: "cost_legal",
    source: "manual", notes: null, created_by: null,
    created_at: daysFrom(-15) + "T10:00:00Z",
  },
  {
    id: 4, entity_id: "dsj_connect", description: "Hosting AWS Mar/26",
    creditor: "Amazon Web Services", amount_total: 1_850, amount_paid: 1_850,
    currency: "USD", issue_date: daysFrom(-30), due_date: daysFrom(-5),
    interest_rate_pct: 0, status: "paid", category: "cost_infra",
    source: "manual", notes: null, created_by: null,
    created_at: daysFrom(-30) + "T10:00:00Z",
  },
];

// ============================================================
// FINANCINGS — Investidor financia recebivel
// ============================================================
export const MOCK_FINANCINGS: Financing[] = [
  {
    id: 1, receivable_id: 1, investor_id: 1,
    amount_invested: 5000, interest_rate_pct: 2.5, redemption_days: 14,
    expected_return: 5125, status: "active", contract_hash: "fin-abc123",
    contract_signed_at: daysFrom(-2) + "T10:00:00Z",
    confirmed_at: daysFrom(-2) + "T11:00:00Z",
    redemption_date: daysFrom(11), redeemed_at: null, actual_return: null,
    created_at: daysFrom(-2) + "T10:00:00Z",
  },
  {
    id: 2, receivable_id: 1, investor_id: 2,
    amount_invested: 2500, interest_rate_pct: 2.5, redemption_days: 14,
    expected_return: 2562.5, status: "active", contract_hash: "fin-def456",
    contract_signed_at: daysFrom(-1) + "T10:00:00Z",
    confirmed_at: daysFrom(-1) + "T11:00:00Z",
    redemption_date: daysFrom(11), redeemed_at: null, actual_return: null,
    created_at: daysFrom(-1) + "T10:00:00Z",
  },
];

// ============================================================
// RISK METRIC — Indice de risco atual
// ============================================================
export const MOCK_RISK_METRIC: RiskMetric = {
  id: 1, snapshot_date: daysFrom(0),
  cash_balance_usd: 274_500,
  receivables_pending: 76_500, receivables_overdue: 0,
  debts_pending: 60_300, debts_overdue: 0,
  daily_ad_spend: 4_200, monthly_revenue: 195_400, monthly_costs: 159_240,
  avg_days_to_receive: 22.5, avg_days_to_pay: 18.0,
  burn_rate: 159_240, runway_days: 51.7,
  cash_after_obligations: 290_700,
  risk_score: 32,
  risk_level: "medium",
  ai_analysis: "Posicao financeira saudavel mas com concentracao em payouts curtos. Risco principal: travamento de processador de pagamento (Stripe ou PayPal) por mais de 7 dias geraria deficit de caixa. Recomenda-se manter reserva de 30 dias de burn rate.",
  ai_recommendations: "1. Diversificar processadores: nao concentrar mais de 50% em um unico. 2. Reduzir concentracao em Meta Ads (atualmente 60% do gasto). 3. Negociar payout em D+1 com Shopify (atualmente D+3).",
  factors: {
    burn_to_cash_ratio: 0.58,
    receivables_concentration_top1: 0.59,
    overdue_pct: 0,
    ad_spend_pct_of_revenue: 0.65,
  },
  scenarios: {
    stripe_freeze_7d: { cash_impact: -29_400, runway_impact_days: -7 },
    stripe_freeze_30d: { cash_impact: -126_000, runway_impact_days: -30, risk_level: "critical" },
    revenue_drop_50pct: { cash_impact: -97_700, runway_impact_days: -15 },
  },
  generated_at: new Date().toISOString(),
};

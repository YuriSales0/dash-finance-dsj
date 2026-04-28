export type EntityId = "dsj_network" | "universal_mkt" | "dsj_connect" | "consolidated";

export type CategoryGroup = "revenue" | "cost_variable" | "cost_fixed" | "transfer" | "investment";

export type ClassifiedBy = "ai" | "human" | "rule";

export type InvestorStatus = "pending" | "approved" | "rejected" | "suspended";

export type OpportunityStatus = "draft" | "open" | "funded" | "active" | "completed" | "cancelled";

export type InvestmentStatus = "pending" | "confirmed" | "active" | "returned" | "partial_loss";

export type ApiProvider = "mercury" | "revolut" | "airwallex";

export interface Entity {
  id: EntityId;
  name: string;
  jurisdiction: string | null;
  currency_default: string;
}

export interface BankAccount {
  id: string;
  entity_id: EntityId;
  bank_name: string;
  currency: string;
  api_provider: ApiProvider;
  last_synced_at: string | null;
  balance_current: number;
  balance_available: number;
  active: boolean;
}

export interface Category {
  id: string;
  group_name: CategoryGroup;
  label: string;
  affects_pnl: boolean;
}

export interface Transaction {
  id: number;
  external_id: string | null;
  bank_account_id: string;
  entity_id: EntityId;
  timestamp: string;
  description: string | null;
  counterparty: string | null;
  amount_original: number;
  currency_original: string;
  amount_usd: number;
  fx_rate: number;
  category_id: string | null;
  is_intercompany: boolean;
  linked_transaction_id: number | null;
  counterpart_entity_id: EntityId | null;
  classified_by: ClassifiedBy | null;
  classification_confidence: number | null;
  needs_review: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClassificationRule {
  id: number;
  pattern_type: "counterparty" | "description" | "amount_range" | "combined";
  pattern_value: string;
  category_id: string;
  entity_id: EntityId | null;
  source: "manual" | "learned";
  times_applied: number;
  times_overridden: number;
  accuracy: number;
  active: boolean;
  created_at: string;
}

export interface MonthlyPnl {
  id: number;
  month: string;
  entity_id: EntityId;
  revenue: number;
  cost_ads: number;
  cost_products: number;
  cost_shipping: number;
  cost_gateway: number;
  cost_chargebacks: number;
  cost_refunds: number;
  cost_team: number;
  cost_saas: number;
  cost_infra: number;
  cost_legal: number;
  cost_other: number;
  total_costs: number;
  net_profit: number;
  margin_pct: number;
  pending_review_count: number;
  generated_at: string;
}

export interface Investor {
  id: number;
  name: string;
  cpf: string;
  email: string;
  phone: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  invite_code: string | null;
  invited_by: number | null;
  auth_user_id: string | null;
  status: InvestorStatus;
  approved_by: string | null;
  approved_at: string | null;
  total_invested: number;
  total_returned: number;
  created_at: string;
}

export interface Opportunity {
  id: number;
  title: string;
  description: string | null;
  product_name: string | null;
  target_amount: number;
  raised_amount: number;
  min_investment: number;
  duration_days: number;
  return_estimate_min: number | null;
  return_estimate_max: number | null;
  proven_roas: number | null;
  proven_margin: number | null;
  proven_sales: number | null;
  proven_chargeback_rate: number | null;
  allocation_ads_pct: number | null;
  allocation_products_pct: number | null;
  allocation_shipping_pct: number | null;
  allocation_reserve_pct: number | null;
  status: OpportunityStatus;
  risks_description: string | null;
  created_by: string | null;
  opened_at: string | null;
  funded_at: string | null;
  completed_at: string | null;
  actual_return_pct: number | null;
  created_at: string;
}

export interface Investment {
  id: number;
  investor_id: number;
  opportunity_id: number;
  amount: number;
  status: InvestmentStatus;
  contract_hash: string | null;
  contract_signed_at: string | null;
  confirmed_at: string | null;
  return_amount: number | null;
  return_pct: number | null;
  returned_at: string | null;
  created_at: string;
}

export interface InviteCode {
  code: string;
  created_by: string | null;
  used_by: number | null;
  used_at: string | null;
  active: boolean;
  created_at: string;
}

export interface InvestorMetrics {
  id: number;
  month: string;
  total_revenue_usd: number | null;
  margin_pct: number | null;
  active_operations: number | null;
  months_operating: number | null;
  opportunities_completed: number | null;
  opportunities_avg_return: number | null;
  opportunities_loss_count: number;
  total_capital_returned: number | null;
  visible: boolean;
  generated_at: string;
}

export interface OperationUpdate {
  id: number;
  opportunity_id: number;
  timestamp: string;
  revenue_generated: number | null;
  current_roas: number | null;
  current_margin: number | null;
  chargeback_rate: number | null;
  projected_return_pct: number | null;
  status_note: string | null;
  ai_status: string | null;
  visible_to_investor: boolean;
}

export type UserRole = "dsj" | "investor";

export interface UserRoleRow {
  user_id: string;
  role: UserRole;
  name: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export type ReceivableStatus = "pending" | "partial" | "paid" | "overdue" | "defaulted";

export interface Receivable {
  id: number;
  entity_id: EntityId;
  description: string;
  counterparty: string | null;
  amount_total: number;
  amount_received: number;
  currency: string;
  issue_date: string;
  due_date: string;
  status: ReceivableStatus;
  open_for_financing: boolean;
  financing_interest_rate_pct: number | null;
  financing_min_amount: number | null;
  financing_max_amount: number | null;
  financing_redemption_days: number | null;
  financing_terms: string | null;
  financing_raised: number;
  source: "manual" | "transaction" | "shopify" | "gateway";
  source_ref: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type DebtStatus = "pending" | "partial" | "paid" | "overdue";

export interface Debt {
  id: number;
  entity_id: EntityId;
  description: string;
  creditor: string | null;
  amount_total: number;
  amount_paid: number;
  currency: string;
  issue_date: string;
  due_date: string;
  interest_rate_pct: number | null;
  status: DebtStatus;
  category: string | null;
  source: "manual" | "transaction" | "supplier";
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type FinancingStatus = "pending" | "active" | "redeemed" | "defaulted" | "cancelled";

export interface Financing {
  id: number;
  receivable_id: number;
  investor_id: number;
  amount_invested: number;
  interest_rate_pct: number;
  redemption_days: number;
  expected_return: number;
  status: FinancingStatus;
  contract_hash: string | null;
  contract_signed_at: string | null;
  confirmed_at: string | null;
  redemption_date: string | null;
  redeemed_at: string | null;
  actual_return: number | null;
  created_at: string;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskMetric {
  id: number;
  snapshot_date: string;
  cash_balance_usd: number | null;
  receivables_pending: number | null;
  receivables_overdue: number | null;
  debts_pending: number | null;
  debts_overdue: number | null;
  daily_ad_spend: number | null;
  monthly_revenue: number | null;
  monthly_costs: number | null;
  avg_days_to_receive: number | null;
  avg_days_to_pay: number | null;
  burn_rate: number | null;
  runway_days: number | null;
  cash_after_obligations: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  ai_analysis: string | null;
  ai_recommendations: string | null;
  factors: Record<string, unknown> | null;
  scenarios: Record<string, unknown> | null;
  generated_at: string;
}

// Supabase Database type (para tipagem do client)
export interface Database {
  public: {
    Tables: {
      entities: { Row: Entity };
      bank_accounts: { Row: BankAccount };
      categories: { Row: Category };
      transactions: { Row: Transaction };
      classification_rules: { Row: ClassificationRule };
      monthly_pnl: { Row: MonthlyPnl };
      investors: { Row: Investor };
      opportunities: { Row: Opportunity };
      investments: { Row: Investment };
      invite_codes: { Row: InviteCode };
      investor_metrics: { Row: InvestorMetrics };
      operation_updates: { Row: OperationUpdate };
    };
  };
}

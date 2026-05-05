export type EntityId = string;

export type CategoryGroup = "revenue" | "cost_variable" | "cost_fixed" | "transfer" | "investment";

export type ClassifiedBy = "ai" | "human" | "rule";

export type InvestorStatus = "pending" | "approved" | "rejected" | "suspended";

export type OpportunityStatus = "draft" | "open" | "funded" | "active" | "completed" | "cancelled";

export type InvestmentStatus = "pending" | "confirmed" | "active" | "returned" | "partial_loss";

export type ApiProvider = "mercury" | "revolut" | "airwallex" | "manual" | string;

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
  manual_balance?: boolean;
  balance_updated_at?: string | null;
  balance_notes?: string | null;
  opening_balance?: number | null;
  opening_balance_date?: string | null;
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
  import_batch_id?: number | null;
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

// Variacao de caixa por mes (consolidado, USD)
// Decompoe o cash_delta em: P&L + intercompany + transfers + uncategorized + investments
export interface MonthlyCashflow {
  month: string;             // YYYY-MM-01
  cash_delta: number;        // soma de TODAS amount_usd no mes
  revenue_flow: number;      // categorias revenue_*
  cost_flow: number;         // categorias cost_* (negativo)
  intercompany_flow: number; // is_intercompany = true
  transfer_flow: number;     // categorias transfer_* (interbank, fx) — sem intercompany
  uncategorized_flow: number;// category_id IS NULL
  investment_flow: number;   // categorias investment_*
  count: number;
}

// Cashflow segmentado por moeda (pra visao por moeda)
export interface MonthlyCashflowByCurrency extends MonthlyCashflow {
  currency: string;
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
  receivable_id: number | null;
  investor_name: string | null;
  investor_email: string | null;
  message: string | null;
  created_at: string;
}

export interface PlatformSetting {
  key: string;
  value: string;
  updated_at: string;
}

export interface RevolutCredential {
  id: number;
  bank_account_id: string;
  client_id: string;
  issuer: string;
  private_key: string;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  revolut_account_id: string | null;
  sandbox: boolean;
  last_sync_at: string | null;
  last_sync_count: number | null;
  last_sync_error: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RevolutOauthState {
  state: string;
  bank_account_id: string;
  expires_at: string;
  created_at: string;
}

export interface ImportBatch {
  id: number;
  bank_account_id: string;
  entity_id: EntityId;
  format: string;
  file_name: string | null;
  total_rows: number | null;
  rows_normalized: number | null;
  rows_imported: number | null;
  rows_skipped_duplicates: number | null;
  rows_needs_review: number | null;
  pnl_months_regenerated: string[] | null;
  intercompany_detected: number | null;
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
  fixed_commission?: number;
  iof_pct?: number;
  is_recurring?: boolean;
  recurrence_interval?: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | null;
  recurrence_end_date?: string | null;
  interest_payment_interval?: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | null;
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
  contract_text: string | null;
  contract_accepted_at: string | null;
  contract_ip: string | null;
  created_at: string;
}

export type PaymentStatus = "scheduled" | "paid" | "overdue" | "cancelled";

export interface PaymentScheduleItem {
  id: number;
  financing_id: number;
  installment_number: number;
  due_date: string;
  amount_principal: number;
  amount_interest: number;
  amount_total: number;
  status: PaymentStatus;
  paid_at: string | null;
  paid_amount: number | null;
  payment_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvestorStatement {
  id: number;
  financing_id: number;
  investor_id: number;
  period_start: string;
  period_end: string;
  opening_balance: number;
  total_received: number;
  total_interest: number;
  closing_balance: number;
  payments: Record<string, unknown>[] | null;
  status: "draft" | "sent" | "viewed";
  generated_at: string;
  sent_at: string | null;
  viewed_at: string | null;
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
      user_roles: { Row: UserRoleRow };
      receivables: { Row: Receivable };
      debts: { Row: Debt };
      financings: { Row: Financing };
      risk_metrics: { Row: RiskMetric };
      payment_schedule: { Row: PaymentScheduleItem };
      investor_statements: { Row: InvestorStatement };
      platform_settings: { Row: PlatformSetting };
      revolut_credentials: { Row: RevolutCredential };
      revolut_oauth_state: { Row: RevolutOauthState };
      import_batches: { Row: ImportBatch };
    };
  };
}

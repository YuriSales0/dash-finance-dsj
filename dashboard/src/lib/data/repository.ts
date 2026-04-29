import type {
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
import {
  MOCK_BANK_ACCOUNTS,
  MOCK_TRANSACTIONS,
  MOCK_MONTHLY_PNL,
  MOCK_INVESTORS,
  MOCK_OPPORTUNITIES,
  MOCK_INVESTMENTS,
  MOCK_INVESTOR_METRICS,
  MOCK_RECEIVABLES,
  MOCK_DEBTS,
  MOCK_FINANCINGS,
  MOCK_RISK_METRIC,
} from "./mock";

// ============================================================
// Repository: abstracao de dados
// DEMO_MODE=true (default): usa mock data
// DEMO_MODE=false: usa Supabase real
// ============================================================

const DEMO_MODE = process.env.DEMO_MODE?.toLowerCase() !== "false";

export interface Repository {
  getBankAccounts(): Promise<BankAccount[]>;
  getTransactions(filters?: {
    entity_id?: EntityId;
    bank_account_id?: string;
    needs_review?: boolean;
    search?: string;
    limit?: number;
  }): Promise<Transaction[]>;
  updateTransactionCategory(
    id: number,
    category_id: string,
    reviewed_by: string
  ): Promise<void>;
  getMonthlyPnl(filters?: {
    entity_id?: EntityId;
    months?: number;
  }): Promise<MonthlyPnl[]>;
  getInvestors(): Promise<Investor[]>;
  getOpportunities(): Promise<Opportunity[]>;
  getInvestments(filters?: { investor_id?: number; opportunity_id?: number }): Promise<Investment[]>;
  getInvestorMetrics(): Promise<InvestorMetrics>;

  // Recebiveis
  getReceivables(filters?: {
    entity_id?: EntityId;
    open_for_financing?: boolean;
    status?: string;
  }): Promise<Receivable[]>;
  createReceivable(data: Partial<Receivable>): Promise<Receivable>;
  updateReceivable(id: number, data: Partial<Receivable>): Promise<void>;

  // Dividas
  getDebts(filters?: { entity_id?: EntityId; status?: string }): Promise<Debt[]>;
  createDebt(data: Partial<Debt>): Promise<Debt>;
  updateDebt(id: number, data: Partial<Debt>): Promise<void>;

  // Financiamentos
  getFinancings(filters?: { investor_id?: number; receivable_id?: number }): Promise<Financing[]>;
  createFinancing(data: Partial<Financing>): Promise<Financing>;

  // Risco
  getLatestRiskMetric(): Promise<RiskMetric | null>;
  saveRiskMetric(data: Partial<RiskMetric>): Promise<void>;
}

// ============================================================
// Mock Repository (demo)
// ============================================================

class MockRepository implements Repository {
  async getBankAccounts() {
    return MOCK_BANK_ACCOUNTS;
  }

  async getTransactions(filters: {
    entity_id?: EntityId;
    bank_account_id?: string;
    needs_review?: boolean;
    search?: string;
    limit?: number;
  } = {}) {
    let txs = [...MOCK_TRANSACTIONS];
    if (filters.entity_id) txs = txs.filter((t) => t.entity_id === filters.entity_id);
    if (filters.bank_account_id) txs = txs.filter((t) => t.bank_account_id === filters.bank_account_id);
    if (filters.needs_review !== undefined) txs = txs.filter((t) => t.needs_review === filters.needs_review);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      txs = txs.filter(
        (t) =>
          t.counterparty?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }
    if (filters.limit) txs = txs.slice(0, filters.limit);
    return txs;
  }

  async updateTransactionCategory(id: number, category_id: string, reviewed_by: string) {
    const tx = MOCK_TRANSACTIONS.find((t) => t.id === id);
    if (tx) {
      tx.category_id = category_id;
      tx.classified_by = "human";
      tx.classification_confidence = 100;
      tx.needs_review = false;
      tx.reviewed_by = reviewed_by;
      tx.reviewed_at = new Date().toISOString();
    }
  }

  async getMonthlyPnl(filters: { entity_id?: EntityId; months?: number } = {}) {
    let pnl = [...MOCK_MONTHLY_PNL];
    if (filters.entity_id) pnl = pnl.filter((p) => p.entity_id === filters.entity_id);
    if (filters.months) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - filters.months);
      pnl = pnl.filter((p) => new Date(p.month) >= cutoff);
    }
    return pnl.sort((a, b) => a.month.localeCompare(b.month));
  }

  async getInvestors() { return MOCK_INVESTORS; }
  async getOpportunities() { return MOCK_OPPORTUNITIES; }
  async getInvestments(filters: { investor_id?: number; opportunity_id?: number } = {}) {
    let inv = [...MOCK_INVESTMENTS];
    if (filters.investor_id) inv = inv.filter((i) => i.investor_id === filters.investor_id);
    if (filters.opportunity_id) inv = inv.filter((i) => i.opportunity_id === filters.opportunity_id);
    return inv;
  }
  async getInvestorMetrics() { return MOCK_INVESTOR_METRICS; }

  async getReceivables(filters: { entity_id?: EntityId; open_for_financing?: boolean; status?: string } = {}) {
    let r = [...MOCK_RECEIVABLES];
    if (filters.entity_id) r = r.filter((x) => x.entity_id === filters.entity_id);
    if (filters.open_for_financing !== undefined) r = r.filter((x) => x.open_for_financing === filters.open_for_financing);
    if (filters.status) r = r.filter((x) => x.status === filters.status);
    return r.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }
  async createReceivable(data: Partial<Receivable>): Promise<Receivable> {
    const newReceivable: Receivable = {
      id: MOCK_RECEIVABLES.length + 1,
      entity_id: (data.entity_id || "dsj_network") as EntityId,
      description: data.description || "",
      counterparty: data.counterparty || null,
      amount_total: data.amount_total || 0,
      amount_received: 0,
      currency: data.currency || "USD",
      issue_date: data.issue_date || new Date().toISOString().slice(0, 10),
      due_date: data.due_date || new Date().toISOString().slice(0, 10),
      status: "pending",
      open_for_financing: data.open_for_financing || false,
      financing_interest_rate_pct: data.financing_interest_rate_pct ?? null,
      financing_min_amount: data.financing_min_amount ?? null,
      financing_max_amount: data.financing_max_amount ?? null,
      financing_redemption_days: data.financing_redemption_days ?? null,
      financing_terms: data.financing_terms || null,
      financing_raised: 0,
      source: "manual",
      source_ref: null,
      notes: data.notes || null,
      created_by: null,
      created_at: new Date().toISOString(),
    };
    MOCK_RECEIVABLES.push(newReceivable);
    return newReceivable;
  }
  async updateReceivable(id: number, data: Partial<Receivable>) {
    const r = MOCK_RECEIVABLES.find((x) => x.id === id);
    if (r) Object.assign(r, data);
  }

  async getDebts(filters: { entity_id?: EntityId; status?: string } = {}) {
    let d = [...MOCK_DEBTS];
    if (filters.entity_id) d = d.filter((x) => x.entity_id === filters.entity_id);
    if (filters.status) d = d.filter((x) => x.status === filters.status);
    return d.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }
  async createDebt(data: Partial<Debt>): Promise<Debt> {
    const newDebt: Debt = {
      id: MOCK_DEBTS.length + 1,
      entity_id: (data.entity_id || "dsj_network") as EntityId,
      description: data.description || "",
      creditor: data.creditor || null,
      amount_total: data.amount_total || 0,
      amount_paid: 0,
      currency: data.currency || "USD",
      issue_date: data.issue_date || new Date().toISOString().slice(0, 10),
      due_date: data.due_date || new Date().toISOString().slice(0, 10),
      interest_rate_pct: data.interest_rate_pct ?? null,
      status: "pending",
      category: data.category || null,
      source: "manual",
      notes: data.notes || null,
      created_by: null,
      created_at: new Date().toISOString(),
    };
    MOCK_DEBTS.push(newDebt);
    return newDebt;
  }
  async updateDebt(id: number, data: Partial<Debt>) {
    const d = MOCK_DEBTS.find((x) => x.id === id);
    if (d) Object.assign(d, data);
  }

  async getFinancings(filters: { investor_id?: number; receivable_id?: number } = {}) {
    let f = [...MOCK_FINANCINGS];
    if (filters.investor_id) f = f.filter((x) => x.investor_id === filters.investor_id);
    if (filters.receivable_id) f = f.filter((x) => x.receivable_id === filters.receivable_id);
    return f;
  }
  async createFinancing(data: Partial<Financing>): Promise<Financing> {
    const newFin: Financing = {
      id: MOCK_FINANCINGS.length + 1,
      receivable_id: data.receivable_id!,
      investor_id: data.investor_id!,
      amount_invested: data.amount_invested!,
      interest_rate_pct: data.interest_rate_pct!,
      redemption_days: data.redemption_days!,
      expected_return: data.expected_return!,
      status: "pending",
      contract_hash: null,
      contract_signed_at: null,
      confirmed_at: null,
      redemption_date: null,
      redeemed_at: null,
      actual_return: null,
      created_at: new Date().toISOString(),
    };
    MOCK_FINANCINGS.push(newFin);
    return newFin;
  }

  async getLatestRiskMetric() {
    return MOCK_RISK_METRIC;
  }
  async saveRiskMetric() {
    /* no-op em demo */
  }
}

// ============================================================
// Supabase Repository (real)
// ============================================================

import { createServerClient } from "@/lib/supabase/server";

class SupabaseRepository implements Repository {
  private get db() {
    return createServerClient();
  }

  async getBankAccounts(): Promise<BankAccount[]> {
    const { data, error } = await this.db
      .from("bank_accounts")
      .select("*")
      .eq("active", true)
      .order("entity_id");
    if (error) throw error;
    return (data || []) as BankAccount[];
  }

  async getTransactions(filters: {
    entity_id?: EntityId;
    bank_account_id?: string;
    needs_review?: boolean;
    search?: string;
    limit?: number;
  } = {}): Promise<Transaction[]> {
    let query = this.db
      .from("transactions")
      .select("*")
      .order("timestamp", { ascending: false });

    if (filters.entity_id) query = query.eq("entity_id", filters.entity_id);
    if (filters.bank_account_id) query = query.eq("bank_account_id", filters.bank_account_id);
    if (filters.needs_review !== undefined) query = query.eq("needs_review", filters.needs_review);
    if (filters.search) {
      query = query.or(
        `counterparty.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Transaction[];
  }

  async updateTransactionCategory(
    id: number,
    category_id: string,
    reviewed_by: string
  ): Promise<void> {
    const { error } = await this.db
      .from("transactions")
      .update({
        category_id,
        classified_by: "human",
        classification_confidence: 100,
        needs_review: false,
        reviewed_by,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async getMonthlyPnl(filters: {
    entity_id?: EntityId;
    months?: number;
  } = {}): Promise<MonthlyPnl[]> {
    let query = this.db
      .from("monthly_pnl")
      .select("*")
      .order("month", { ascending: true });

    if (filters.entity_id) query = query.eq("entity_id", filters.entity_id);
    if (filters.months) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - filters.months);
      query = query.gte("month", cutoff.toISOString().slice(0, 10));
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as MonthlyPnl[];
  }

  async getInvestors(): Promise<Investor[]> {
    const { data, error } = await this.db
      .from("investors")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Investor[];
  }

  async getOpportunities(): Promise<Opportunity[]> {
    const { data, error } = await this.db
      .from("opportunities")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Opportunity[];
  }

  async getInvestments(filters: {
    investor_id?: number;
    opportunity_id?: number;
  } = {}): Promise<Investment[]> {
    let query = this.db
      .from("investments")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.investor_id) query = query.eq("investor_id", filters.investor_id);
    if (filters.opportunity_id) query = query.eq("opportunity_id", filters.opportunity_id);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Investment[];
  }

  async getInvestorMetrics(): Promise<InvestorMetrics> {
    const { data, error } = await this.db
      .from("investor_metrics")
      .select("*")
      .eq("visible", true)
      .order("month", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    // Fallback se nao tem dados ainda
    if (!data) {
      return {
        id: 0,
        month: new Date().toISOString().slice(0, 10),
        total_revenue_usd: 0,
        margin_pct: 0,
        active_operations: 0,
        months_operating: 0,
        opportunities_completed: 0,
        opportunities_avg_return: 0,
        opportunities_loss_count: 0,
        total_capital_returned: 0,
        visible: true,
        generated_at: new Date().toISOString(),
      };
    }

    return data as InvestorMetrics;
  }

  async getReceivables(filters: { entity_id?: EntityId; open_for_financing?: boolean; status?: string } = {}): Promise<Receivable[]> {
    let q = this.db.from("receivables").select("*").order("due_date");
    if (filters.entity_id) q = q.eq("entity_id", filters.entity_id);
    if (filters.open_for_financing !== undefined) q = q.eq("open_for_financing", filters.open_for_financing);
    if (filters.status) q = q.eq("status", filters.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as Receivable[];
  }

  async createReceivable(data: Partial<Receivable>): Promise<Receivable> {
    const { data: row, error } = await this.db.from("receivables").insert(data).select().single();
    if (error) throw error;
    return row as Receivable;
  }

  async updateReceivable(id: number, data: Partial<Receivable>) {
    const { error } = await this.db.from("receivables").update(data).eq("id", id);
    if (error) throw error;
  }

  async getDebts(filters: { entity_id?: EntityId; status?: string } = {}): Promise<Debt[]> {
    let q = this.db.from("debts").select("*").order("due_date");
    if (filters.entity_id) q = q.eq("entity_id", filters.entity_id);
    if (filters.status) q = q.eq("status", filters.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as Debt[];
  }

  async createDebt(data: Partial<Debt>): Promise<Debt> {
    const { data: row, error } = await this.db.from("debts").insert(data).select().single();
    if (error) throw error;
    return row as Debt;
  }

  async updateDebt(id: number, data: Partial<Debt>) {
    const { error } = await this.db.from("debts").update(data).eq("id", id);
    if (error) throw error;
  }

  async getFinancings(filters: { investor_id?: number; receivable_id?: number } = {}): Promise<Financing[]> {
    let q = this.db.from("financings").select("*").order("created_at", { ascending: false });
    if (filters.investor_id) q = q.eq("investor_id", filters.investor_id);
    if (filters.receivable_id) q = q.eq("receivable_id", filters.receivable_id);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as Financing[];
  }

  async createFinancing(data: Partial<Financing>): Promise<Financing> {
    const { data: row, error } = await this.db.from("financings").insert(data).select().single();
    if (error) throw error;
    return row as Financing;
  }

  async getLatestRiskMetric(): Promise<RiskMetric | null> {
    const { data, error } = await this.db
      .from("risk_metrics")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return (data as RiskMetric) || null;
  }

  async saveRiskMetric(data: Partial<RiskMetric>) {
    const { error } = await this.db.from("risk_metrics").upsert(data, {
      onConflict: "snapshot_date",
    });
    if (error) throw error;
  }
}

export const repository: Repository = DEMO_MODE
  ? new MockRepository()
  : new SupabaseRepository();

export const isDemoMode = DEMO_MODE;

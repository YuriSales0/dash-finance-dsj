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
import {
  MOCK_BANK_ACCOUNTS,
  MOCK_TRANSACTIONS,
  MOCK_MONTHLY_PNL,
  MOCK_INVESTORS,
  MOCK_OPPORTUNITIES,
  MOCK_INVESTMENTS,
  MOCK_INVESTOR_METRICS,
} from "./mock";

// ============================================================
// Repository: abstracao de dados
// DEMO_MODE=true (default): usa mock data
// DEMO_MODE=false: usa Supabase real
// ============================================================

const DEMO_MODE = process.env.DEMO_MODE !== "false";

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
}

export const repository: Repository = DEMO_MODE
  ? new MockRepository()
  : new SupabaseRepository();

export const isDemoMode = DEMO_MODE;

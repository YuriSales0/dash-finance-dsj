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
// DEMO_MODE=false: usa Supabase real (a implementar)
// ============================================================

const DEMO_MODE = process.env.DEMO_MODE !== "false";

export interface Repository {
  // Contas
  getBankAccounts(): Promise<BankAccount[]>;

  // Transacoes
  getTransactions(filters?: {
    entity_id?: EntityId;
    bank_account_id?: string;
    needs_review?: boolean;
    limit?: number;
  }): Promise<Transaction[]>;
  updateTransactionCategory(
    id: number,
    category_id: string,
    reviewed_by: string
  ): Promise<void>;

  // P&L
  getMonthlyPnl(filters?: {
    entity_id?: EntityId;
    months?: number;
  }): Promise<MonthlyPnl[]>;

  // Investidores / SCP
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
    limit?: number;
  } = {}) {
    let txs = [...MOCK_TRANSACTIONS];
    if (filters.entity_id) txs = txs.filter((t) => t.entity_id === filters.entity_id);
    if (filters.bank_account_id) txs = txs.filter((t) => t.bank_account_id === filters.bank_account_id);
    if (filters.needs_review !== undefined) txs = txs.filter((t) => t.needs_review === filters.needs_review);
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

  async getInvestors() {
    return MOCK_INVESTORS;
  }

  async getOpportunities() {
    return MOCK_OPPORTUNITIES;
  }

  async getInvestments(filters: { investor_id?: number; opportunity_id?: number } = {}) {
    let inv = [...MOCK_INVESTMENTS];
    if (filters.investor_id) inv = inv.filter((i) => i.investor_id === filters.investor_id);
    if (filters.opportunity_id) inv = inv.filter((i) => i.opportunity_id === filters.opportunity_id);
    return inv;
  }

  async getInvestorMetrics() {
    return MOCK_INVESTOR_METRICS;
  }
}

// ============================================================
// Supabase Repository (real, a implementar)
// ============================================================

class SupabaseRepository implements Repository {
  async getBankAccounts(): Promise<BankAccount[]> {
    throw new Error("SupabaseRepository.getBankAccounts: nao implementado. Setar DEMO_MODE=true ou implementar.");
  }
  async getTransactions(): Promise<Transaction[]> { throw new Error("not implemented"); }
  async updateTransactionCategory(): Promise<void> { throw new Error("not implemented"); }
  async getMonthlyPnl(): Promise<MonthlyPnl[]> { throw new Error("not implemented"); }
  async getInvestors(): Promise<Investor[]> { throw new Error("not implemented"); }
  async getOpportunities(): Promise<Opportunity[]> { throw new Error("not implemented"); }
  async getInvestments(): Promise<Investment[]> { throw new Error("not implemented"); }
  async getInvestorMetrics(): Promise<InvestorMetrics> { throw new Error("not implemented"); }
}

export const repository: Repository = DEMO_MODE
  ? new MockRepository()
  : new SupabaseRepository();

export const isDemoMode = DEMO_MODE;

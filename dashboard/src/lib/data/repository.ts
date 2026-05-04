import type {
  Entity,
  BankAccount,
  Transaction,
  MonthlyPnl,
  MonthlyCashflow,
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
  MOCK_ENTITIES,
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
  // Empresas
  getEntities(): Promise<Entity[]>;
  createEntity(data: Partial<Entity>): Promise<Entity>;
  deleteEntity(id: string): Promise<void>;

  // Contas bancarias
  getBankAccounts(): Promise<BankAccount[]>;
  createBankAccount(data: Partial<BankAccount>): Promise<BankAccount>;
  updateBankAccount(id: string, data: Partial<BankAccount>): Promise<void>;
  deleteBankAccount(id: string): Promise<void>;
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
  getMonthlyCashflow(months?: number): Promise<MonthlyCashflow[]>;
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
  async getEntities() {
    return MOCK_ENTITIES;
  }
  async createEntity(data: Partial<Entity>): Promise<Entity> {
    const e: Entity = {
      id: data.id || data.name?.toLowerCase().replace(/\s+/g, "_").slice(0, 30) || "new",
      name: data.name || "",
      jurisdiction: data.jurisdiction || null,
      currency_default: data.currency_default || "USD",
    };
    MOCK_ENTITIES.push(e);
    return e;
  }
  async deleteEntity(id: string) {
    const idx = MOCK_ENTITIES.findIndex((e) => e.id === id);
    if (idx >= 0) MOCK_ENTITIES.splice(idx, 1);
  }

  async getBankAccounts() {
    return MOCK_BANK_ACCOUNTS.filter((a) => a.active);
  }
  async createBankAccount(data: Partial<BankAccount>): Promise<BankAccount> {
    const currency = (data.currency || "USD").toLowerCase();
    const id = data.id || `${data.entity_id}_${data.bank_name?.toLowerCase().replace(/\s+/g, "_")}_${currency}`;
    // Reativa se ja existe
    const existing = MOCK_BANK_ACCOUNTS.find((x) => x.id === id);
    if (existing) {
      Object.assign(existing, {
        active: true,
        balance_current: data.balance_current || 0,
        balance_available: data.balance_available || 0,
      });
      return existing;
    }
    const a: BankAccount = {
      id,
      entity_id: (data.entity_id || "dsj_network") as EntityId,
      bank_name: data.bank_name || "",
      currency: data.currency || "USD",
      api_provider: data.api_provider || "manual",
      last_synced_at: null,
      balance_current: data.balance_current || 0,
      balance_available: data.balance_available || 0,
      active: true,
    };
    MOCK_BANK_ACCOUNTS.push(a);
    return a;
  }
  async updateBankAccount(id: string, data: Partial<BankAccount>) {
    const a = MOCK_BANK_ACCOUNTS.find((x) => x.id === id);
    if (a) Object.assign(a, data);
  }
  async deleteBankAccount(id: string) {
    const a = MOCK_BANK_ACCOUNTS.find((x) => x.id === id);
    if (a) a.active = false;
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

  async getMonthlyCashflow(_months?: number): Promise<MonthlyCashflow[]> {
    return [];
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
      contract_text: null,
      contract_accepted_at: null,
      contract_ip: null,
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

  async getEntities(): Promise<Entity[]> {
    const { data, error } = await this.db.from("entities").select("*").neq("id", "consolidated").order("name");
    if (error) throw error;
    return (data || []) as Entity[];
  }

  async createEntity(d: Partial<Entity>): Promise<Entity> {
    const id = d.id || d.name?.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30) || "new";
    const { data, error } = await this.db.from("entities").insert({ id, ...d }).select().single();
    if (error) throw error;
    return data as Entity;
  }

  async deleteEntity(id: string) {
    const { error } = await this.db.from("entities").delete().eq("id", id);
    if (error) throw error;
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

  async createBankAccount(d: Partial<BankAccount>): Promise<BankAccount> {
    const currency = (d.currency || "USD").toLowerCase();
    const baseId = d.id || `${d.entity_id}_${(d.bank_name || "bank").toLowerCase().replace(/\s+/g, "_")}_${currency}`;

    // Verificar se ja existe (incluindo desativada). Se sim, reativa em vez de tentar criar.
    const { data: existing } = await this.db
      .from("bank_accounts")
      .select("*")
      .eq("id", baseId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await this.db
        .from("bank_accounts")
        .update({
          active: true,
          balance_current: d.balance_current || 0,
          balance_available: d.balance_available || 0,
          api_provider: d.api_provider || (existing as any).api_provider || "manual",
        })
        .eq("id", baseId)
        .select()
        .single();
      if (error) throw error;
      return data as BankAccount;
    }

    const initialBalance = d.balance_current || 0;
    const { data, error } = await this.db.from("bank_accounts").insert({
      id: baseId,
      entity_id: d.entity_id,
      bank_name: d.bank_name,
      currency: d.currency || "USD",
      api_provider: d.api_provider || "manual",
      balance_current: initialBalance,
      balance_available: initialBalance,
      manual_balance: true,
    }).select().single();
    if (error) throw error;
    return data as BankAccount;
  }

  async updateBankAccount(id: string, d: Partial<BankAccount>) {
    const { error } = await this.db.from("bank_accounts").update(d).eq("id", id);
    if (error) throw error;
  }

  async deleteBankAccount(id: string) {
    const { error } = await this.db.from("bank_accounts").update({ active: false }).eq("id", id);
    if (error) throw error;
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

  async getMonthlyCashflow(months: number = 24): Promise<MonthlyCashflow[]> {
    // Janela: ultimos N meses
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString();

    // Pagina pra evitar limite default de 1000 linhas
    const all: Array<{
      timestamp: string;
      amount_usd: number;
      category_id: string | null;
      is_intercompany: boolean;
    }> = [];
    const pageSize = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await this.db
        .from("transactions")
        .select("timestamp, amount_usd, category_id, is_intercompany")
        .gte("timestamp", cutoffStr)
        .order("timestamp", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw error;
      const batch = (data || []) as any[];
      all.push(...batch);
      if (batch.length < pageSize) break;
      page++;
      if (page > 50) break; // hard cap 50k
    }

    // Agrupar por mes (YYYY-MM-01)
    const buckets: Record<string, MonthlyCashflow> = {};
    for (const t of all) {
      const d = new Date(t.timestamp);
      const monthKey = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
      if (!buckets[monthKey]) {
        buckets[monthKey] = {
          month: monthKey,
          cash_delta: 0,
          revenue_flow: 0,
          cost_flow: 0,
          intercompany_flow: 0,
          transfer_flow: 0,
          uncategorized_flow: 0,
          investment_flow: 0,
          count: 0,
        };
      }
      const b = buckets[monthKey];
      const amt = Number(t.amount_usd || 0);
      b.cash_delta += amt;
      b.count++;

      if (t.is_intercompany) {
        b.intercompany_flow += amt;
      } else if (!t.category_id) {
        b.uncategorized_flow += amt;
      } else if (t.category_id.startsWith("revenue")) {
        b.revenue_flow += amt;
      } else if (t.category_id.startsWith("cost")) {
        b.cost_flow += amt;
      } else if (t.category_id.startsWith("transfer")) {
        b.transfer_flow += amt;
      } else if (t.category_id.startsWith("investment")) {
        b.investment_flow += amt;
      }
    }

    return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
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

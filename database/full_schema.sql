-- CONSOLIDATED SCHEMA (generated from migrations 001-025 + audit fixes)
-- Last updated: 2026-05-04
-- DO NOT EDIT — regenerate from migrations

-- ============================================================
-- 001: ENTITIES
-- ============================================================

CREATE TABLE entities (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    jurisdiction VARCHAR(100),
    currency_default VARCHAR(3) NOT NULL
);

INSERT INTO entities VALUES
('dsj_network', 'DSJ Network LLC', 'Florida, USA', 'USD'),
('universal_mkt', 'Universal MKT LLP', 'London, UK', 'GBP'),
('dsj_connect', 'DSJ Connect LLC', 'Delaware, USA', 'USD'),
('consolidated', 'Consolidated', NULL, 'USD');

-- ============================================================
-- 001 + 012 + 021: BANK ACCOUNTS
-- Includes: manual_balance, balance_updated_at, balance_notes (012)
--           api_provider nullable with default 'manual' (012)
--           opening_balance, opening_balance_date (021)
-- ============================================================

CREATE TABLE bank_accounts (
    id VARCHAR(50) PRIMARY KEY,
    entity_id VARCHAR(30) NOT NULL REFERENCES entities(id),
    bank_name VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    api_provider VARCHAR(20) DEFAULT 'manual',
    last_synced_at TIMESTAMPTZ,
    balance_current DECIMAL(15,2) DEFAULT 0,
    balance_available DECIMAL(15,2) DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    manual_balance BOOLEAN DEFAULT FALSE,
    balance_updated_at TIMESTAMPTZ,
    balance_notes TEXT,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    opening_balance_date DATE
);

INSERT INTO bank_accounts (id, entity_id, bank_name, currency, api_provider, active, balance_current, balance_available, manual_balance) VALUES
('dsj_net_mercury', 'dsj_network', 'Mercury', 'USD', 'mercury', FALSE, 0, 0, FALSE),
('dsj_net_revolut', 'dsj_network', 'Revolut', 'USD', 'revolut', TRUE, 0, 0, TRUE),
('uni_mkt_airwallex', 'universal_mkt', 'Airwallex', 'GBP', 'airwallex', TRUE, 0, 0, TRUE),
('uni_mkt_revolut', 'universal_mkt', 'Revolut', 'GBP', 'revolut', TRUE, 0, 0, TRUE),
('dsj_con_mercury', 'dsj_connect', 'Mercury', 'USD', 'mercury', FALSE, 0, 0, FALSE);

-- ============================================================
-- 002: CATEGORIES
-- ============================================================

CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    group_name VARCHAR(20) NOT NULL CHECK (group_name IN ('revenue', 'cost_variable', 'cost_fixed', 'transfer', 'investment')),
    label VARCHAR(100) NOT NULL,
    affects_pnl BOOLEAN NOT NULL DEFAULT TRUE
);

-- Receitas
INSERT INTO categories VALUES
('revenue_shopify', 'revenue', 'Vendas Shopify (payouts)', TRUE),
('revenue_other', 'revenue', 'Outras receitas', TRUE);

-- Custos variaveis
INSERT INTO categories VALUES
('cost_ads_meta', 'cost_variable', 'Meta Ads', TRUE),
('cost_ads_tiktok', 'cost_variable', 'TikTok Ads', TRUE),
('cost_ads_google', 'cost_variable', 'Google Ads', TRUE),
('cost_products', 'cost_variable', 'Custo produto (fornecedores)', TRUE),
('cost_shipping', 'cost_variable', 'Frete + embalagem', TRUE),
('cost_gateway', 'cost_variable', 'Taxas gateway/processador', TRUE),
('cost_chargebacks', 'cost_variable', 'Chargebacks', TRUE),
('cost_refunds', 'cost_variable', 'Reembolsos', TRUE);

-- Custos fixos
INSERT INTO categories VALUES
('cost_team', 'cost_fixed', 'Team (salarios, freelancers)', TRUE),
('cost_saas', 'cost_fixed', 'SaaS (Shopify, MSync, ferramentas)', TRUE),
('cost_infra', 'cost_fixed', 'Infraestrutura (hosting, dominios)', TRUE),
('cost_legal', 'cost_fixed', 'Legal + contabilidade', TRUE),
('cost_office', 'cost_fixed', 'Escritorio + operacional', TRUE);

-- Transferencias (nao afetam P&L)
INSERT INTO categories VALUES
('transfer_intercompany', 'transfer', 'Transferencia entre empresas', FALSE),
('transfer_interbank', 'transfer', 'Transferencia entre bancos (mesma empresa)', FALSE),
('transfer_fx', 'transfer', 'Cambio (conversao de moeda)', FALSE);

-- Investimento (nao afetam P&L)
INSERT INTO categories VALUES
('investment_scp_in', 'investment', 'Aporte investidor SCP', FALSE),
('investment_scp_out', 'investment', 'Retorno investidor SCP', FALSE);

-- ============================================================
-- 017: IMPORT BATCHES (before transactions, for FK)
-- ============================================================

CREATE TABLE import_batches (
    id SERIAL PRIMARY KEY,
    bank_account_id VARCHAR(50) NOT NULL REFERENCES bank_accounts(id),
    entity_id VARCHAR(30) REFERENCES entities(id),
    format VARCHAR(20),
    file_name TEXT,
    total_rows INT,
    rows_normalized INT,
    rows_imported INT,
    rows_skipped_duplicates INT,
    rows_needs_review INT,
    pnl_months_regenerated TEXT[],
    intercompany_detected INT DEFAULT 0,
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reverted_at TIMESTAMPTZ,
    reverted_by VARCHAR(200)
);

CREATE INDEX idx_import_batches_account ON import_batches(bank_account_id);
CREATE INDEX idx_import_batches_created ON import_batches(created_at DESC);

-- ============================================================
-- 003 + 017: TRANSACTIONS
-- Includes: import_batch_id (017)
-- Audit fix: linked_transaction_id ON DELETE SET NULL
-- ============================================================

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(200) UNIQUE,
    bank_account_id VARCHAR(50) NOT NULL REFERENCES bank_accounts(id),
    entity_id VARCHAR(30) NOT NULL REFERENCES entities(id),
    timestamp TIMESTAMPTZ NOT NULL,
    description TEXT,
    counterparty VARCHAR(200),
    amount_original DECIMAL(15,2) NOT NULL,
    currency_original VARCHAR(3) NOT NULL,
    amount_usd DECIMAL(15,2) NOT NULL,
    fx_rate DECIMAL(10,6) DEFAULT 1.0,
    category_id VARCHAR(50) REFERENCES categories(id),
    is_intercompany BOOLEAN DEFAULT FALSE,
    linked_transaction_id INT REFERENCES transactions(id) ON DELETE SET NULL,
    counterpart_entity_id VARCHAR(30) REFERENCES entities(id),
    classified_by VARCHAR(10) CHECK (classified_by IN ('ai', 'human', 'rule')),
    classification_confidence DECIMAL(5,2),
    needs_review BOOLEAN DEFAULT FALSE,
    reviewed_by VARCHAR(50),
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    import_batch_id INT REFERENCES import_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_entity ON transactions(entity_id);
CREATE INDEX idx_tx_bank_account ON transactions(bank_account_id);
CREATE INDEX idx_tx_timestamp ON transactions(timestamp);
CREATE INDEX idx_tx_category ON transactions(category_id);
CREATE INDEX idx_tx_review ON transactions(needs_review) WHERE needs_review = TRUE;
CREATE INDEX idx_tx_external_id ON transactions(external_id);
CREATE INDEX idx_tx_intercompany ON transactions(is_intercompany) WHERE is_intercompany = TRUE;
CREATE INDEX idx_tx_batch ON transactions(import_batch_id);

-- ============================================================
-- 004: CLASSIFICATION RULES
-- ============================================================

CREATE TABLE classification_rules (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('counterparty', 'description', 'amount_range', 'combined')),
    pattern_value TEXT NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id),
    entity_id VARCHAR(30) REFERENCES entities(id),
    source VARCHAR(10) NOT NULL CHECK (source IN ('manual', 'learned')),
    times_applied INT DEFAULT 0,
    times_overridden INT DEFAULT 0,
    accuracy DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN (times_applied + times_overridden) > 0
        THEN times_applied::decimal / (times_applied + times_overridden) * 100
        ELSE 100 END
    ) STORED,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rules_pattern ON classification_rules(pattern_type, active) WHERE active = TRUE;
CREATE INDEX idx_rules_category ON classification_rules(category_id);

-- Seed: regras manuais iniciais (counterparty match)
INSERT INTO classification_rules (pattern_type, pattern_value, category_id, source) VALUES
('counterparty', 'Shopify', 'revenue_shopify', 'manual'),
('counterparty', 'Meta Platforms', 'cost_ads_meta', 'manual'),
('counterparty', 'Facebook', 'cost_ads_meta', 'manual'),
('counterparty', 'TikTok', 'cost_ads_tiktok', 'manual'),
('counterparty', 'Google Ads', 'cost_ads_google', 'manual'),
('counterparty', 'CJ Dropshipping', 'cost_products', 'manual'),
('counterparty', 'Zendrop', 'cost_products', 'manual'),
('counterparty', 'Stripe', 'cost_gateway', 'manual'),
('counterparty', 'PayPal', 'cost_gateway', 'manual'),
('counterparty', 'Shopify bill', 'cost_saas', 'manual');

-- Seed: regras de intercompany
INSERT INTO classification_rules (pattern_type, pattern_value, category_id, source) VALUES
('counterparty', 'DSJ Network', 'transfer_intercompany', 'manual'),
('counterparty', 'Universal MKT', 'transfer_intercompany', 'manual'),
('counterparty', 'DSJ Connect', 'transfer_intercompany', 'manual');

-- Seed: regras de cambio
INSERT INTO classification_rules (pattern_type, pattern_value, category_id, source) VALUES
('description', 'exchange', 'transfer_fx', 'manual'),
('description', 'FX', 'transfer_fx', 'manual'),
('description', 'conversion', 'transfer_fx', 'manual');

-- ============================================================
-- 005: MONTHLY P&L
-- Audit fix: margin_pct DECIMAL(10,2) (was 5,2 which overflows)
-- ============================================================

CREATE TABLE monthly_pnl (
    id SERIAL PRIMARY KEY,
    month DATE NOT NULL,
    entity_id VARCHAR(30) NOT NULL REFERENCES entities(id),
    revenue DECIMAL(15,2) DEFAULT 0,
    cost_ads DECIMAL(15,2) DEFAULT 0,
    cost_products DECIMAL(15,2) DEFAULT 0,
    cost_shipping DECIMAL(15,2) DEFAULT 0,
    cost_gateway DECIMAL(15,2) DEFAULT 0,
    cost_chargebacks DECIMAL(15,2) DEFAULT 0,
    cost_refunds DECIMAL(15,2) DEFAULT 0,
    cost_team DECIMAL(15,2) DEFAULT 0,
    cost_saas DECIMAL(15,2) DEFAULT 0,
    cost_infra DECIMAL(15,2) DEFAULT 0,
    cost_legal DECIMAL(15,2) DEFAULT 0,
    cost_other DECIMAL(15,2) DEFAULT 0,
    total_costs DECIMAL(15,2) DEFAULT 0,
    net_profit DECIMAL(15,2) DEFAULT 0,
    margin_pct DECIMAL(10,2) DEFAULT 0,
    pending_review_count INT DEFAULT 0,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, entity_id)
);

CREATE INDEX idx_pnl_month ON monthly_pnl(month);
CREATE INDEX idx_pnl_entity ON monthly_pnl(entity_id);

-- ============================================================
-- 006: INVESTORS + INVITE CODES
-- invite_codes includes: receivable_id, investor_name, investor_email, message (013)
-- ============================================================

CREATE TABLE investors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    bank_name VARCHAR(100),
    bank_agency VARCHAR(10),
    bank_account VARCHAR(20),
    pix_key VARCHAR(100),
    invite_code VARCHAR(20),
    invited_by INT REFERENCES investors(id),
    auth_user_id UUID UNIQUE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    approved_by VARCHAR(50),
    approved_at TIMESTAMPTZ,
    total_invested DECIMAL(15,2) DEFAULT 0,
    total_returned DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investors_status ON investors(status);
CREATE INDEX idx_investors_cpf ON investors(cpf);
CREATE INDEX idx_investors_auth ON investors(auth_user_id);

CREATE TABLE invite_codes (
    code VARCHAR(20) PRIMARY KEY,
    created_by VARCHAR(50),
    used_by INT REFERENCES investors(id),
    used_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    receivable_id INT REFERENCES receivables(id),
    investor_name VARCHAR(200),
    investor_email VARCHAR(200),
    message TEXT
);

CREATE INDEX idx_invites_active ON invite_codes(active) WHERE active = TRUE;

-- ============================================================
-- 007: OPPORTUNITIES + INVESTMENTS
-- ============================================================

CREATE TABLE opportunities (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    product_name VARCHAR(200),
    target_amount DECIMAL(15,2) NOT NULL,
    raised_amount DECIMAL(15,2) DEFAULT 0,
    min_investment DECIMAL(15,2) DEFAULT 2500,
    duration_days INT NOT NULL,
    return_estimate_min DECIMAL(5,2),
    return_estimate_max DECIMAL(5,2),
    proven_roas DECIMAL(5,2),
    proven_margin DECIMAL(5,2),
    proven_sales INT,
    proven_chargeback_rate DECIMAL(5,2),
    allocation_ads_pct INT,
    allocation_products_pct INT,
    allocation_shipping_pct INT,
    allocation_reserve_pct INT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'funded', 'active', 'completed', 'cancelled')),
    risks_description TEXT,
    created_by VARCHAR(50),
    opened_at TIMESTAMPTZ,
    funded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_return_pct DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_status ON opportunities(status);

CREATE TABLE investments (
    id SERIAL PRIMARY KEY,
    investor_id INT NOT NULL REFERENCES investors(id),
    opportunity_id INT NOT NULL REFERENCES opportunities(id),
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'active', 'returned', 'partial_loss')),
    contract_hash VARCHAR(64),
    contract_signed_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    return_amount DECIMAL(15,2),
    return_pct DECIMAL(5,2),
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investments_investor ON investments(investor_id);
CREATE INDEX idx_investments_opportunity ON investments(opportunity_id);
CREATE INDEX idx_investments_status ON investments(status);

-- ============================================================
-- 008: INVESTOR METRICS + OPERATION UPDATES
-- ============================================================

CREATE TABLE investor_metrics (
    id SERIAL PRIMARY KEY,
    month DATE NOT NULL UNIQUE,
    total_revenue_usd DECIMAL(15,2),
    margin_pct DECIMAL(5,2),
    active_operations INT,
    months_operating INT,
    opportunities_completed INT,
    opportunities_avg_return DECIMAL(5,2),
    opportunities_loss_count INT DEFAULT 0,
    total_capital_returned DECIMAL(15,2),
    visible BOOLEAN DEFAULT TRUE,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE operation_updates (
    id SERIAL PRIMARY KEY,
    opportunity_id INT NOT NULL REFERENCES opportunities(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    revenue_generated DECIMAL(15,2),
    current_roas DECIMAL(5,2),
    current_margin DECIMAL(5,2),
    chargeback_rate DECIMAL(5,2),
    projected_return_pct DECIMAL(5,2),
    status_note TEXT,
    ai_status TEXT,
    visible_to_investor BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_op_updates_opportunity ON operation_updates(opportunity_id);
CREATE INDEX idx_op_updates_visible ON operation_updates(visible_to_investor) WHERE visible_to_investor = TRUE;

-- ============================================================
-- 011: USER ROLES
-- ============================================================

CREATE TABLE user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('dsj', 'investor')),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_roles_role ON user_roles(role);

-- ============================================================
-- 011: RECEIVABLES
-- ============================================================

CREATE TABLE receivables (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(30) NOT NULL REFERENCES entities(id),
    description TEXT NOT NULL,
    counterparty VARCHAR(200),
    amount_total DECIMAL(15,2) NOT NULL,
    amount_received DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'defaulted')),
    open_for_financing BOOLEAN DEFAULT FALSE,
    financing_interest_rate_pct DECIMAL(5,2),
    financing_min_amount DECIMAL(15,2),
    financing_max_amount DECIMAL(15,2),
    financing_redemption_days INT,
    financing_terms TEXT,
    financing_raised DECIMAL(15,2) DEFAULT 0,
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'transaction', 'shopify', 'gateway')),
    source_ref VARCHAR(200),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receivables_entity ON receivables(entity_id);
CREATE INDEX idx_receivables_status ON receivables(status);
CREATE INDEX idx_receivables_due ON receivables(due_date);
CREATE INDEX idx_receivables_financing ON receivables(open_for_financing) WHERE open_for_financing = TRUE;

-- ============================================================
-- 011: DEBTS
-- ============================================================

CREATE TABLE debts (
    id SERIAL PRIMARY KEY,
    entity_id VARCHAR(30) NOT NULL REFERENCES entities(id),
    description TEXT NOT NULL,
    creditor VARCHAR(200),
    amount_total DECIMAL(15,2) NOT NULL,
    amount_paid DECIMAL(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    interest_rate_pct DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    category VARCHAR(50),
    source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'transaction', 'supplier')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_debts_entity ON debts(entity_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_due ON debts(due_date);

-- ============================================================
-- 011: FINANCINGS
-- Includes: contract_text, contract_accepted_at, contract_ip (013)
-- ============================================================

CREATE TABLE financings (
    id SERIAL PRIMARY KEY,
    receivable_id INT NOT NULL REFERENCES receivables(id),
    investor_id INT NOT NULL REFERENCES investors(id),
    amount_invested DECIMAL(15,2) NOT NULL,
    interest_rate_pct DECIMAL(5,2) NOT NULL,
    redemption_days INT NOT NULL,
    expected_return DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'redeemed', 'defaulted', 'cancelled')),
    contract_hash VARCHAR(64),
    contract_signed_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    redemption_date DATE,
    redeemed_at TIMESTAMPTZ,
    actual_return DECIMAL(15,2),
    contract_text TEXT,
    contract_accepted_at TIMESTAMPTZ,
    contract_ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financings_receivable ON financings(receivable_id);
CREATE INDEX idx_financings_investor ON financings(investor_id);
CREATE INDEX idx_financings_status ON financings(status);

-- ============================================================
-- 011: RISK METRICS
-- ============================================================

CREATE TABLE risk_metrics (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL UNIQUE,
    cash_balance_usd DECIMAL(15,2),
    receivables_pending DECIMAL(15,2),
    receivables_overdue DECIMAL(15,2),
    debts_pending DECIMAL(15,2),
    debts_overdue DECIMAL(15,2),
    daily_ad_spend DECIMAL(15,2),
    monthly_revenue DECIMAL(15,2),
    monthly_costs DECIMAL(15,2),
    avg_days_to_receive DECIMAL(5,1),
    avg_days_to_pay DECIMAL(5,1),
    burn_rate DECIMAL(15,2),
    runway_days DECIMAL(7,1),
    cash_after_obligations DECIMAL(15,2),
    risk_score DECIMAL(5,2),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    ai_analysis TEXT,
    ai_recommendations TEXT,
    factors JSONB,
    scenarios JSONB,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_date ON risk_metrics(snapshot_date DESC);

-- ============================================================
-- 013: PAYMENT SCHEDULE
-- ============================================================

CREATE TABLE payment_schedule (
    id SERIAL PRIMARY KEY,
    financing_id INT NOT NULL REFERENCES financings(id),
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount_principal DECIMAL(15,2) NOT NULL,
    amount_interest DECIMAL(15,2) NOT NULL,
    amount_total DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMPTZ,
    paid_amount DECIMAL(15,2),
    payment_ref VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_schedule_financing ON payment_schedule(financing_id);
CREATE INDEX idx_payment_schedule_due ON payment_schedule(due_date);
CREATE INDEX idx_payment_schedule_status ON payment_schedule(status);

-- ============================================================
-- 013: INVESTOR STATEMENTS
-- ============================================================

CREATE TABLE investor_statements (
    id SERIAL PRIMARY KEY,
    financing_id INT NOT NULL REFERENCES financings(id),
    investor_id INT NOT NULL REFERENCES investors(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    opening_balance DECIMAL(15,2) NOT NULL,
    total_received DECIMAL(15,2) DEFAULT 0,
    total_interest DECIMAL(15,2) DEFAULT 0,
    closing_balance DECIMAL(15,2) NOT NULL,
    payments JSONB,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed')),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ
);

CREATE INDEX idx_statements_investor ON investor_statements(investor_id);
CREATE INDEX idx_statements_financing ON investor_statements(financing_id);

-- ============================================================
-- 014: PLATFORM SETTINGS
-- ============================================================

CREATE TABLE platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by VARCHAR(200),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value) VALUES
('contract_template', ''),
('contract_version', '0'),
('platform_name', 'DSJ Finance'),
('min_investment_default', '1000');

-- ============================================================
-- 015 + 016 + 022: REVOLUT CREDENTIALS
-- Includes: refresh_token nullable (016), revolut_account_id (022)
-- ============================================================

CREATE TABLE revolut_credentials (
    id SERIAL PRIMARY KEY,
    bank_account_id VARCHAR(50) NOT NULL UNIQUE REFERENCES bank_accounts(id),
    client_id VARCHAR(100) NOT NULL,
    issuer VARCHAR(200) NOT NULL,
    private_key TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    sandbox BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMPTZ,
    last_sync_count INT,
    last_sync_error TEXT,
    active BOOLEAN DEFAULT TRUE,
    revolut_account_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revolut_creds_account ON revolut_credentials(bank_account_id);

COMMENT ON COLUMN revolut_credentials.revolut_account_id IS
  'Revolut sub-account UUID (de GET /accounts). Sync importa apenas legs deste account.';

-- ============================================================
-- 016: REVOLUT OAUTH STATE
-- ============================================================

CREATE TABLE revolut_oauth_state (
    state VARCHAR(64) PRIMARY KEY,
    bank_account_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revolut_oauth_state_expires ON revolut_oauth_state(expires_at);

-- ============================================================
-- ROW LEVEL SECURITY (009 + 011 + 013 + 019)
-- ============================================================

-- Enable RLS
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_statements ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- Investor self-access policies (009)
-- --------------------------------------------------------

-- Investidores: so leem seu proprio registro
CREATE POLICY investors_select_own ON investors
    FOR SELECT USING (auth.uid() = auth_user_id);

-- Investimentos: investidor so ve os seus
CREATE POLICY investments_select_own ON investments
    FOR SELECT USING (
        investor_id IN (SELECT id FROM investors WHERE auth_user_id = auth.uid())
    );

-- Oportunidades: investidores aprovados veem oportunidades abertas/ativas
CREATE POLICY opportunities_select_public ON opportunities
    FOR SELECT USING (
        status IN ('open', 'funded', 'active', 'completed')
        AND EXISTS (
            SELECT 1 FROM investors
            WHERE auth_user_id = auth.uid() AND status = 'approved'
        )
    );

-- Metricas: investidores aprovados veem metricas visiveis
CREATE POLICY metrics_select_visible ON investor_metrics
    FOR SELECT USING (
        visible = TRUE
        AND EXISTS (
            SELECT 1 FROM investors
            WHERE auth_user_id = auth.uid() AND status = 'approved'
        )
    );

-- Operation updates: investidor ve updates das suas operacoes (se visiveis)
CREATE POLICY op_updates_select_own ON operation_updates
    FOR SELECT USING (
        visible_to_investor = TRUE
        AND opportunity_id IN (
            SELECT opportunity_id FROM investments
            WHERE investor_id IN (SELECT id FROM investors WHERE auth_user_id = auth.uid())
        )
    );

-- Invite codes: publico pode verificar se codigo e valido
CREATE POLICY invites_select_active ON invite_codes
    FOR SELECT USING (active = TRUE AND used_by IS NULL);

-- --------------------------------------------------------
-- User roles self-access (011)
-- --------------------------------------------------------

CREATE POLICY user_roles_select_own ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- --------------------------------------------------------
-- Receivables: investor access (011)
-- --------------------------------------------------------

CREATE POLICY receivables_investor_select ON receivables
    FOR SELECT USING (
        open_for_financing = TRUE
        AND EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'investor' AND is_active = TRUE
        )
    );

-- --------------------------------------------------------
-- Financings: investor self-access (011)
-- --------------------------------------------------------

CREATE POLICY financings_investor_select_own ON financings
    FOR SELECT USING (
        investor_id IN (
            SELECT id FROM investors WHERE auth_user_id = auth.uid()
        )
    );

-- --------------------------------------------------------
-- Payment schedule: investor self-access (013)
-- --------------------------------------------------------

CREATE POLICY payment_schedule_investor_select ON payment_schedule
    FOR SELECT USING (
        financing_id IN (
            SELECT f.id FROM financings f
            JOIN investors i ON f.investor_id = i.id
            WHERE i.auth_user_id = auth.uid()
        )
    );

-- --------------------------------------------------------
-- Investor statements: investor self-access (013)
-- --------------------------------------------------------

CREATE POLICY statements_investor_select ON investor_statements
    FOR SELECT USING (
        investor_id IN (
            SELECT id FROM investors WHERE auth_user_id = auth.uid()
        )
    );

-- --------------------------------------------------------
-- Admin (DSJ) full-access policies (019)
-- --------------------------------------------------------

CREATE POLICY receivables_dsj_all ON receivables
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY debts_dsj_all ON debts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY financings_dsj_all ON financings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY investors_dsj_all ON investors
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY invite_codes_dsj_all ON invite_codes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

CREATE POLICY metrics_dsj_all ON investor_metrics
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'dsj' AND is_active = TRUE
        )
        OR auth.role() = 'service_role'
    );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- --------------------------------------------------------
-- Helper: get_my_role (011)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS VARCHAR(20) AS $$
DECLARE
    v_role VARCHAR(20);
BEGIN
    SELECT role INTO v_role FROM user_roles
    WHERE user_id = auth.uid() AND is_active = TRUE
    LIMIT 1;
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------
-- Helper: entity_name_in_text (025)
-- Checks whether an entity name (or variants) appears in free text
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION entity_name_in_text(p_text TEXT, p_entity_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_text_lower TEXT;
    v_full_lower TEXT;
    v_no_suffix TEXT;
    v_no_spaces TEXT;
    v_first_two TEXT;
    v_first_word TEXT;
BEGIN
    IF p_text IS NULL OR p_entity_name IS NULL THEN
        RETURN FALSE;
    END IF;

    v_text_lower := LOWER(p_text);
    v_full_lower := LOWER(p_entity_name);

    -- Match nome completo
    IF POSITION(v_full_lower IN v_text_lower) > 0 THEN
        RETURN TRUE;
    END IF;

    -- Sem sufixo legal (LLC, LLP, LTDA, INC, S.A., etc.)
    v_no_suffix := REGEXP_REPLACE(
        v_full_lower,
        '\s+(llc|llp|ltda|ltd|inc|s\.?a\.?|corp|gmbh|sa)\.?$',
        '',
        'i'
    );
    IF v_no_suffix != v_full_lower AND POSITION(v_no_suffix IN v_text_lower) > 0 THEN
        RETURN TRUE;
    END IF;

    -- Sem espacos: "DSJ Network LLC" -> "dsjnetworkllc" e variantes
    v_no_spaces := REPLACE(v_no_suffix, ' ', '');
    IF LENGTH(v_no_spaces) >= 5 AND POSITION(v_no_spaces IN REPLACE(v_text_lower, ' ', '')) > 0 THEN
        RETURN TRUE;
    END IF;

    -- Primeiras duas palavras (ex: "DSJ Network" sem o LLC)
    v_first_two := SPLIT_PART(v_no_suffix, ' ', 1) || ' ' || SPLIT_PART(v_no_suffix, ' ', 2);
    IF v_first_two != ' ' AND LENGTH(v_first_two) >= 5 AND POSITION(v_first_two IN v_text_lower) > 0 THEN
        RETURN TRUE;
    END IF;

    -- Primeira palavra MAS so se for distintiva (>= 6 chars; "DSJ" sozinho e ambiguo)
    v_first_word := SPLIT_PART(v_no_suffix, ' ', 1);
    IF LENGTH(v_first_word) >= 6 AND POSITION(v_first_word IN v_text_lower) > 0 THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- --------------------------------------------------------
-- generate_pnl (FINAL — from 023, with fixes from 018/020)
-- Revenue never negative; catch-all cost_other; LEFT JOIN for uncategorized
-- Audit fix: v_margin_pct uses DECIMAL(10,2)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_pnl(p_month DATE, p_entity_id VARCHAR(30))
RETURNS void AS $$
DECLARE
    v_revenue DECIMAL(15,2) DEFAULT 0;
    v_cost_ads DECIMAL(15,2) DEFAULT 0;
    v_cost_products DECIMAL(15,2) DEFAULT 0;
    v_cost_shipping DECIMAL(15,2) DEFAULT 0;
    v_cost_gateway DECIMAL(15,2) DEFAULT 0;
    v_cost_chargebacks DECIMAL(15,2) DEFAULT 0;
    v_cost_refunds DECIMAL(15,2) DEFAULT 0;
    v_cost_team DECIMAL(15,2) DEFAULT 0;
    v_cost_saas DECIMAL(15,2) DEFAULT 0;
    v_cost_infra DECIMAL(15,2) DEFAULT 0;
    v_cost_legal DECIMAL(15,2) DEFAULT 0;
    v_cost_other DECIMAL(15,2) DEFAULT 0;
    v_total_costs DECIMAL(15,2);
    v_net_profit DECIMAL(15,2);
    v_margin_pct DECIMAL(10,2);
    v_pending INT;
    v_month_start TIMESTAMPTZ;
    v_month_end TIMESTAMPTZ;
BEGIN
    v_month_start := p_month::TIMESTAMPTZ;
    v_month_end := (p_month + INTERVAL '1 month')::TIMESTAMPTZ;

    SELECT
        -- Revenue: SO positivas em categoria revenue + uncategorized positivas
        -- Negativas em revenue vao pra cost_refunds (regra abaixo)
        COALESCE(SUM(CASE
            WHEN c.group_name = 'revenue' AND t.amount_usd > 0 THEN t.amount_usd
            WHEN t.category_id IS NULL AND t.amount_usd > 0 THEN t.amount_usd
            ELSE 0
        END), 0),
        -- Custos especificos
        COALESCE(SUM(CASE WHEN t.category_id IN ('cost_ads_meta', 'cost_ads_tiktok', 'cost_ads_google') THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_products' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_shipping' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_gateway' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_chargebacks' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        -- cost_refunds inclui:
        --   1. Categoria explicita cost_refunds (sempre absoluto)
        --   2. Negativas em categoria revenue (refunds emitidos pelo merchant)
        COALESCE(SUM(CASE
            WHEN t.category_id = 'cost_refunds' THEN ABS(t.amount_usd)
            WHEN c.group_name = 'revenue' AND t.amount_usd < 0 THEN ABS(t.amount_usd)
            ELSE 0
        END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_team' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_saas' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_infra' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_legal' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        -- cost_other: catch-all para QUALQUER categoria de custo nao listada acima
        -- inclui cost_office, novas categorias customs, e uncategorized negativos
        COALESCE(SUM(CASE
            WHEN c.group_name IN ('cost_variable', 'cost_fixed')
              AND t.category_id NOT IN (
                'cost_ads_meta', 'cost_ads_tiktok', 'cost_ads_google',
                'cost_products', 'cost_shipping', 'cost_gateway',
                'cost_chargebacks', 'cost_refunds',
                'cost_team', 'cost_saas', 'cost_infra', 'cost_legal'
              ) THEN ABS(t.amount_usd)
            WHEN t.category_id IS NULL AND t.amount_usd < 0 THEN ABS(t.amount_usd)
            ELSE 0
        END), 0)
    INTO
        v_revenue, v_cost_ads, v_cost_products, v_cost_shipping,
        v_cost_gateway, v_cost_chargebacks, v_cost_refunds,
        v_cost_team, v_cost_saas, v_cost_infra, v_cost_legal, v_cost_other
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.entity_id = p_entity_id
      AND t.timestamp >= v_month_start
      AND t.timestamp < v_month_end
      AND t.is_intercompany = FALSE
      AND (c.id IS NULL OR c.affects_pnl = TRUE);

    v_total_costs := v_cost_ads + v_cost_products + v_cost_shipping + v_cost_gateway
                   + v_cost_chargebacks + v_cost_refunds + v_cost_team + v_cost_saas
                   + v_cost_infra + v_cost_legal + v_cost_other;
    v_net_profit := v_revenue - v_total_costs;
    v_margin_pct := CASE WHEN v_revenue > 0 THEN (v_net_profit / v_revenue) * 100 ELSE 0 END;

    SELECT COUNT(*) INTO v_pending
    FROM transactions
    WHERE entity_id = p_entity_id
      AND timestamp >= v_month_start
      AND timestamp < v_month_end
      AND needs_review = TRUE;

    INSERT INTO monthly_pnl (month, entity_id, revenue, cost_ads, cost_products, cost_shipping,
        cost_gateway, cost_chargebacks, cost_refunds, cost_team, cost_saas, cost_infra,
        cost_legal, cost_other, total_costs, net_profit, margin_pct, pending_review_count, generated_at)
    VALUES (p_month, p_entity_id, v_revenue, v_cost_ads, v_cost_products, v_cost_shipping,
        v_cost_gateway, v_cost_chargebacks, v_cost_refunds, v_cost_team, v_cost_saas, v_cost_infra,
        v_cost_legal, v_cost_other, v_total_costs, v_net_profit, v_margin_pct, v_pending, NOW())
    ON CONFLICT (month, entity_id) DO UPDATE SET
        revenue = EXCLUDED.revenue, cost_ads = EXCLUDED.cost_ads,
        cost_products = EXCLUDED.cost_products, cost_shipping = EXCLUDED.cost_shipping,
        cost_gateway = EXCLUDED.cost_gateway, cost_chargebacks = EXCLUDED.cost_chargebacks,
        cost_refunds = EXCLUDED.cost_refunds, cost_team = EXCLUDED.cost_team,
        cost_saas = EXCLUDED.cost_saas, cost_infra = EXCLUDED.cost_infra,
        cost_legal = EXCLUDED.cost_legal, cost_other = EXCLUDED.cost_other,
        total_costs = EXCLUDED.total_costs, net_profit = EXCLUDED.net_profit,
        margin_pct = EXCLUDED.margin_pct, pending_review_count = EXCLUDED.pending_review_count,
        generated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- generate_consolidated_pnl (010)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_consolidated_pnl(p_month DATE)
RETURNS void AS $$
BEGIN
    -- Gerar P&L para cada empresa individual
    PERFORM generate_pnl(p_month, id) FROM entities WHERE id != 'consolidated';

    -- Consolidar somando todas
    INSERT INTO monthly_pnl (month, entity_id, revenue, cost_ads, cost_products, cost_shipping,
        cost_gateway, cost_chargebacks, cost_refunds, cost_team, cost_saas, cost_infra,
        cost_legal, cost_other, total_costs, net_profit, margin_pct, pending_review_count, generated_at)
    SELECT
        p_month, 'consolidated',
        SUM(revenue), SUM(cost_ads), SUM(cost_products), SUM(cost_shipping),
        SUM(cost_gateway), SUM(cost_chargebacks), SUM(cost_refunds), SUM(cost_team),
        SUM(cost_saas), SUM(cost_infra), SUM(cost_legal), SUM(cost_other),
        SUM(total_costs), SUM(net_profit),
        CASE WHEN SUM(revenue) > 0 THEN (SUM(net_profit) / SUM(revenue)) * 100 ELSE 0 END,
        SUM(pending_review_count), NOW()
    FROM monthly_pnl
    WHERE month = p_month AND entity_id != 'consolidated'
    ON CONFLICT (month, entity_id) DO UPDATE SET
        revenue = EXCLUDED.revenue, cost_ads = EXCLUDED.cost_ads,
        cost_products = EXCLUDED.cost_products, cost_shipping = EXCLUDED.cost_shipping,
        cost_gateway = EXCLUDED.cost_gateway, cost_chargebacks = EXCLUDED.cost_chargebacks,
        cost_refunds = EXCLUDED.cost_refunds, cost_team = EXCLUDED.cost_team,
        cost_saas = EXCLUDED.cost_saas, cost_infra = EXCLUDED.cost_infra,
        cost_legal = EXCLUDED.cost_legal, cost_other = EXCLUDED.cost_other,
        total_costs = EXCLUDED.total_costs, net_profit = EXCLUDED.net_profit,
        margin_pct = EXCLUDED.margin_pct, pending_review_count = EXCLUDED.pending_review_count,
        generated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- detect_intercompany (FINAL — from 025, with Mercury/Airwallex exclusion from 024)
-- Requires entity name evidence in description/counterparty
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION detect_intercompany(p_hours_window INT DEFAULT 48)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT t1.id AS out_id, t2.id AS in_id,
               t1.entity_id AS out_entity, t2.entity_id AS in_entity,
               e_in.name AS in_entity_name, e_out.name AS out_entity_name
        FROM transactions t1
        JOIN transactions t2 ON t1.id != t2.id
        JOIN bank_accounts ba_in ON t2.bank_account_id = ba_in.id
        JOIN entities e_in ON t2.entity_id = e_in.id
        JOIN entities e_out ON t1.entity_id = e_out.id
        WHERE t1.amount_usd < 0 AND t2.amount_usd > 0
          AND t1.is_intercompany = FALSE AND t2.is_intercompany = FALSE
          AND t1.entity_id != t2.entity_id
          -- Match de valor (2% de tolerancia)
          AND ABS(ABS(t1.amount_usd) - t2.amount_usd) / GREATEST(ABS(t1.amount_usd), 0.01) <= 0.02
          -- Janela de tempo
          AND ABS(EXTRACT(EPOCH FROM (t1.timestamp - t2.timestamp))) <= p_hours_window * 3600
          AND t1.created_at >= NOW() - INTERVAL '1 hour' * p_hours_window
          -- Mercury/Airwallex sao receita (regra 024)
          AND LOWER(ba_in.bank_name) NOT IN ('mercury', 'airwallex')
          -- REGRA DE OURO: pelo menos UMA das transacoes tem que mencionar o nome da OUTRA empresa
          AND (
            entity_name_in_text(
              COALESCE(t1.description, '') || ' ' || COALESCE(t1.counterparty, ''),
              e_in.name
            )
            OR entity_name_in_text(
              COALESCE(t2.description, '') || ' ' || COALESCE(t2.counterparty, ''),
              e_out.name
            )
          )
    LOOP
        UPDATE transactions SET
            is_intercompany = TRUE,
            category_id = 'transfer_intercompany',
            classified_by = 'rule',
            classification_confidence = 95,
            linked_transaction_id = rec.in_id,
            counterpart_entity_id = rec.in_entity,
            needs_review = FALSE
        WHERE id = rec.out_id;

        UPDATE transactions SET
            is_intercompany = TRUE,
            category_id = 'transfer_intercompany',
            classified_by = 'rule',
            classification_confidence = 95,
            linked_transaction_id = rec.out_id,
            counterpart_entity_id = rec.out_entity,
            needs_review = FALSE
        WHERE id = rec.in_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- generate_investor_metrics (010)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_investor_metrics(p_month DATE)
RETURNS void AS $$
DECLARE
    v_revenue DECIMAL(15,2);
    v_margin DECIMAL(5,2);
    v_active_ops INT;
    v_months_operating INT;
    v_completed INT;
    v_avg_return DECIMAL(5,2);
    v_losses INT;
    v_capital_returned DECIMAL(15,2);
BEGIN
    SELECT revenue, margin_pct INTO v_revenue, v_margin
    FROM monthly_pnl WHERE month = p_month AND entity_id = 'consolidated';

    SELECT COUNT(*) INTO v_active_ops FROM opportunities WHERE status = 'active';

    SELECT COUNT(DISTINCT month) INTO v_months_operating FROM monthly_pnl
    WHERE entity_id = 'consolidated' AND revenue > 0;

    SELECT COUNT(*), COALESCE(AVG(actual_return_pct), 0)
    INTO v_completed, v_avg_return
    FROM opportunities WHERE status = 'completed';

    SELECT COUNT(*) INTO v_losses
    FROM opportunities WHERE status = 'completed' AND actual_return_pct < 0;

    SELECT COALESCE(SUM(return_amount), 0) INTO v_capital_returned
    FROM investments WHERE status = 'returned';

    INSERT INTO investor_metrics (month, total_revenue_usd, margin_pct, active_operations,
        months_operating, opportunities_completed, opportunities_avg_return,
        opportunities_loss_count, total_capital_returned, generated_at)
    VALUES (p_month, COALESCE(v_revenue, 0), COALESCE(v_margin, 0), v_active_ops,
        v_months_operating, v_completed, v_avg_return, v_losses, v_capital_returned, NOW())
    ON CONFLICT (month) DO UPDATE SET
        total_revenue_usd = EXCLUDED.total_revenue_usd, margin_pct = EXCLUDED.margin_pct,
        active_operations = EXCLUDED.active_operations, months_operating = EXCLUDED.months_operating,
        opportunities_completed = EXCLUDED.opportunities_completed,
        opportunities_avg_return = EXCLUDED.opportunities_avg_return,
        opportunities_loss_count = EXCLUDED.opportunities_loss_count,
        total_capital_returned = EXCLUDED.total_capital_returned, generated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- --------------------------------------------------------
-- Auto-update receivables.financing_raised on financing changes (011)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION update_receivable_raised()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE receivables r
    SET financing_raised = (
        SELECT COALESCE(SUM(amount_invested), 0)
        FROM financings
        WHERE receivable_id = r.id
          AND status IN ('active', 'redeemed')
    )
    WHERE r.id = COALESCE(NEW.receivable_id, OLD.receivable_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER financings_update_raised
AFTER INSERT OR UPDATE OR DELETE ON financings
FOR EACH ROW EXECUTE FUNCTION update_receivable_raised();

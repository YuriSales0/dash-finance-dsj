-- ============================================================
-- DSJ FINANCE — SCHEMA COMPLETO
-- Cole este arquivo INTEIRO no Supabase SQL Editor e execute
-- ============================================================

-- ============================================================
-- 001: ENTITIES + BANK ACCOUNTS
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

CREATE TABLE bank_accounts (
    id VARCHAR(50) PRIMARY KEY,
    entity_id VARCHAR(30) NOT NULL REFERENCES entities(id),
    bank_name VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    api_provider VARCHAR(20) NOT NULL,
    last_synced_at TIMESTAMPTZ,
    balance_current DECIMAL(15,2) DEFAULT 0,
    balance_available DECIMAL(15,2) DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);

INSERT INTO bank_accounts VALUES
('dsj_net_mercury', 'dsj_network', 'Mercury', 'USD', 'mercury', NULL, 0, 0, TRUE),
('dsj_net_revolut', 'dsj_network', 'Revolut', 'USD', 'revolut', NULL, 0, 0, TRUE),
('uni_mkt_airwallex', 'universal_mkt', 'Airwallex', 'GBP', 'airwallex', NULL, 0, 0, TRUE),
('uni_mkt_revolut', 'universal_mkt', 'Revolut', 'GBP', 'revolut', NULL, 0, 0, TRUE),
('dsj_con_mercury', 'dsj_connect', 'Mercury', 'USD', 'mercury', NULL, 0, 0, TRUE);

-- ============================================================
-- 002: CATEGORIES
-- ============================================================

CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    group_name VARCHAR(20) NOT NULL CHECK (group_name IN ('revenue', 'cost_variable', 'cost_fixed', 'transfer', 'investment')),
    label VARCHAR(100) NOT NULL,
    affects_pnl BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO categories VALUES
('revenue_shopify', 'revenue', 'Vendas Shopify (payouts)', TRUE),
('revenue_other', 'revenue', 'Outras receitas', TRUE),
('cost_ads_meta', 'cost_variable', 'Meta Ads', TRUE),
('cost_ads_tiktok', 'cost_variable', 'TikTok Ads', TRUE),
('cost_ads_google', 'cost_variable', 'Google Ads', TRUE),
('cost_products', 'cost_variable', 'Custo produto (fornecedores)', TRUE),
('cost_shipping', 'cost_variable', 'Frete + embalagem', TRUE),
('cost_gateway', 'cost_variable', 'Taxas gateway/processador', TRUE),
('cost_chargebacks', 'cost_variable', 'Chargebacks', TRUE),
('cost_refunds', 'cost_variable', 'Reembolsos', TRUE),
('cost_team', 'cost_fixed', 'Team (salarios, freelancers)', TRUE),
('cost_saas', 'cost_fixed', 'SaaS (Shopify, MSync, ferramentas)', TRUE),
('cost_infra', 'cost_fixed', 'Infraestrutura (hosting, dominios)', TRUE),
('cost_legal', 'cost_fixed', 'Legal + contabilidade', TRUE),
('cost_office', 'cost_fixed', 'Escritorio + operacional', TRUE),
('transfer_intercompany', 'transfer', 'Transferencia entre empresas', FALSE),
('transfer_interbank', 'transfer', 'Transferencia entre bancos (mesma empresa)', FALSE),
('transfer_fx', 'transfer', 'Cambio (conversao de moeda)', FALSE),
('investment_scp_in', 'investment', 'Aporte investidor SCP', FALSE),
('investment_scp_out', 'investment', 'Retorno investidor SCP', FALSE);

-- ============================================================
-- 003: TRANSACTIONS
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
    linked_transaction_id INT REFERENCES transactions(id),
    counterpart_entity_id VARCHAR(30) REFERENCES entities(id),
    classified_by VARCHAR(10) CHECK (classified_by IN ('ai', 'human', 'rule')),
    classification_confidence DECIMAL(5,2),
    needs_review BOOLEAN DEFAULT FALSE,
    reviewed_by VARCHAR(50),
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_entity ON transactions(entity_id);
CREATE INDEX idx_tx_bank_account ON transactions(bank_account_id);
CREATE INDEX idx_tx_timestamp ON transactions(timestamp);
CREATE INDEX idx_tx_category ON transactions(category_id);
CREATE INDEX idx_tx_review ON transactions(needs_review) WHERE needs_review = TRUE;
CREATE INDEX idx_tx_external_id ON transactions(external_id);
CREATE INDEX idx_tx_intercompany ON transactions(is_intercompany) WHERE is_intercompany = TRUE;

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
('counterparty', 'Shopify bill', 'cost_saas', 'manual'),
('counterparty', 'DSJ Network', 'transfer_intercompany', 'manual'),
('counterparty', 'Universal MKT', 'transfer_intercompany', 'manual'),
('counterparty', 'DSJ Connect', 'transfer_intercompany', 'manual'),
('description', 'exchange', 'transfer_fx', 'manual'),
('description', 'FX', 'transfer_fx', 'manual'),
('description', 'conversion', 'transfer_fx', 'manual');

-- ============================================================
-- 005: MONTHLY P&L
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
    margin_pct DECIMAL(5,2) DEFAULT 0,
    pending_review_count INT DEFAULT 0,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, entity_id)
);

CREATE INDEX idx_pnl_month ON monthly_pnl(month);
CREATE INDEX idx_pnl_entity ON monthly_pnl(entity_id);

-- ============================================================
-- 006: INVESTORS + INVITE CODES
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
    created_at TIMESTAMPTZ DEFAULT NOW()
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
-- 009: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY investors_select_own ON investors
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY investments_select_own ON investments
    FOR SELECT USING (
        investor_id IN (SELECT id FROM investors WHERE auth_user_id = auth.uid())
    );

CREATE POLICY opportunities_select_public ON opportunities
    FOR SELECT USING (
        status IN ('open', 'funded', 'active', 'completed')
        AND EXISTS (
            SELECT 1 FROM investors
            WHERE auth_user_id = auth.uid() AND status = 'approved'
        )
    );

CREATE POLICY metrics_select_visible ON investor_metrics
    FOR SELECT USING (
        visible = TRUE
        AND EXISTS (
            SELECT 1 FROM investors
            WHERE auth_user_id = auth.uid() AND status = 'approved'
        )
    );

CREATE POLICY op_updates_select_own ON operation_updates
    FOR SELECT USING (
        visible_to_investor = TRUE
        AND opportunity_id IN (
            SELECT opportunity_id FROM investments
            WHERE investor_id IN (SELECT id FROM investors WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY invites_select_active ON invite_codes
    FOR SELECT USING (active = TRUE AND used_by IS NULL);

-- ============================================================
-- 010: STORED FUNCTIONS
-- ============================================================

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
    v_margin_pct DECIMAL(5,2);
    v_pending INT;
    v_month_start TIMESTAMPTZ;
    v_month_end TIMESTAMPTZ;
BEGIN
    v_month_start := p_month::TIMESTAMPTZ;
    v_month_end := (p_month + INTERVAL '1 month')::TIMESTAMPTZ;

    SELECT
        COALESCE(SUM(CASE WHEN c.group_name = 'revenue' THEN t.amount_usd END), 0),
        COALESCE(SUM(CASE WHEN t.category_id IN ('cost_ads_meta', 'cost_ads_tiktok', 'cost_ads_google') THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_products' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_shipping' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_gateway' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_chargebacks' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_refunds' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_team' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_saas' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_infra' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_legal' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_office' THEN ABS(t.amount_usd) END), 0)
    INTO
        v_revenue, v_cost_ads, v_cost_products, v_cost_shipping,
        v_cost_gateway, v_cost_chargebacks, v_cost_refunds,
        v_cost_team, v_cost_saas, v_cost_infra, v_cost_legal, v_cost_other
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.entity_id = p_entity_id
      AND t.timestamp >= v_month_start
      AND t.timestamp < v_month_end
      AND c.affects_pnl = TRUE;

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

CREATE OR REPLACE FUNCTION generate_consolidated_pnl(p_month DATE)
RETURNS void AS $$
BEGIN
    PERFORM generate_pnl(p_month, id) FROM entities WHERE id != 'consolidated';

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

CREATE OR REPLACE FUNCTION detect_intercompany(p_hours_window INT DEFAULT 48)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT t1.id AS out_id, t2.id AS in_id,
               t1.entity_id AS out_entity, t2.entity_id AS in_entity
        FROM transactions t1
        JOIN transactions t2 ON t1.id != t2.id
        WHERE t1.amount_usd < 0 AND t2.amount_usd > 0
          AND t1.is_intercompany = FALSE AND t2.is_intercompany = FALSE
          AND t1.entity_id != t2.entity_id
          AND ABS(ABS(t1.amount_usd) - t2.amount_usd) / GREATEST(ABS(t1.amount_usd), 0.01) <= 0.02
          AND ABS(EXTRACT(EPOCH FROM (t1.timestamp - t2.timestamp))) <= p_hours_window * 3600
          AND t1.created_at >= NOW() - INTERVAL '1 hour' * p_hours_window
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
-- 011: USER ROLES + RECEIVABLES + DEBTS + FINANCINGS + RISK
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

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_roles_select_own ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

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

ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY receivables_investor_select ON receivables
    FOR SELECT USING (
        open_for_financing = TRUE
        AND EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'investor' AND is_active = TRUE
        )
    );

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

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financings_receivable ON financings(receivable_id);
CREATE INDEX idx_financings_investor ON financings(investor_id);
CREATE INDEX idx_financings_status ON financings(status);

ALTER TABLE financings ENABLE ROW LEVEL SECURITY;

CREATE POLICY financings_investor_select_own ON financings
    FOR SELECT USING (
        investor_id IN (
            SELECT id FROM investors WHERE auth_user_id = auth.uid()
        )
    );

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

-- ============================================================
-- PRONTO! Schema completo criado com sucesso.
--
-- PROXIMOS PASSOS:
-- 1. Em Authentication > Users do Supabase, criar primeiro usuario DSJ
-- 2. No SQL Editor, rodar:
--    INSERT INTO user_roles (user_id, role, name, email)
--    SELECT id, 'dsj', 'Seu Nome', email FROM auth.users WHERE email = 'seu@email.com';
-- 3. Para investidores: criar usuario em auth, depois inserir em investors + user_roles
-- ============================================================

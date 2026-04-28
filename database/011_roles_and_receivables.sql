-- ============================================================
-- 011: USER ROLES + RECEIVABLES + DEBTS + FINANCINGS + RISK
-- Cole este arquivo no Supabase SQL Editor (depois do full_schema.sql)
-- ============================================================

-- ------------------------------------------------------------
-- USER ROLES
-- Vincula usuarios do Supabase Auth a um papel: dsj ou investor
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- RECEIVABLES — Recebiveis que a DSJ tem direito a receber
-- Pode ser manual, ou puxado de transacao (futuro)
-- ------------------------------------------------------------
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

    -- Termos para financiamento por investidor
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

-- Investidores aprovados veem apenas os abertos para financiamento
CREATE POLICY receivables_investor_select ON receivables
    FOR SELECT USING (
        open_for_financing = TRUE
        AND EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'investor' AND is_active = TRUE
        )
    );

-- ------------------------------------------------------------
-- DEBTS — Dividas que a DSJ tem que pagar
-- ------------------------------------------------------------
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

-- Dividas sao privadas: so DSJ ve
-- Sem policy de SELECT para investor = nada visivel

-- ------------------------------------------------------------
-- FINANCINGS — Investidor financia recebivel da DSJ
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- RISK METRICS — Indice de risco calculado pelo agente AI
-- Snapshots diarios para historico
-- ------------------------------------------------------------
CREATE TABLE risk_metrics (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL UNIQUE,

    -- Estado financeiro
    cash_balance_usd DECIMAL(15,2),
    receivables_pending DECIMAL(15,2),
    receivables_overdue DECIMAL(15,2),
    debts_pending DECIMAL(15,2),
    debts_overdue DECIMAL(15,2),

    -- Operacao
    daily_ad_spend DECIMAL(15,2),
    monthly_revenue DECIMAL(15,2),
    monthly_costs DECIMAL(15,2),
    avg_days_to_receive DECIMAL(5,1),
    avg_days_to_pay DECIMAL(5,1),

    -- Calculos
    burn_rate DECIMAL(15,2),
    runway_days DECIMAL(7,1),
    cash_after_obligations DECIMAL(15,2),

    -- Indice (0-100, 0=seguro, 100=critico)
    risk_score DECIMAL(5,2),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

    -- Output do agente AI
    ai_analysis TEXT,
    ai_recommendations TEXT,
    factors JSONB,

    -- Cenarios "what-if"
    scenarios JSONB,

    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_date ON risk_metrics(snapshot_date DESC);

-- ------------------------------------------------------------
-- HELPER FUNCTION: Buscar role do usuario logado
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- TRIGGER: Auto-update receivables.financing_raised quando confirmar
-- ------------------------------------------------------------
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
-- PRONTO! Tabelas de roles, recebiveis, dividas, financiamentos
-- e indice de risco criadas.
-- ============================================================

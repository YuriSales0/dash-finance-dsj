-- 013: Payment schedule + melhorias no fluxo investidor
-- Cole no Supabase SQL Editor

-- Cronograma de pagamentos (cada parcela de um financiamento)
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

ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_schedule_investor_select ON payment_schedule
    FOR SELECT USING (
        financing_id IN (
            SELECT f.id FROM financings f
            JOIN investors i ON f.investor_id = i.id
            WHERE i.auth_user_id = auth.uid()
        )
    );

-- Vincular convite a um recebivel especifico (produto)
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS receivable_id INT REFERENCES receivables(id);
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS investor_name VARCHAR(200);
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS investor_email VARCHAR(200);
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS message TEXT;

-- Contrato digital nos financiamentos
ALTER TABLE financings ADD COLUMN IF NOT EXISTS contract_text TEXT;
ALTER TABLE financings ADD COLUMN IF NOT EXISTS contract_accepted_at TIMESTAMPTZ;
ALTER TABLE financings ADD COLUMN IF NOT EXISTS contract_ip VARCHAR(45);

-- Statement / extrato do investidor
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

ALTER TABLE investor_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY statements_investor_select ON investor_statements
    FOR SELECT USING (
        investor_id IN (
            SELECT id FROM investors WHERE auth_user_id = auth.uid()
        )
    );

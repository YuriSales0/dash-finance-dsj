-- 008: Investor Metrics and Operation Updates
-- Métricas curadas para investidores + atualizações de operações ativas

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

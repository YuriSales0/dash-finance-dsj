-- 005: Monthly P&L
-- P&L mensal por empresa + consolidado

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

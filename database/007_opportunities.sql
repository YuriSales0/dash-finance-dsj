-- 007: Opportunities and Investments
-- Oportunidades de investimento SCP + investimentos realizados

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

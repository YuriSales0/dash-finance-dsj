-- 004: Classification Rules
-- Regras de classificação (manuais + aprendidas)

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

-- Regras manuais iniciais (counterparty match)
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

-- Regras de intercompany (detecção automática por nome de entidade)
INSERT INTO classification_rules (pattern_type, pattern_value, category_id, source) VALUES
('counterparty', 'DSJ Network', 'transfer_intercompany', 'manual'),
('counterparty', 'Universal MKT', 'transfer_intercompany', 'manual'),
('counterparty', 'DSJ Connect', 'transfer_intercompany', 'manual');

-- Regras de câmbio
INSERT INTO classification_rules (pattern_type, pattern_value, category_id, source) VALUES
('description', 'exchange', 'transfer_fx', 'manual'),
('description', 'FX', 'transfer_fx', 'manual'),
('description', 'conversion', 'transfer_fx', 'manual');

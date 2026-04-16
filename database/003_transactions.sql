-- 003: Transactions
-- Tabela principal de transações bancárias

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

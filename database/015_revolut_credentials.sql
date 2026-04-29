-- 015: Credenciais Revolut por conta
-- Cole no Supabase SQL Editor

CREATE TABLE revolut_credentials (
    id SERIAL PRIMARY KEY,
    bank_account_id VARCHAR(50) NOT NULL UNIQUE REFERENCES bank_accounts(id),
    client_id VARCHAR(100) NOT NULL,
    issuer VARCHAR(200) NOT NULL,
    private_key TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    sandbox BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMPTZ,
    last_sync_count INT,
    last_sync_error TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revolut_creds_account ON revolut_credentials(bank_account_id);

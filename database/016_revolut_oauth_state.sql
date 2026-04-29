-- 016: Permitir credenciais Revolut em estado draft (sem refresh_token ainda)
-- Cole no Supabase SQL Editor

ALTER TABLE revolut_credentials ALTER COLUMN refresh_token DROP NOT NULL;

-- Tabela temporaria para tracking do OAuth state (CSRF protection)
CREATE TABLE IF NOT EXISTS revolut_oauth_state (
    state VARCHAR(64) PRIMARY KEY,
    bank_account_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revolut_oauth_state_expires ON revolut_oauth_state(expires_at);

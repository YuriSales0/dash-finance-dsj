-- 017: Tracking de batches de import (com undo)
-- Cole no Supabase SQL Editor

CREATE TABLE import_batches (
    id SERIAL PRIMARY KEY,
    bank_account_id VARCHAR(50) NOT NULL REFERENCES bank_accounts(id),
    entity_id VARCHAR(30) REFERENCES entities(id),
    format VARCHAR(20),
    file_name TEXT,
    total_rows INT,
    rows_normalized INT,
    rows_imported INT,
    rows_skipped_duplicates INT,
    rows_needs_review INT,
    pnl_months_regenerated TEXT[],
    intercompany_detected INT DEFAULT 0,
    created_by VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reverted_at TIMESTAMPTZ,
    reverted_by VARCHAR(200)
);

CREATE INDEX idx_import_batches_account ON import_batches(bank_account_id);
CREATE INDEX idx_import_batches_created ON import_batches(created_at DESC);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS import_batch_id INT REFERENCES import_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tx_batch ON transactions(import_batch_id);

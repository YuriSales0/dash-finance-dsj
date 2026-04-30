-- 021: Saldo de abertura por conta (saldo antes do CSV importado)
-- balance_current = opening_balance + sum(transactions)

ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance_date DATE;

-- 022: Mapeamento Revolut sub-account → bank_account local
-- Revolut Business retorna multiplas sub-contas (USD/GBP/EUR pockets) na mesma OAuth.
-- Precisamos saber qual sub-conta corresponde a cada bank_account_id local
-- para filtrar as transacoes corretamente no sync.
-- Cole no Supabase SQL Editor

ALTER TABLE revolut_credentials
  ADD COLUMN IF NOT EXISTS revolut_account_id VARCHAR(64);

COMMENT ON COLUMN revolut_credentials.revolut_account_id IS
  'Revolut sub-account UUID (de GET /accounts). Sync importa apenas legs deste account.';

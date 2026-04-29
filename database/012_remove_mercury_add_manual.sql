-- 012: Remover Mercury + habilitar gestao manual de empresas/bancos
-- Cole no Supabase SQL Editor

-- Desativar contas Mercury (nao deletar pra manter integridade referencial)
UPDATE bank_accounts SET active = FALSE WHERE id IN ('dsj_net_mercury', 'dsj_con_mercury');

-- Tornar api_provider opcional (permite 'manual' para gestao sem API)
ALTER TABLE bank_accounts ALTER COLUMN api_provider DROP NOT NULL;
ALTER TABLE bank_accounts ALTER COLUMN api_provider SET DEFAULT 'manual';

-- Permitir api_provider 'manual'
ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_api_provider_check;

-- Adicionar campo para saldo ser editado manualmente
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS manual_balance BOOLEAN DEFAULT FALSE;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS balance_updated_at TIMESTAMPTZ;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS balance_notes TEXT;

-- Marcar contas Revolut como manuais (sem API por enquanto)
UPDATE bank_accounts SET manual_balance = TRUE WHERE api_provider = 'revolut';
UPDATE bank_accounts SET manual_balance = TRUE WHERE api_provider = 'airwallex';

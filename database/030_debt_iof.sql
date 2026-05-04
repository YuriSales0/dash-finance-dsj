-- 030: IOF (Imposto sobre Operacoes Financeiras) em dividas
-- Percentual aplicado sobre o principal, somado ao retorno total ao investidor
-- (ou deduzido na origem, dependendo do contrato)
-- Cole no Supabase SQL Editor

ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS iof_pct DECIMAL(7,4) DEFAULT 0;

COMMENT ON COLUMN debts.iof_pct IS
  'IOF em % sobre o principal (ex: 0.38). Aplicado no calculo do retorno total.';

-- 027: Campo comissao fixa em dividas (para aportes de investidor)
-- Quando um investidor faz aporte, alem dos juros % pode ter uma comissao fixa
-- Ex: R$ 500 de comissao + 5% ao periodo sobre o valor aportado
-- Cole no Supabase SQL Editor

ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS fixed_commission DECIMAL(15,2) DEFAULT 0;

COMMENT ON COLUMN debts.fixed_commission IS
  'Comissao fixa cobrada no aporte (ex: R$ 500). Somada aos juros % para calcular retorno total.';

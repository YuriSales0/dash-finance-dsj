-- 028: Dividas recorrentes (salarios, assinaturas, aluguel)
-- Permite projetar compromissos futuros automaticamente
-- Cole no Supabase SQL Editor

ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_interval VARCHAR(20) DEFAULT NULL
    CHECK (recurrence_interval IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE DEFAULT NULL;

COMMENT ON COLUMN debts.is_recurring IS
  'Se TRUE, esta divida se repete no intervalo definido (ex: salario mensal)';
COMMENT ON COLUMN debts.recurrence_interval IS
  'weekly, biweekly, monthly, quarterly, yearly';
COMMENT ON COLUMN debts.recurrence_end_date IS
  'Data limite da recorrencia (NULL = indefinido)';

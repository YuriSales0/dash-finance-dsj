-- 031: Aportes de investidor nao sao recorrentes
-- Corrige aportes que foram marcados is_recurring por engano.
-- A logica de pagamento parcelado para aportes usa interest_payment_interval,
-- nao is_recurring. is_recurring e para salarios/assinaturas.
-- Cole no Supabase SQL Editor

UPDATE debts
SET
  is_recurring = FALSE,
  recurrence_interval = NULL,
  recurrence_end_date = NULL
WHERE category = 'aporte_investidor';

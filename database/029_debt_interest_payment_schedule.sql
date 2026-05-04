-- 029: Cronograma de pagamento de juros (interest-only com balloon)
-- Para aportes onde o investidor recebe parcelas de juros periodicas
-- e no vencimento final recebe o principal + comissao fixa
-- Cole no Supabase SQL Editor

ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS interest_payment_interval VARCHAR(20) DEFAULT NULL
    CHECK (interest_payment_interval IS NULL OR interest_payment_interval IN
      ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'));

COMMENT ON COLUMN debts.interest_payment_interval IS
  'Frequencia de pagamento dos juros periodicos. Se NULL, juros + principal pagos juntos no vencimento. Se SET, juros pagos no intervalo e principal+comissao pagos no due_date.';

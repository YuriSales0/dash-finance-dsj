-- 026: Corrigir margin_pct DECIMAL(5,2) → DECIMAL(10,2)
-- Bug: se revenue e muito pequena e costs muito alta, margin_pct pode
-- ultrapassar 999.99 (ex: -24600%) e causar numeric overflow no INSERT.
-- v_margin_pct na funcao generate_pnl ja usa DECIMAL(10,2) desde migration 023,
-- mas a coluna da tabela ainda era DECIMAL(5,2).
-- Cole no Supabase SQL Editor

ALTER TABLE monthly_pnl
  ALTER COLUMN margin_pct TYPE DECIMAL(10,2);

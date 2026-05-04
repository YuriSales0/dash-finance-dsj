-- 032: Categoria cost_financial para juros/comissoes pagos a investidores
-- Quando aporte tem juros parcelados, os pagamentos de juros sao custo financeiro,
-- nao operacional. Antes nao havia categoria especifica.
-- Cole no Supabase SQL Editor

INSERT INTO categories (id, group_name, label, affects_pnl) VALUES
  ('cost_financial', 'cost_fixed', 'Juros e comissoes (financeiro)', TRUE)
ON CONFLICT (id) DO NOTHING;

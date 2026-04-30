-- 023: Receita nao pode ser negativa
-- Bug anterior: WHEN c.group_name = 'revenue' THEN t.amount_usd
-- Se uma saida (amount_usd < 0) fosse classificada como revenue, virava
-- receita negativa, gerando P&L absurdo.
--
-- Fix:
--  - Receita = soma apenas das positivas em categorias de revenue
--  - Negativas em revenue (= reembolsos emitidos) viram cost_refunds
-- Cole no Supabase SQL Editor

CREATE OR REPLACE FUNCTION generate_pnl(p_month DATE, p_entity_id VARCHAR(30))
RETURNS void AS $$
DECLARE
    v_revenue DECIMAL(15,2) DEFAULT 0;
    v_cost_ads DECIMAL(15,2) DEFAULT 0;
    v_cost_products DECIMAL(15,2) DEFAULT 0;
    v_cost_shipping DECIMAL(15,2) DEFAULT 0;
    v_cost_gateway DECIMAL(15,2) DEFAULT 0;
    v_cost_chargebacks DECIMAL(15,2) DEFAULT 0;
    v_cost_refunds DECIMAL(15,2) DEFAULT 0;
    v_cost_team DECIMAL(15,2) DEFAULT 0;
    v_cost_saas DECIMAL(15,2) DEFAULT 0;
    v_cost_infra DECIMAL(15,2) DEFAULT 0;
    v_cost_legal DECIMAL(15,2) DEFAULT 0;
    v_cost_other DECIMAL(15,2) DEFAULT 0;
    v_total_costs DECIMAL(15,2);
    v_net_profit DECIMAL(15,2);
    v_margin_pct DECIMAL(10,2);
    v_pending INT;
    v_month_start TIMESTAMPTZ;
    v_month_end TIMESTAMPTZ;
BEGIN
    v_month_start := p_month::TIMESTAMPTZ;
    v_month_end := (p_month + INTERVAL '1 month')::TIMESTAMPTZ;

    SELECT
        -- Revenue: SO positivas em categoria revenue + uncategorized positivas
        -- Negativas em revenue vao pra cost_refunds (regra abaixo)
        COALESCE(SUM(CASE
            WHEN c.group_name = 'revenue' AND t.amount_usd > 0 THEN t.amount_usd
            WHEN t.category_id IS NULL AND t.amount_usd > 0 THEN t.amount_usd
            ELSE 0
        END), 0),
        -- Custos especificos
        COALESCE(SUM(CASE WHEN t.category_id IN ('cost_ads_meta', 'cost_ads_tiktok', 'cost_ads_google') THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_products' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_shipping' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_gateway' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_chargebacks' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        -- cost_refunds inclui:
        --   1. Categoria explicita cost_refunds (sempre absoluto)
        --   2. Negativas em categoria revenue (refunds emitidos pelo merchant)
        COALESCE(SUM(CASE
            WHEN t.category_id = 'cost_refunds' THEN ABS(t.amount_usd)
            WHEN c.group_name = 'revenue' AND t.amount_usd < 0 THEN ABS(t.amount_usd)
            ELSE 0
        END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_team' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_saas' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_infra' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_legal' THEN ABS(t.amount_usd) ELSE 0 END), 0),
        -- cost_other: catch-all
        COALESCE(SUM(CASE
            WHEN c.group_name IN ('cost_variable', 'cost_fixed')
              AND t.category_id NOT IN (
                'cost_ads_meta', 'cost_ads_tiktok', 'cost_ads_google',
                'cost_products', 'cost_shipping', 'cost_gateway',
                'cost_chargebacks', 'cost_refunds',
                'cost_team', 'cost_saas', 'cost_infra', 'cost_legal'
              ) THEN ABS(t.amount_usd)
            WHEN t.category_id IS NULL AND t.amount_usd < 0 THEN ABS(t.amount_usd)
            ELSE 0
        END), 0)
    INTO
        v_revenue, v_cost_ads, v_cost_products, v_cost_shipping,
        v_cost_gateway, v_cost_chargebacks, v_cost_refunds,
        v_cost_team, v_cost_saas, v_cost_infra, v_cost_legal, v_cost_other
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.entity_id = p_entity_id
      AND t.timestamp >= v_month_start
      AND t.timestamp < v_month_end
      AND t.is_intercompany = FALSE
      AND (c.id IS NULL OR c.affects_pnl = TRUE);

    v_total_costs := v_cost_ads + v_cost_products + v_cost_shipping + v_cost_gateway
                   + v_cost_chargebacks + v_cost_refunds + v_cost_team + v_cost_saas
                   + v_cost_infra + v_cost_legal + v_cost_other;
    v_net_profit := v_revenue - v_total_costs;
    v_margin_pct := CASE WHEN v_revenue > 0 THEN (v_net_profit / v_revenue) * 100 ELSE 0 END;

    SELECT COUNT(*) INTO v_pending
    FROM transactions
    WHERE entity_id = p_entity_id
      AND timestamp >= v_month_start
      AND timestamp < v_month_end
      AND needs_review = TRUE;

    INSERT INTO monthly_pnl (month, entity_id, revenue, cost_ads, cost_products, cost_shipping,
        cost_gateway, cost_chargebacks, cost_refunds, cost_team, cost_saas, cost_infra,
        cost_legal, cost_other, total_costs, net_profit, margin_pct, pending_review_count, generated_at)
    VALUES (p_month, p_entity_id, v_revenue, v_cost_ads, v_cost_products, v_cost_shipping,
        v_cost_gateway, v_cost_chargebacks, v_cost_refunds, v_cost_team, v_cost_saas, v_cost_infra,
        v_cost_legal, v_cost_other, v_total_costs, v_net_profit, v_margin_pct, v_pending, NOW())
    ON CONFLICT (month, entity_id) DO UPDATE SET
        revenue = EXCLUDED.revenue, cost_ads = EXCLUDED.cost_ads,
        cost_products = EXCLUDED.cost_products, cost_shipping = EXCLUDED.cost_shipping,
        cost_gateway = EXCLUDED.cost_gateway, cost_chargebacks = EXCLUDED.cost_chargebacks,
        cost_refunds = EXCLUDED.cost_refunds, cost_team = EXCLUDED.cost_team,
        cost_saas = EXCLUDED.cost_saas, cost_infra = EXCLUDED.cost_infra,
        cost_legal = EXCLUDED.cost_legal, cost_other = EXCLUDED.cost_other,
        total_costs = EXCLUDED.total_costs, net_profit = EXCLUDED.net_profit,
        margin_pct = EXCLUDED.margin_pct, pending_review_count = EXCLUDED.pending_review_count,
        generated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Regenerar P&L dos ultimos 12 meses com a logica corrigida
DO $$
DECLARE
  m DATE;
BEGIN
  FOR i IN 0..11 LOOP
    m := date_trunc('month', CURRENT_DATE - (i || ' months')::interval)::date;
    PERFORM generate_consolidated_pnl(m);
  END LOOP;
END $$;

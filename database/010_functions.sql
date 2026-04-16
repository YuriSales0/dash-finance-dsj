-- 010: Stored Functions
-- Funções para geração de P&L e detecção de intercompany

-- Função: Gerar P&L mensal para uma empresa
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
    v_margin_pct DECIMAL(5,2);
    v_pending INT;
    v_month_start TIMESTAMPTZ;
    v_month_end TIMESTAMPTZ;
BEGIN
    v_month_start := p_month::TIMESTAMPTZ;
    v_month_end := (p_month + INTERVAL '1 month')::TIMESTAMPTZ;

    -- Agregar por categoria
    SELECT
        COALESCE(SUM(CASE WHEN c.group_name = 'revenue' THEN t.amount_usd END), 0),
        COALESCE(SUM(CASE WHEN t.category_id IN ('cost_ads_meta', 'cost_ads_tiktok', 'cost_ads_google') THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_products' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_shipping' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_gateway' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_chargebacks' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_refunds' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_team' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_saas' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_infra' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_legal' THEN ABS(t.amount_usd) END), 0),
        COALESCE(SUM(CASE WHEN t.category_id = 'cost_office' THEN ABS(t.amount_usd) END), 0)
    INTO
        v_revenue, v_cost_ads, v_cost_products, v_cost_shipping,
        v_cost_gateway, v_cost_chargebacks, v_cost_refunds,
        v_cost_team, v_cost_saas, v_cost_infra, v_cost_legal, v_cost_other
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.entity_id = p_entity_id
      AND t.timestamp >= v_month_start
      AND t.timestamp < v_month_end
      AND c.affects_pnl = TRUE;

    v_total_costs := v_cost_ads + v_cost_products + v_cost_shipping + v_cost_gateway
                   + v_cost_chargebacks + v_cost_refunds + v_cost_team + v_cost_saas
                   + v_cost_infra + v_cost_legal + v_cost_other;
    v_net_profit := v_revenue - v_total_costs;
    v_margin_pct := CASE WHEN v_revenue > 0 THEN (v_net_profit / v_revenue) * 100 ELSE 0 END;

    -- Contar transações pendentes de review
    SELECT COUNT(*) INTO v_pending
    FROM transactions
    WHERE entity_id = p_entity_id
      AND timestamp >= v_month_start
      AND timestamp < v_month_end
      AND needs_review = TRUE;

    -- Upsert
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

-- Função: Gerar P&L consolidado (soma todas as empresas)
CREATE OR REPLACE FUNCTION generate_consolidated_pnl(p_month DATE)
RETURNS void AS $$
BEGIN
    -- Gerar P&L para cada empresa individual
    PERFORM generate_pnl(p_month, id) FROM entities WHERE id != 'consolidated';

    -- Consolidar somando todas
    INSERT INTO monthly_pnl (month, entity_id, revenue, cost_ads, cost_products, cost_shipping,
        cost_gateway, cost_chargebacks, cost_refunds, cost_team, cost_saas, cost_infra,
        cost_legal, cost_other, total_costs, net_profit, margin_pct, pending_review_count, generated_at)
    SELECT
        p_month, 'consolidated',
        SUM(revenue), SUM(cost_ads), SUM(cost_products), SUM(cost_shipping),
        SUM(cost_gateway), SUM(cost_chargebacks), SUM(cost_refunds), SUM(cost_team),
        SUM(cost_saas), SUM(cost_infra), SUM(cost_legal), SUM(cost_other),
        SUM(total_costs), SUM(net_profit),
        CASE WHEN SUM(revenue) > 0 THEN (SUM(net_profit) / SUM(revenue)) * 100 ELSE 0 END,
        SUM(pending_review_count), NOW()
    FROM monthly_pnl
    WHERE month = p_month AND entity_id != 'consolidated'
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

-- Função: Detectar transações intercompany
-- Busca pares de saída/entrada com mesmo valor (±2%) e ±24h
CREATE OR REPLACE FUNCTION detect_intercompany(p_hours_window INT DEFAULT 48)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT t1.id AS out_id, t2.id AS in_id,
               t1.entity_id AS out_entity, t2.entity_id AS in_entity
        FROM transactions t1
        JOIN transactions t2 ON t1.id != t2.id
        WHERE t1.amount_usd < 0 AND t2.amount_usd > 0
          AND t1.is_intercompany = FALSE AND t2.is_intercompany = FALSE
          AND t1.entity_id != t2.entity_id
          AND ABS(ABS(t1.amount_usd) - t2.amount_usd) / GREATEST(ABS(t1.amount_usd), 0.01) <= 0.02
          AND ABS(EXTRACT(EPOCH FROM (t1.timestamp - t2.timestamp))) <= p_hours_window * 3600
          AND t1.created_at >= NOW() - INTERVAL '1 hour' * p_hours_window
    LOOP
        UPDATE transactions SET
            is_intercompany = TRUE,
            category_id = 'transfer_intercompany',
            classified_by = 'rule',
            classification_confidence = 95,
            linked_transaction_id = rec.in_id,
            counterpart_entity_id = rec.in_entity,
            needs_review = FALSE
        WHERE id = rec.out_id;

        UPDATE transactions SET
            is_intercompany = TRUE,
            category_id = 'transfer_intercompany',
            classified_by = 'rule',
            classification_confidence = 95,
            linked_transaction_id = rec.out_id,
            counterpart_entity_id = rec.out_entity,
            needs_review = FALSE
        WHERE id = rec.in_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Função: Gerar métricas para investidores
CREATE OR REPLACE FUNCTION generate_investor_metrics(p_month DATE)
RETURNS void AS $$
DECLARE
    v_revenue DECIMAL(15,2);
    v_margin DECIMAL(5,2);
    v_active_ops INT;
    v_months_operating INT;
    v_completed INT;
    v_avg_return DECIMAL(5,2);
    v_losses INT;
    v_capital_returned DECIMAL(15,2);
BEGIN
    SELECT revenue, margin_pct INTO v_revenue, v_margin
    FROM monthly_pnl WHERE month = p_month AND entity_id = 'consolidated';

    SELECT COUNT(*) INTO v_active_ops FROM opportunities WHERE status = 'active';

    SELECT COUNT(DISTINCT month) INTO v_months_operating FROM monthly_pnl
    WHERE entity_id = 'consolidated' AND revenue > 0;

    SELECT COUNT(*), COALESCE(AVG(actual_return_pct), 0)
    INTO v_completed, v_avg_return
    FROM opportunities WHERE status = 'completed';

    SELECT COUNT(*) INTO v_losses
    FROM opportunities WHERE status = 'completed' AND actual_return_pct < 0;

    SELECT COALESCE(SUM(return_amount), 0) INTO v_capital_returned
    FROM investments WHERE status = 'returned';

    INSERT INTO investor_metrics (month, total_revenue_usd, margin_pct, active_operations,
        months_operating, opportunities_completed, opportunities_avg_return,
        opportunities_loss_count, total_capital_returned, generated_at)
    VALUES (p_month, COALESCE(v_revenue, 0), COALESCE(v_margin, 0), v_active_ops,
        v_months_operating, v_completed, v_avg_return, v_losses, v_capital_returned, NOW())
    ON CONFLICT (month) DO UPDATE SET
        total_revenue_usd = EXCLUDED.total_revenue_usd, margin_pct = EXCLUDED.margin_pct,
        active_operations = EXCLUDED.active_operations, months_operating = EXCLUDED.months_operating,
        opportunities_completed = EXCLUDED.opportunities_completed,
        opportunities_avg_return = EXCLUDED.opportunities_avg_return,
        opportunities_loss_count = EXCLUDED.opportunities_loss_count,
        total_capital_returned = EXCLUDED.total_capital_returned, generated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 024: Mercury e Airwallex sao bancos de receita — entradas nao sao intercompany
--
-- Regra de negocio: dinheiro ENTRANDO em Mercury ou Airwallex e SEMPRE receita
-- (payouts de Shopify/Stripe, pagamentos de clientes), nunca transferencia
-- entre empresas. detect_intercompany estava marcando esses inflows como
-- intercompany por bater com saidas casuais de outras contas.
--
-- Cole no Supabase SQL Editor

-- ============================================
-- 1. Atualizar detect_intercompany para excluir Mercury/Airwallex
-- ============================================
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
        JOIN bank_accounts ba_in ON t2.bank_account_id = ba_in.id
        WHERE t1.amount_usd < 0 AND t2.amount_usd > 0
          AND t1.is_intercompany = FALSE AND t2.is_intercompany = FALSE
          AND t1.entity_id != t2.entity_id
          AND ABS(ABS(t1.amount_usd) - t2.amount_usd) / GREATEST(ABS(t1.amount_usd), 0.01) <= 0.02
          AND ABS(EXTRACT(EPOCH FROM (t1.timestamp - t2.timestamp))) <= p_hours_window * 3600
          AND t1.created_at >= NOW() - INTERVAL '1 hour' * p_hours_window
          -- Excluir entradas em Mercury/Airwallex (sao receita por definicao)
          AND LOWER(ba_in.bank_name) NOT IN ('mercury', 'airwallex')
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

-- ============================================
-- 2. Limpar transacoes existentes mal-classificadas
-- ============================================
-- Encontra todos os inflows em Mercury/Airwallex que estao marcados como intercompany
-- (provavelmente classificacao errada do detect_intercompany antigo)

-- 2a. Salvar IDs dos pares errados (inflow + outflow)
DO $$
DECLARE
    rec RECORD;
    v_fixed_inflows INT := 0;
    v_freed_outflows INT := 0;
BEGIN
    FOR rec IN
        SELECT t.id AS in_id, t.linked_transaction_id AS out_id
        FROM transactions t
        JOIN bank_accounts ba ON t.bank_account_id = ba.id
        WHERE t.is_intercompany = TRUE
          AND t.amount_usd > 0
          AND LOWER(ba.bank_name) IN ('mercury', 'airwallex')
    LOOP
        -- Re-classificar o inflow como receita
        UPDATE transactions SET
            is_intercompany = FALSE,
            category_id = 'revenue_shopify',
            classified_by = 'rule',
            classification_confidence = 90,
            linked_transaction_id = NULL,
            counterpart_entity_id = NULL,
            needs_review = FALSE
        WHERE id = rec.in_id;
        v_fixed_inflows := v_fixed_inflows + 1;

        -- Liberar o outflow correspondente — manda pra revisao
        IF rec.out_id IS NOT NULL THEN
            UPDATE transactions SET
                is_intercompany = FALSE,
                linked_transaction_id = NULL,
                counterpart_entity_id = NULL,
                category_id = NULL,
                classified_by = NULL,
                classification_confidence = NULL,
                needs_review = TRUE
            WHERE id = rec.out_id;
            v_freed_outflows := v_freed_outflows + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Fixed % inflows (Mercury/Airwallex → revenue), freed % outflows for review',
        v_fixed_inflows, v_freed_outflows;
END $$;

-- ============================================
-- 3. Regenerar P&L dos ultimos 12 meses com a logica corrigida
-- ============================================
DO $$
DECLARE
  m DATE;
BEGIN
  FOR i IN 0..11 LOOP
    m := date_trunc('month', CURRENT_DATE - (i || ' months')::interval)::date;
    PERFORM generate_consolidated_pnl(m);
  END LOOP;
END $$;

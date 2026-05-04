-- 035: Detectar pares FX e reclassificar inflows
-- Quando uma saida foi classificada como transfer_fx, procura a entrada
-- correspondente (mesmo entity, timestamp proximo, moeda diferente)
-- e reclassifica como transfer_fx tambem.
-- Cole no Supabase SQL Editor

CREATE OR REPLACE FUNCTION detect_fx_pairs(p_hours_window INT DEFAULT 48)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        -- Para cada transfer_fx (saida), encontrar uma entrada correspondente
        -- que NAO seja transfer_fx ainda
        SELECT
            t_out.id AS out_id,
            t_in.id AS in_id,
            t_in.category_id AS in_current_category
        FROM transactions t_out
        JOIN transactions t_in ON t_out.id != t_in.id
        WHERE t_out.category_id = 'transfer_fx'
          AND t_out.amount_usd < 0  -- saida
          AND t_in.amount_usd > 0   -- entrada
          AND t_in.category_id != 'transfer_fx'  -- ainda nao classificada como FX
          AND t_in.category_id != 'transfer_interbank' -- nem como interbank
          AND t_out.entity_id = t_in.entity_id  -- mesma empresa
          -- moedas DIFERENTES (senao seria interbank, nao FX)
          AND t_out.currency_original != t_in.currency_original
          -- timestamp proximo
          AND ABS(EXTRACT(EPOCH FROM (t_out.timestamp - t_in.timestamp))) <= p_hours_window * 3600
          -- valor proximo em modulo (tolerancia 15% por causa de taxas de cambio)
          AND ABS(ABS(t_out.amount_usd) - t_in.amount_usd) / GREATEST(ABS(t_out.amount_usd), 0.01) <= 0.15
    LOOP
        UPDATE transactions SET
            category_id = 'transfer_fx',
            classified_by = 'rule',
            classification_confidence = 90,
            needs_review = FALSE
        WHERE id = rec.in_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Rodar imediatamente pra corrigir os inflows FX existentes
SELECT detect_fx_pairs(720);

-- Regenerar P&L dos ultimos 12 meses
DO $$
DECLARE m DATE;
BEGIN
  FOR i IN 0..11 LOOP
    m := date_trunc('month', CURRENT_DATE - (i || ' months')::interval)::date;
    PERFORM generate_consolidated_pnl(m);
  END LOOP;
END $$;

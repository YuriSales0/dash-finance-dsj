-- 025: REGRA DE OURO — Intercompany SOMENTE entre transacoes registradas com
-- evidencia de fato (nome da outra empresa na descricao/counterparty).
--
-- Regra de negocio (do user, ipsis litteris):
--   "INTERCOMPANY É SOMENTE CONSIDERADO PARA TRANSAÇÕES CADASTRADAS NA PLATAFORMA.
--    OUTRA EMPRESA NAO CADASTRADA E SEM SEM DADOS É RECEITA"
--
-- Implementacao:
--   1. detect_intercompany agora exige que a descricao OU counterparty de
--      pelo menos UMA das transacoes mencione o nome (ou parte dele) da
--      OUTRA empresa. Sem isso, e coincidencia de valor — nao intercompany.
--   2. Cleanup: reverte tudo que foi marcado AUTOMATICAMENTE (classified_by='rule')
--      e que NAO atende a regra. NAO mexe em marcacoes manuais (classified_by='human').
--   3. Inflows liberados: vao pra revisao (Mercury/Airwallex sao tratados na 024).
--   4. P&L regenerado.
--
-- Cole no Supabase SQL Editor

-- ============================================
-- 1. Helper: extrai aliases do nome da empresa pra matching robusto
-- ============================================
-- Ex: "DSJ Network LLC" gera ['dsj network llc', 'dsj network', 'dsjnetwork', 'dsj']
-- "Universal MKT LLP" gera ['universal mkt llp', 'universal mkt', 'universalmkt', 'universal']
CREATE OR REPLACE FUNCTION entity_name_in_text(p_text TEXT, p_entity_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_text_lower TEXT;
    v_full_lower TEXT;
    v_no_suffix TEXT;
    v_no_spaces TEXT;
    v_first_two TEXT;
    v_first_word TEXT;
BEGIN
    IF p_text IS NULL OR p_entity_name IS NULL THEN
        RETURN FALSE;
    END IF;

    v_text_lower := LOWER(p_text);
    v_full_lower := LOWER(p_entity_name);

    -- Match nome completo
    IF POSITION(v_full_lower IN v_text_lower) > 0 THEN
        RETURN TRUE;
    END IF;

    -- Sem sufixo legal (LLC, LLP, LTDA, INC, S.A., etc.)
    v_no_suffix := REGEXP_REPLACE(
        v_full_lower,
        '\s+(llc|llp|ltda|ltd|inc|s\.?a\.?|corp|gmbh|sa)\.?$',
        '',
        'i'
    );
    IF v_no_suffix != v_full_lower AND POSITION(v_no_suffix IN v_text_lower) > 0 THEN
        RETURN TRUE;
    END IF;

    -- Sem espacos: "DSJ Network LLC" -> "dsjnetworkllc" e variantes
    v_no_spaces := REPLACE(v_no_suffix, ' ', '');
    IF LENGTH(v_no_spaces) >= 5 AND POSITION(v_no_spaces IN REPLACE(v_text_lower, ' ', '')) > 0 THEN
        RETURN TRUE;
    END IF;

    -- Primeiras duas palavras (ex: "DSJ Network" sem o LLC)
    v_first_two := SPLIT_PART(v_no_suffix, ' ', 1) || ' ' || SPLIT_PART(v_no_suffix, ' ', 2);
    IF v_first_two != ' ' AND LENGTH(v_first_two) >= 5 AND POSITION(v_first_two IN v_text_lower) > 0 THEN
        RETURN TRUE;
    END IF;

    -- Primeira palavra MAS so se for distintiva (>= 6 chars; "DSJ" sozinho e ambiguo)
    v_first_word := SPLIT_PART(v_no_suffix, ' ', 1);
    IF LENGTH(v_first_word) >= 6 AND POSITION(v_first_word IN v_text_lower) > 0 THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 2. detect_intercompany com regra estrita (nome + valor + janela + Mercury/Airwallex excluidos)
-- ============================================
CREATE OR REPLACE FUNCTION detect_intercompany(p_hours_window INT DEFAULT 48)
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT t1.id AS out_id, t2.id AS in_id,
               t1.entity_id AS out_entity, t2.entity_id AS in_entity,
               e_in.name AS in_entity_name, e_out.name AS out_entity_name
        FROM transactions t1
        JOIN transactions t2 ON t1.id != t2.id
        JOIN bank_accounts ba_in ON t2.bank_account_id = ba_in.id
        JOIN entities e_in ON t2.entity_id = e_in.id
        JOIN entities e_out ON t1.entity_id = e_out.id
        WHERE t1.amount_usd < 0 AND t2.amount_usd > 0
          AND t1.is_intercompany = FALSE AND t2.is_intercompany = FALSE
          AND t1.entity_id != t2.entity_id
          -- Match de valor (2% de tolerancia)
          AND ABS(ABS(t1.amount_usd) - t2.amount_usd) / GREATEST(ABS(t1.amount_usd), 0.01) <= 0.02
          -- Janela de tempo
          AND ABS(EXTRACT(EPOCH FROM (t1.timestamp - t2.timestamp))) <= p_hours_window * 3600
          AND t1.created_at >= NOW() - INTERVAL '1 hour' * p_hours_window
          -- Mercury/Airwallex sao receita (regra 024)
          AND LOWER(ba_in.bank_name) NOT IN ('mercury', 'airwallex')
          -- REGRA DE OURO: pelo menos UMA das transacoes tem que mencionar o nome da OUTRA empresa
          AND (
            entity_name_in_text(
              COALESCE(t1.description, '') || ' ' || COALESCE(t1.counterparty, ''),
              e_in.name
            )
            OR entity_name_in_text(
              COALESCE(t2.description, '') || ' ' || COALESCE(t2.counterparty, ''),
              e_out.name
            )
          )
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
-- 3. Cleanup: reverter intercompany AUTOMATICOS que nao atendem a regra
-- ============================================
-- IMPORTANTE: nao mexe em marcacoes manuais (classified_by='human')
DO $$
DECLARE
    rec RECORD;
    v_reverted_pairs INT := 0;
    v_in_text TEXT;
    v_out_text TEXT;
    v_in_match BOOLEAN;
    v_out_match BOOLEAN;
BEGIN
    FOR rec IN
        SELECT
            t.id AS in_id,
            t.linked_transaction_id AS out_id,
            t.entity_id AS in_entity,
            t.description AS in_desc,
            t.counterparty AS in_cp,
            t.bank_account_id AS in_bank,
            t2.entity_id AS out_entity,
            t2.description AS out_desc,
            t2.counterparty AS out_cp,
            e_in.name AS in_name,
            e_out.name AS out_name,
            ba_in.bank_name AS in_bank_name
        FROM transactions t
        JOIN transactions t2 ON t.linked_transaction_id = t2.id
        JOIN entities e_in ON t.entity_id = e_in.id
        JOIN entities e_out ON t2.entity_id = e_out.id
        JOIN bank_accounts ba_in ON t.bank_account_id = ba_in.id
        WHERE t.is_intercompany = TRUE
          AND t.amount_usd > 0  -- escolhe apenas o lado inflow (evita processar pares 2x)
          AND t.classified_by = 'rule'  -- NAO mexe em marcacoes humanas
          AND t2.classified_by = 'rule'
    LOOP
        v_in_text := COALESCE(rec.in_desc, '') || ' ' || COALESCE(rec.in_cp, '');
        v_out_text := COALESCE(rec.out_desc, '') || ' ' || COALESCE(rec.out_cp, '');
        v_in_match := entity_name_in_text(v_in_text, rec.out_name);
        v_out_match := entity_name_in_text(v_out_text, rec.in_name);

        -- Se Mercury/Airwallex no inflow OU nao tem evidencia de nome, reverte
        IF LOWER(rec.in_bank_name) IN ('mercury', 'airwallex')
           OR (NOT v_in_match AND NOT v_out_match) THEN

            -- Inflow: vira receita se Mercury/Airwallex, senao needs_review
            IF LOWER(rec.in_bank_name) IN ('mercury', 'airwallex') THEN
                UPDATE transactions SET
                    is_intercompany = FALSE,
                    category_id = 'revenue_shopify',
                    classified_by = 'rule',
                    classification_confidence = 90,
                    linked_transaction_id = NULL,
                    counterpart_entity_id = NULL,
                    needs_review = FALSE
                WHERE id = rec.in_id;
            ELSE
                UPDATE transactions SET
                    is_intercompany = FALSE,
                    category_id = NULL,
                    classified_by = NULL,
                    classification_confidence = NULL,
                    linked_transaction_id = NULL,
                    counterpart_entity_id = NULL,
                    needs_review = TRUE
                WHERE id = rec.in_id;
            END IF;

            -- Outflow: vai pra revisao
            UPDATE transactions SET
                is_intercompany = FALSE,
                category_id = NULL,
                classified_by = NULL,
                classification_confidence = NULL,
                linked_transaction_id = NULL,
                counterpart_entity_id = NULL,
                needs_review = TRUE
            WHERE id = rec.out_id;

            v_reverted_pairs := v_reverted_pairs + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Reverted % auto-marked intercompany pairs (no name evidence or Mercury/Airwallex inflow)',
        v_reverted_pairs;
END $$;

-- ============================================
-- 4. Regenerar P&L 12 meses
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

-- Migration 036: FK cascades + DebtStatus enum alignment
-- Fixes from auditoria geral: S1 (FK cascade) + S2 (status enum)

-- =================================================================
-- S1: payment_schedule + investor_statements precisam de ON DELETE CASCADE
-- pra evitar registros orfaos quando um financing e deletado.
--
-- Hoje a app contorna isso deletando manualmente em /api/admin/cleanup-
-- test-data antes de deletar financings, mas qualquer DELETE direto via
-- SQL viola integridade. Vamos formalizar a cascata.
-- =================================================================

-- Drop e recria FK de payment_schedule.financing_id com CASCADE
ALTER TABLE payment_schedule
  DROP CONSTRAINT IF EXISTS payment_schedule_financing_id_fkey;
ALTER TABLE payment_schedule
  ADD CONSTRAINT payment_schedule_financing_id_fkey
  FOREIGN KEY (financing_id) REFERENCES financings(id) ON DELETE CASCADE;

-- Mesmo pra investor_statements.financing_id
ALTER TABLE investor_statements
  DROP CONSTRAINT IF EXISTS investor_statements_financing_id_fkey;
ALTER TABLE investor_statements
  ADD CONSTRAINT investor_statements_financing_id_fkey
  FOREIGN KEY (financing_id) REFERENCES financings(id) ON DELETE CASCADE;

-- =================================================================
-- S2: alinhar enum DebtStatus com ReceivableStatus.
--
-- Receivable aceita: pending|partial|paid|overdue|defaulted (5)
-- Debt aceita: pending|partial|paid|overdue (4) — falta 'defaulted'
--
-- Adicionamos 'defaulted' a Debt pra sinalizar dividas declaradas
-- inadimplentes (foi pra cobranca, perdas, etc) sem confundir com
-- 'overdue' (que e estado transiente).
-- =================================================================

ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_status_check;
ALTER TABLE debts
  ADD CONSTRAINT debts_status_check
  CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'defaulted'));

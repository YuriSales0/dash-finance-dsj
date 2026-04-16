-- Reset: DROP tudo e recria (APENAS DEV!)
-- CUIDADO: Destroi todos os dados

DROP FUNCTION IF EXISTS generate_investor_metrics(DATE);
DROP FUNCTION IF EXISTS detect_intercompany(INT);
DROP FUNCTION IF EXISTS generate_consolidated_pnl(DATE);
DROP FUNCTION IF EXISTS generate_pnl(DATE, VARCHAR);

DROP TABLE IF EXISTS operation_updates CASCADE;
DROP TABLE IF EXISTS investor_metrics CASCADE;
DROP TABLE IF EXISTS investments CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS invite_codes CASCADE;
DROP TABLE IF EXISTS investors CASCADE;
DROP TABLE IF EXISTS monthly_pnl CASCADE;
DROP TABLE IF EXISTS classification_rules CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS entities CASCADE;

-- Agora executar seed.sql para recriar tudo
\i seed.sql

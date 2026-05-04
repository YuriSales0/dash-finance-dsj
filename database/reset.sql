-- Reset: DROP tudo e recria (APENAS DEV!)
-- CUIDADO: Destroi todos os dados
-- Atualizado: inclui todas as tabelas/funcoes de migrations 001-026

-- Funcoes
DROP FUNCTION IF EXISTS generate_investor_metrics(DATE);
DROP FUNCTION IF EXISTS detect_intercompany(INT);
DROP FUNCTION IF EXISTS generate_consolidated_pnl(DATE);
DROP FUNCTION IF EXISTS generate_pnl(DATE, VARCHAR);
DROP FUNCTION IF EXISTS entity_name_in_text(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_my_role();
DROP FUNCTION IF EXISTS update_receivable_raised();

-- Tabelas (ordem inversa de dependencias)
DROP TABLE IF EXISTS revolut_oauth_state CASCADE;
DROP TABLE IF EXISTS revolut_credentials CASCADE;
DROP TABLE IF EXISTS import_batches CASCADE;
DROP TABLE IF EXISTS investor_statements CASCADE;
DROP TABLE IF EXISTS payment_schedule CASCADE;
DROP TABLE IF EXISTS platform_settings CASCADE;
DROP TABLE IF EXISTS risk_metrics CASCADE;
DROP TABLE IF EXISTS financings CASCADE;
DROP TABLE IF EXISTS debts CASCADE;
DROP TABLE IF EXISTS receivables CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
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

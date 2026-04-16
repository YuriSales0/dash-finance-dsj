-- Seed: Executa todas as migrations em ordem
-- Usar: psql -f seed.sql ou colar no Supabase SQL Editor

\i 001_entities_and_accounts.sql
\i 002_categories.sql
\i 003_transactions.sql
\i 004_classification_rules.sql
\i 005_monthly_pnl.sql
\i 006_investors.sql
\i 007_opportunities.sql
\i 008_investor_metrics.sql
\i 009_rls_policies.sql
\i 010_functions.sql

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
\i 011_roles_and_receivables.sql
\i 012_remove_mercury_add_manual.sql
\i 013_payment_schedule.sql
\i 014_platform_settings.sql
\i 015_revolut_credentials.sql
\i 016_revolut_oauth_state.sql
\i 017_import_batches.sql
\i 018_pnl_includes_uncategorized.sql
\i 019_admin_rls_policies.sql
\i 020_pnl_catchall_costs.sql
\i 021_opening_balance.sql
\i 022_revolut_account_id.sql
\i 023_pnl_revenue_never_negative.sql
\i 024_mercury_airwallex_are_revenue.sql
\i 025_strict_intercompany_rule.sql
\i 026_margin_pct_overflow.sql

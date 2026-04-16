-- 002: Categories
-- Categorias de transações para classificação

CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    group_name VARCHAR(20) NOT NULL CHECK (group_name IN ('revenue', 'cost_variable', 'cost_fixed', 'transfer', 'investment')),
    label VARCHAR(100) NOT NULL,
    affects_pnl BOOLEAN NOT NULL DEFAULT TRUE
);

-- Receitas
INSERT INTO categories VALUES
('revenue_shopify', 'revenue', 'Vendas Shopify (payouts)', TRUE),
('revenue_other', 'revenue', 'Outras receitas', TRUE);

-- Custos variáveis
INSERT INTO categories VALUES
('cost_ads_meta', 'cost_variable', 'Meta Ads', TRUE),
('cost_ads_tiktok', 'cost_variable', 'TikTok Ads', TRUE),
('cost_ads_google', 'cost_variable', 'Google Ads', TRUE),
('cost_products', 'cost_variable', 'Custo produto (fornecedores)', TRUE),
('cost_shipping', 'cost_variable', 'Frete + embalagem', TRUE),
('cost_gateway', 'cost_variable', 'Taxas gateway/processador', TRUE),
('cost_chargebacks', 'cost_variable', 'Chargebacks', TRUE),
('cost_refunds', 'cost_variable', 'Reembolsos', TRUE);

-- Custos fixos
INSERT INTO categories VALUES
('cost_team', 'cost_fixed', 'Team (salários, freelancers)', TRUE),
('cost_saas', 'cost_fixed', 'SaaS (Shopify, MSync, ferramentas)', TRUE),
('cost_infra', 'cost_fixed', 'Infraestrutura (hosting, domínios)', TRUE),
('cost_legal', 'cost_fixed', 'Legal + contabilidade', TRUE),
('cost_office', 'cost_fixed', 'Escritório + operacional', TRUE);

-- Transferências (não afetam P&L)
INSERT INTO categories VALUES
('transfer_intercompany', 'transfer', 'Transferência entre empresas', FALSE),
('transfer_interbank', 'transfer', 'Transferência entre bancos (mesma empresa)', FALSE),
('transfer_fx', 'transfer', 'Câmbio (conversão de moeda)', FALSE);

-- Investimento (não afetam P&L)
INSERT INTO categories VALUES
('investment_scp_in', 'investment', 'Aporte investidor SCP', FALSE),
('investment_scp_out', 'investment', 'Retorno investidor SCP', FALSE);

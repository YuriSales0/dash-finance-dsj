-- 014: Tabela de configuracoes da plataforma (inclui contrato)
-- Cole no Supabase SQL Editor

CREATE TABLE platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by VARCHAR(200),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contrato vazio = sistema pede para adicionar
INSERT INTO platform_settings (key, value) VALUES
('contract_template', ''),
('contract_version', '0'),
('platform_name', 'DSJ Finance'),
('min_investment_default', '1000');

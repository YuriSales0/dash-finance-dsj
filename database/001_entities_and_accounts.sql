-- 001: Entities and Bank Accounts
-- Empresas do grupo + contas bancárias

CREATE TABLE entities (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    jurisdiction VARCHAR(100),
    currency_default VARCHAR(3) NOT NULL
);

INSERT INTO entities VALUES
('dsj_network', 'DSJ Network LLC', 'Florida, USA', 'USD'),
('universal_mkt', 'Universal MKT LLP', 'London, UK', 'GBP'),
('dsj_connect', 'DSJ Connect LLC', 'Delaware, USA', 'USD'),
('consolidated', 'Consolidated', NULL, 'USD');

CREATE TABLE bank_accounts (
    id VARCHAR(50) PRIMARY KEY,
    entity_id VARCHAR(30) NOT NULL REFERENCES entities(id),
    bank_name VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    api_provider VARCHAR(20) NOT NULL,
    last_synced_at TIMESTAMPTZ,
    balance_current DECIMAL(15,2) DEFAULT 0,
    balance_available DECIMAL(15,2) DEFAULT 0,
    active BOOLEAN DEFAULT TRUE
);

INSERT INTO bank_accounts VALUES
('dsj_net_mercury', 'dsj_network', 'Mercury', 'USD', 'mercury', NULL, 0, 0, TRUE),
('dsj_net_revolut', 'dsj_network', 'Revolut', 'USD', 'revolut', NULL, 0, 0, TRUE),
('uni_mkt_airwallex', 'universal_mkt', 'Airwallex', 'GBP', 'airwallex', NULL, 0, 0, TRUE),
('uni_mkt_revolut', 'universal_mkt', 'Revolut', 'GBP', 'revolut', NULL, 0, 0, TRUE),
('dsj_con_mercury', 'dsj_connect', 'Mercury', 'USD', 'mercury', NULL, 0, 0, TRUE);

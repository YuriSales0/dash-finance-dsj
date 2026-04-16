# SPEC: SISTEMA FINANCEIRO AI-FIRST
## Bookkeeping unificado + plataforma de investimento privado (SCP)

## 1. ENTIDADES E CONTAS

### Empresas

```
DSJ Network LLC
  Jurisdição: Florida, USA
  Bancos: Mercury (USD) + Revolut (USD)
  Papel: operação principal de e-commerce

Universal MKT LLP
  Jurisdição: London, UK
  Bancos: Airwallex (GBP) + Revolut (GBP)
  Papel: marketing e operação UK/EU

DSJ Connect LLC
  Jurisdição: Delaware, USA
  Banco: Mercury (USD)
  Papel: infraestrutura e tecnologia
```

### Conexão com APIs dos bancos

#### Mercury (2 contas: DSJ Network + DSJ Connect)
```
Base URL: https://api.mercury.com/api/v1
Auth: Bearer token (API key)

GET /accounts
→ [{ id, name, current_balance, available_balance, currency }]

GET /account/{id}/transactions?offset=0&limit=50&start=2026-01-01&end=2026-04-15
→ [{ id, amount, counterparty_name, note, posted_at, status, kind }]

Frequência de sync: a cada 1h via cron N8N
Webhook disponível: sim (transaction.created)
```

#### Revolut Business (2 contas: DSJ Network USD + Universal GBP)
```
Base URL: https://b2b.revolut.com/api/1.0
Auth: OAuth2 (access_token + refresh_token)

GET /accounts
→ [{ id, name, balance, currency, state }]

GET /transactions?from=2026-01-01&to=2026-04-15&type=card_payment,transfer,exchange
→ [{ id, type, amount, currency, description, created_at, counterparty }]

GET /rate?from=GBP&to=USD&amount=1
→ { rate, amount }

Frequência: a cada 1h
Webhook: sim (TransactionCreated)
```

#### Airwallex (1 conta: Universal MKT)
```
Base URL: https://api.airwallex.com/api/v1
Auth: API key + client_id → Bearer token (login endpoint)

POST /authentication/login
→ { token, expires_at }

GET /balances/current
→ [{ available_amount, currency, pending_amount }]

GET /financial_transactions?from_created_at=2026-01-01&page_num=0&page_size=50
→ [{ id, amount, currency, transaction_date, source, status }]

Frequência: a cada 1h
Webhook: sim (financial_transaction.completed)
```

## 2. SCHEMA DO BANCO DE DADOS

```sql
CREATE TABLE entities (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    jurisdiction VARCHAR(100),
    currency_default VARCHAR(3) NOT NULL
);

INSERT INTO entities VALUES
('dsj_network', 'DSJ Network LLC', 'Florida, USA', 'USD'),
('universal_mkt', 'Universal MKT LLP', 'London, UK', 'GBP'),
('dsj_connect', 'DSJ Connect LLC', 'Delaware, USA', 'USD');

CREATE TABLE bank_accounts (
    id VARCHAR(50) PRIMARY KEY,
    entity_id VARCHAR(30) REFERENCES entities(id),
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

CREATE TABLE categories (
    id VARCHAR(50) PRIMARY KEY,
    group_name VARCHAR(20) NOT NULL CHECK (group_name IN ('revenue', 'cost_variable', 'cost_fixed', 'transfer', 'investment')),
    label VARCHAR(100) NOT NULL,
    affects_pnl BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO categories VALUES
('revenue_shopify', 'revenue', 'Vendas Shopify (payouts)', TRUE),
('revenue_other', 'revenue', 'Outras receitas', TRUE),
('cost_ads_meta', 'cost_variable', 'Meta Ads', TRUE),
('cost_ads_tiktok', 'cost_variable', 'TikTok Ads', TRUE),
('cost_ads_google', 'cost_variable', 'Google Ads', TRUE),
('cost_products', 'cost_variable', 'Custo produto (fornecedores)', TRUE),
('cost_shipping', 'cost_variable', 'Frete + embalagem', TRUE),
('cost_gateway', 'cost_variable', 'Taxas gateway/processador', TRUE),
('cost_chargebacks', 'cost_variable', 'Chargebacks', TRUE),
('cost_refunds', 'cost_variable', 'Reembolsos', TRUE),
('cost_team', 'cost_fixed', 'Team (salários, freelancers)', TRUE),
('cost_saas', 'cost_fixed', 'SaaS (Shopify, MSync, ferramentas)', TRUE),
('cost_infra', 'cost_fixed', 'Infraestrutura (hosting, domínios)', TRUE),
('cost_legal', 'cost_fixed', 'Legal + contabilidade', TRUE),
('cost_office', 'cost_fixed', 'Escritório + operacional', TRUE),
('transfer_intercompany', 'transfer', 'Transferência entre empresas', FALSE),
('transfer_interbank', 'transfer', 'Transferência entre bancos (mesma empresa)', FALSE),
('transfer_fx', 'transfer', 'Câmbio (conversão de moeda)', FALSE),
('investment_scp_in', 'investment', 'Aporte investidor SCP', FALSE),
('investment_scp_out', 'investment', 'Retorno investidor SCP', FALSE);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(200) UNIQUE,
    bank_account_id VARCHAR(50) REFERENCES bank_accounts(id),
    entity_id VARCHAR(30) REFERENCES entities(id),
    timestamp TIMESTAMPTZ NOT NULL,
    description TEXT,
    counterparty VARCHAR(200),
    amount_original DECIMAL(15,2) NOT NULL,
    currency_original VARCHAR(3) NOT NULL,
    amount_usd DECIMAL(15,2) NOT NULL,
    fx_rate DECIMAL(10,6) DEFAULT 1.0,
    category_id VARCHAR(50) REFERENCES categories(id),
    is_intercompany BOOLEAN DEFAULT FALSE,
    counterpart_entity_id VARCHAR(30) REFERENCES entities(id),
    classified_by VARCHAR(10) CHECK (classified_by IN ('ai', 'human', 'rule')),
    classification_confidence DECIMAL(5,2),
    needs_review BOOLEAN DEFAULT FALSE,
    reviewed_by VARCHAR(50),
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_entity ON transactions(entity_id);
CREATE INDEX idx_tx_timestamp ON transactions(timestamp);
CREATE INDEX idx_tx_category ON transactions(category_id);
CREATE INDEX idx_tx_review ON transactions(needs_review) WHERE needs_review = TRUE;

CREATE TABLE classification_rules (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(20) CHECK (pattern_type IN ('counterparty', 'description', 'amount_range', 'combined')),
    pattern_value TEXT NOT NULL,
    category_id VARCHAR(50) REFERENCES categories(id),
    entity_id VARCHAR(30) REFERENCES entities(id),
    source VARCHAR(10) CHECK (source IN ('manual', 'learned')),
    times_applied INT DEFAULT 0,
    times_overridden INT DEFAULT 0,
    accuracy DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN (times_applied + times_overridden) > 0
        THEN times_applied::decimal / (times_applied + times_overridden) * 100
        ELSE 100 END
    ) STORED,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO classification_rules (pattern_type, pattern_value, category_id, source) VALUES
('counterparty', 'Shopify', 'revenue_shopify', 'manual'),
('counterparty', 'Meta Platforms', 'cost_ads_meta', 'manual'),
('counterparty', 'Facebook', 'cost_ads_meta', 'manual'),
('counterparty', 'TikTok', 'cost_ads_tiktok', 'manual'),
('counterparty', 'Google Ads', 'cost_ads_google', 'manual'),
('counterparty', 'CJ Dropshipping', 'cost_products', 'manual'),
('counterparty', 'Zendrop', 'cost_products', 'manual'),
('counterparty', 'Stripe', 'cost_gateway', 'manual'),
('counterparty', 'PayPal', 'cost_gateway', 'manual'),
('counterparty', 'Shopify bill', 'cost_saas', 'manual');

CREATE TABLE monthly_pnl (
    id SERIAL PRIMARY KEY,
    month DATE NOT NULL,
    entity_id VARCHAR(30) REFERENCES entities(id),
    revenue DECIMAL(15,2) DEFAULT 0,
    cost_ads DECIMAL(15,2) DEFAULT 0,
    cost_products DECIMAL(15,2) DEFAULT 0,
    cost_shipping DECIMAL(15,2) DEFAULT 0,
    cost_gateway DECIMAL(15,2) DEFAULT 0,
    cost_chargebacks DECIMAL(15,2) DEFAULT 0,
    cost_refunds DECIMAL(15,2) DEFAULT 0,
    cost_team DECIMAL(15,2) DEFAULT 0,
    cost_saas DECIMAL(15,2) DEFAULT 0,
    cost_infra DECIMAL(15,2) DEFAULT 0,
    cost_legal DECIMAL(15,2) DEFAULT 0,
    cost_other DECIMAL(15,2) DEFAULT 0,
    total_costs DECIMAL(15,2) DEFAULT 0,
    net_profit DECIMAL(15,2) DEFAULT 0,
    margin_pct DECIMAL(5,2) DEFAULT 0,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(month, entity_id)
);

CREATE TABLE investors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(200) NOT NULL,
    phone VARCHAR(20),
    bank_name VARCHAR(100),
    bank_agency VARCHAR(10),
    bank_account VARCHAR(20),
    pix_key VARCHAR(100),
    invite_code VARCHAR(20),
    invited_by INT REFERENCES investors(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    approved_by VARCHAR(50),
    approved_at TIMESTAMPTZ,
    total_invested DECIMAL(15,2) DEFAULT 0,
    total_returned DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE opportunities (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    product_name VARCHAR(200),
    target_amount DECIMAL(15,2) NOT NULL,
    raised_amount DECIMAL(15,2) DEFAULT 0,
    min_investment DECIMAL(15,2) DEFAULT 2500,
    duration_days INT NOT NULL,
    return_estimate_min DECIMAL(5,2),
    return_estimate_max DECIMAL(5,2),
    proven_roas DECIMAL(5,2),
    proven_margin DECIMAL(5,2),
    proven_sales INT,
    proven_chargeback_rate DECIMAL(5,2),
    allocation_ads_pct INT,
    allocation_products_pct INT,
    allocation_shipping_pct INT,
    allocation_reserve_pct INT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'funded', 'active', 'completed', 'cancelled')),
    risks_description TEXT,
    created_by VARCHAR(50),
    opened_at TIMESTAMPTZ,
    funded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_return_pct DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE investments (
    id SERIAL PRIMARY KEY,
    investor_id INT REFERENCES investors(id),
    opportunity_id INT REFERENCES opportunities(id),
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'active', 'returned', 'partial_loss')),
    contract_signed_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    return_amount DECIMAL(15,2),
    return_pct DECIMAL(5,2),
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invite_codes (
    code VARCHAR(20) PRIMARY KEY,
    created_by VARCHAR(50),
    used_by INT REFERENCES investors(id),
    used_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE investor_metrics (
    id SERIAL PRIMARY KEY,
    month DATE NOT NULL UNIQUE,
    total_revenue_usd DECIMAL(15,2),
    margin_pct DECIMAL(5,2),
    active_operations INT,
    months_operating INT,
    opportunities_completed INT,
    opportunities_avg_return DECIMAL(5,2),
    opportunities_loss_count INT DEFAULT 0,
    total_capital_returned DECIMAL(15,2),
    visible BOOLEAN DEFAULT TRUE,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE operation_updates (
    id SERIAL PRIMARY KEY,
    opportunity_id INT REFERENCES opportunities(id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    revenue_generated DECIMAL(15,2),
    current_roas DECIMAL(5,2),
    current_margin DECIMAL(5,2),
    chargeback_rate DECIMAL(5,2),
    projected_return_pct DECIMAL(5,2),
    status_note TEXT,
    ai_status TEXT,
    visible_to_investor BOOLEAN DEFAULT TRUE
);
```

## 3. CLASSIFICAÇÃO AI DE TRANSAÇÕES

### Fluxo de classificação

```
1. Transação nova entra (via API do banco ou webhook)
2. Primeiro: checar regras existentes (classification_rules)
   - Se counterparty match exato → aplicar regra, confidence 100%, classified_by: "rule"
   - Se counterparty match parcial → aplicar regra, confidence 85%
3. Se nenhuma regra match: enviar pra Claude API (Haiku)
4. Se confidence < 70%: marcar needs_review = true
5. Se humano corrigir: criar nova regra em classification_rules com source: "learned"
```

### Detecção de intercompany

```
Regra automática (antes da AI):
- Se transação de saída no banco X e transação de entrada no banco Y
  com mesmo valor (±2%) e ±24h de diferença
  → marcar AMBAS como intercompany/interbank
  → linkar uma à outra
```

## 4. GERAÇÃO AUTOMÁTICA DE P&L

### Workflow N8N: gerar P&L mensal

```
Cron: dia 1 de cada mês às 06:00 UTC (gera P&L do mês anterior)
Também: botão manual "gerar P&L agora" no dashboard

1. Para cada empresa:
   a. SELECT SUM(amount_usd) FROM transactions
      WHERE entity_id = X AND month = Y
      GROUP BY category_id

   b. Mapear categorias para colunas do P&L:
      - revenue = SUM onde group_name = 'revenue'
      - cost_ads = SUM de cost_ads_meta + cost_ads_tiktok + cost_ads_google
      - cost_products = SUM de cost_products
      - etc.

   c. total_costs = soma de todos os custos
   d. net_profit = revenue - total_costs
   e. margin_pct = (net_profit / revenue) * 100

   f. UPSERT em monthly_pnl

2. Gerar P&L consolidado:
   - Somar todas as empresas (já em USD)
   - Salvar com entity_id = 'consolidated'

3. Gerar investor_metrics do mês:
   - total_revenue_usd = consolidado
   - margin_pct = consolidado
   - active_operations = COUNT opportunities WHERE status = 'active'
   - etc.
```

## 5. PLATAFORMA DE INVESTIMENTO (SCP)

### Fluxo do investidor

```
1. CONVITE: admin gera código (6 chars, uso único). Envia pessoalmente. URL não indexada.
2. CADASTRO: nome, CPF, email, telefone, dados bancários, aceitar termos SCP.
3. APROVAÇÃO: admin aprova manualmente. Se não conhece a pessoa → rejeitar.
4. INVESTIR: escolhe oportunidade, define valor (≥ mínimo), assina contrato SCP digital, transfere PIX/TED, admin confirma.
5. ACOMPANHAR: métricas ao vivo da operação, projeção de retorno, log de atividades.
6. RECEBER: operação conclui, admin calcula retorno real, transfere, marca como returned.
7. REINVESTIR: ciclo recomeça.
```

### Dados que o investidor VÊ
- Receita mensal consolidada
- Margem operacional
- Operações ativas
- Meses operando
- Histórico retorno médio
- Operações com perda (zero)
- Capital total retornado
- Gráfico receita 12 meses
- Oportunidades abertas
- Suas operações ativas (ROAS, margem, projeção)

### Dados que o investidor NÃO VÊ
- Saldos bancários individuais
- Transações individuais
- Salários equipe
- Detalhes fornecedores
- Transfers intercompany
- Payments caídos
- Runway / burn rate
- P&L por empresa separado

### Segurança
- URL não indexada (robots noindex nofollow)
- Acesso apenas por código de convite
- Login: CPF + senha
- Sessão expira em 24h
- Audit trail de todas ações
- Contrato SCP com hash de integridade
- Cláusula de confidencialidade no contrato
- Admin pode suspender investidor

## 6. DASHBOARD ADMIN

### Tela 1: Visão consolidada
- Saldo total (5 contas, convertido USD)
- Saldo por empresa (com detalhamento por banco)
- Burn rate mensal
- Runway (saldo / burn rate)
- Receita do mês atual
- Gráfico: receita x custos últimos 12 meses
- Alertas: transações pendentes de review, runway < 2 meses

### Tela 2: Por empresa
- Seletor: DSJ Network | Universal MKT | DSJ Connect | Consolidado
- P&L do mês atual + meses anteriores
- Lista de transações recentes com categorias
- Gráfico: composição de custos

### Tela 3: Transações
- Lista completa (5 bancos)
- Filtros: empresa, banco, categoria, data, valor, status review
- Aba: "Pendentes de review"
- Ação: corrigir categoria → salva regra aprendida
- Ação: marcar como intercompany
- Busca por descrição/contraparte

### Tela 4: Plataforma investimento (admin)
- Gerar códigos de convite
- Aprovar/rejeitar cadastros
- Criar oportunidade (puxa métricas do bookkeeping)
- Gerenciar operações ativas
- Marcar pagamentos de retorno
- Dashboard: total captado, retornado, investidores ativos

### Tela 5: Preview vitrine
- Preview do que investidor vê
- Toggle: mostrar/ocultar cada métrica
- Editar texto da oportunidade

## 7. WORKFLOWS N8N

### 7.1 Sync transações dos bancos

```
Nome: sync-bank-transactions
Trigger: Cron a cada 1h + Webhook manual

Para cada banco (Mercury x2, Revolut x2, Airwallex x1):
  1. HTTP Request: GET transações desde last_synced_at
  2. Loop cada transação:
     a. Dedup por external_id
     b. Se GBP: GET taxa câmbio → calcular amount_usd
     c. Tentar classificar por regras (classification_rules WHERE pattern match)
     d. Se sem match: Claude API Haiku → classificar
     e. Se confidence < 70: needs_review = true
     f. INSERT transaction
  3. UPDATE bank_accounts SET last_synced_at, balance
```

### 7.2 Detectar intercompany

```
Nome: detect-intercompany
Trigger: após cada sync

1. Buscar transações últimas 48h não marcadas como intercompany
2. Para cada saída, procurar entrada correspondente: mesmo valor ±2%, timestamp ±24h, entidades/bancos diferentes
3. Se match: UPDATE ambas como intercompany
```

### 7.3 Gerar P&L

```
Nome: generate-pnl
Trigger: Cron dia 1 às 06:00 UTC + botão manual

1. Aggregate transactions por entity + category
2. Calcular P&L por empresa
3. UPSERT monthly_pnl
4. Calcular consolidado
5. Gerar investor_metrics
6. Se transações pendentes review → alertar admin
```

### 7.4 Atualizar operação ativa

```
Nome: update-active-operations
Trigger: Cron a cada 6h

Para cada opportunity ativa:
1. Buscar transações relacionadas
2. Calcular receita, ROAS, margem
3. INSERT operation_updates
4. Se ROAS < 2.0: visible_to_investor = false até admin revisar
5. Se ROAS < 2.0: alertar admin ANTES do investidor ver
```

## 8. ROADMAP DE IMPLEMENTAÇÃO (1 SEMANA)

Claude Code constrói o código. O gargalo real é configurar API keys e testar com dados reais.

### Dia 1: Fundação + banco + Mercury
- Schema PostgreSQL/Supabase (todas as tabelas de uma vez)
- Conexão Mercury API (2 contas) — mais simples, começa por aqui
- Classificação por regras
- Classificação via Claude Haiku (pra transações sem regra)
- Dashboard admin básico: saldos + transações + review

### Dia 2: Revolut + Airwallex + intercompany
- Conexão Revolut API (OAuth2, 2 contas)
- Conexão Airwallex API (1 conta)
- Conversão GBP→USD automática
- Detecção automática de intercompany
- Tela de review completa com correção → aprendizado

### Dia 3: P&L + dashboard admin completo
- Geração automática P&L por empresa + consolidado
- Gráficos receita x custos
- Dashboard admin com todas as 5 telas
- Aprendizado: correção humana → nova regra pra AI

### Dia 4: Plataforma de investimento
- Sistema convites + cadastro investidor
- Aprovação manual de cadastros
- Criação de oportunidades (puxa métricas do bookkeeping)
- Área do investidor (login, painel, oportunidades)
- Geração contrato SCP (PDF)

### Dia 5: Integração + acompanhamento + go live
- Acompanhamento ao vivo de operações ativas
- Vitrine investidor com métricas curadas
- Preview admin do que investidor vê
- Alertas (ROAS < 2.0 avisa admin antes do investidor)
- Teste end-to-end com dados reais dos bancos
- Deploy Vercel

### Pré-requisitos (antes de começar o dia 1)
- [ ] Criar conta Supabase e pegar URL + keys
- [ ] Gerar API key Mercury (2 contas)
- [ ] Configurar OAuth2 Revolut Business (2 contas)
- [ ] Gerar API key + client_id Airwallex
- [ ] Gerar API key Claude (Anthropic Console)
- [ ] Preencher .env com todas as keys

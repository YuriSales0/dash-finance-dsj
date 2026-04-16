## Sobre este projeto

Sistema AI-first de bookkeeping unificado para 3 empresas com 5 contas bancárias em 2 moedas.
Inclui plataforma privada de investimento (SCP) alimentada por dados financeiros reais.

## Stack

- **N8N** (orquestrador): puxa transações dos bancos, classifica via AI, gera P&L
- **Claude API** (classificação): Haiku classifica transações automaticamente (~$0.80/1M tokens)
- **PostgreSQL/Supabase** (banco de dados): transações, categorias, P&L, investidores, SCP
- **React + Tailwind** (dashboard): admin (vocês) + vitrine (investidores)
- **Vercel** (hosting): deploy gratuito

## As 3 empresas

| Empresa | Jurisdição | Bancos | Moeda |
|---------|-----------|--------|-------|
| DSJ Network LLC | Florida, USA | Mercury + Revolut | USD |
| Universal MKT LLP | London, UK | Airwallex + Revolut | GBP |
| DSJ Connect LLC | Delaware, USA | Mercury | USD |

## APIs dos bancos

- **Mercury**: REST API — GET /transactions, GET /accounts. Auth via API key. 2 contas (DSJ Network + DSJ Connect).
- **Revolut Business**: REST API — GET /transactions, GET /accounts. Auth via OAuth2. 2 contas (DSJ Network + Universal).
- **Airwallex**: REST API — GET /transactions, GET /balances. Auth via API key + client_id. 1 conta (Universal).

## Regras críticas

1. Transferências entre empresas (intercompany) NÃO são receita nem custo. Marcar como neutras.
2. Transferências entre bancos da mesma empresa NÃO são receita nem custo. Marcar como neutras.
3. Conversão GBP→USD usa taxa do momento da transação (registrar taxa usada).
4. Toda transação deve ser categorizada. Se AI não tem certeza (confidence < 70%), marcar como "revisar".
5. Quando humano corrige classificação da AI, salvar no banco de aprendizado pra AI não errar de novo.
6. P&L é calculado POR EMPRESA (separado) e CONSOLIDADO (somado, após conversão cambial).

## Convenções

- Workflows N8N: `/workflows/`
- Dashboard: `/dashboard/`
- Migrations SQL: `/database/`
- Prompts de classificação: `/prompts/`
- Testes: `/tests/`

## Ordem de implementação

1. Banco de dados (schema completo)
2. Conexão com APIs dos bancos (Mercury primeiro — mais simples)
3. Classificação AI de transações
4. Dashboard admin (visão consolidada + por empresa)
5. P&L automático mensal
6. Plataforma de investimento (SCP) — cadastro + oportunidades
7. Vitrine do investidor (dados curados do bookkeeping)
8. Sistema de aprendizado (AI melhora classificação com correções humanas)

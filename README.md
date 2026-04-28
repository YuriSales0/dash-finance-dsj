# DSJ Finance — AI-First Bookkeeping & Investment Platform

Sistema de bookkeeping unificado para 3 empresas + plataforma privada de antecipação de recebíveis com índice de risco operado por AI.

## Empresas

| Empresa | Jurisdição | Bancos | Moeda |
|---------|-----------|--------|-------|
| DSJ Network LLC | Florida, USA | Mercury + Revolut | USD |
| Universal MKT LLP | London, UK | Airwallex + Revolut | GBP |
| DSJ Connect LLC | Delaware, USA | Mercury | USD |

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + Recharts
- **Supabase** (PostgreSQL + Auth + RLS)
- **Claude Haiku** (classificação + índice de risco)
- **Vercel** — hosting

## Roles

- **DSJ** (operador): CRUD completo, integrações, recebíveis, dívidas, índice de risco
- **Investidor** (visualizador): vê números curados da DSJ, financia recebíveis abertos

## Rotas principais

**Admin (DSJ):**
- `/admin` — Visão consolidada
- `/admin/risk` — Índice de risco com AI + cenários what-if
- `/admin/receivables` — CRUD de recebíveis (manual ou abertos para investidor)
- `/admin/debts` — CRUD de dívidas
- `/admin/transactions` — Lista + review de classificação AI
- `/admin/pnl` — P&L mensal por empresa
- `/admin/investments` — Admin de investidores + oportunidades
- `/admin/preview` — Preview da vitrine
- `/admin/integrations` — Status das integrações

**Investidor:**
- `/investor` — Métricas curadas + chamada de ação
- `/investor/opportunities` — Recebíveis abertos para financiamento
- `/investor/portfolio` — Financiamentos ativos + histórico

## Setup

1. Rodar `database/full_schema.sql` no Supabase SQL Editor
2. No Supabase Auth: criar primeiro usuário DSJ
3. No SQL Editor: vincular role
   ```sql
   INSERT INTO user_roles (user_id, role, name, email)
   SELECT id, 'dsj', 'Seu Nome', email FROM auth.users WHERE email = 'seu@email.com';
   ```
4. Configurar env vars no Vercel:
   - `DEMO_MODE=false`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` (opcional, para análise AI do índice de risco)

## Modo demo

Sem auth: `DEMO_MODE=true` (default). Tudo funciona com dados ficticios. Bom pra apresentação e desenvolvimento.

## Estrutura

```
database/         SQL migrations + full_schema.sql
docs/SPEC.md      Spec completa
dashboard/        Next.js app
  src/
    app/admin/    — Telas DSJ
    app/investor/ — Portal do investidor
    app/login/    — Auth
    app/api/      — Endpoints (recebiveis, dividas, financings)
    lib/data/     — Repository (mock | supabase)
    lib/risk/     — Cálculo do índice de risco + AI
    lib/supabase/ — Clients + session helpers
    components/   — UI reutilizável
    types/        — Tipos das tabelas
```

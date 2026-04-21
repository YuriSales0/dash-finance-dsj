# DSJ Finance — AI-First Bookkeeping & Investment Platform

Sistema de bookkeeping unificado para 3 empresas com 5 contas bancárias, classificação automática via AI, e plataforma privada de investimento (SCP).

## Empresas

| Empresa | Jurisdição | Bancos | Moeda |
|---------|-----------|--------|-------|
| DSJ Network LLC | Florida, USA | Mercury + Revolut | USD |
| Universal MKT LLP | London, UK | Airwallex + Revolut | GBP |
| DSJ Connect LLC | Delaware, USA | Mercury | USD |

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + Recharts
- **Supabase** (PostgreSQL + Auth + RLS) — opcional, fallback pra demo
- **Claude API** (Haiku) — classificação de transações
- **N8N** — orquestrador (sync bancos, geração P&L)
- **Vercel** — hosting

## Rodar o demo (sem APIs reais)

```bash
cd dashboard
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Tudo funciona com dados ficticios.

As 6 telas:
- `/` — Visão consolidada (saldos, KPIs, gráfico 12 meses)
- `/transactions` — Lista + review com correção/aprendizado
- `/pnl` — P&L mensal por empresa (seletor consolidado/individual)
- `/investments` — Admin investidores + oportunidades
- `/preview` — Preview da vitrine que o investidor vê
- `/integrations` — Status das integrações (Supabase, bancos, Claude, N8N)

## Conectar APIs reais

1. Criar projeto Supabase + rodar `database/001-010.sql`
2. Configurar APIs (Mercury, Revolut, Airwallex, Anthropic) — ver `/integrations` no app
3. Copiar `.env.local.example` → `.env.local` e preencher
4. Setar `DEMO_MODE=false`
5. Implementar métodos do `SupabaseRepository` em `dashboard/src/lib/data/repository.ts`

## Estrutura

```
database/    SQL migrations (12 arquivos)
workflows/   N8N workflows (a criar quando ligar)
prompts/     Prompts da AI
docs/SPEC.md Spec completa do sistema
dashboard/   Next.js app
  src/
    app/(admin)/      — Telas admin
    app/(investor)/   — Portal do investidor (futuro)
    lib/data/         — Repository (mock + supabase)
    lib/supabase/     — Clients
    components/       — UI reutilizavel
    types/database.ts — Tipos das tabelas
```

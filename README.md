# DSJ Finance — AI-First Bookkeeping & Investment Platform

Sistema de bookkeeping unificado para 3 empresas com 5 contas bancárias, classificação automática via AI, e plataforma privada de investimento (SCP).

## Empresas

| Empresa | Jurisdição | Bancos | Moeda |
|---------|-----------|--------|-------|
| DSJ Network LLC | Florida, USA | Mercury + Revolut | USD |
| Universal MKT LLP | London, UK | Airwallex + Revolut | GBP |
| DSJ Connect LLC | Delaware, USA | Mercury | USD |

## Stack

- N8N — orquestrador
- Claude API (Haiku) — classificação de transações
- PostgreSQL / Supabase — banco de dados
- React + Tailwind — dashboard
- Vercel — hosting

## Setup

cp .env.example .env
# Preencher com API keys reais

## Dev com Claude Code

npm install -g @anthropic-ai/claude-code
claude

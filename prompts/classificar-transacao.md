Classifique esta transação bancária.

Empresa: {{entity_name}}
Banco: {{bank_name}}
Descrição: {{description}}
Contraparte: {{counterparty}}
Valor: {{amount}} {{currency}}
Data: {{date}}

Categorias disponíveis:
RECEITAS: revenue_shopify (vendas Shopify), revenue_other (outras receitas)
CUSTOS VARIÁVEIS: cost_ads_meta (Meta/Facebook Ads), cost_ads_tiktok (TikTok Ads), cost_ads_google (Google Ads), cost_products (fornecedores/produtos), cost_shipping (frete/embalagem), cost_gateway (taxas processador), cost_chargebacks (chargebacks), cost_refunds (reembolsos)
CUSTOS FIXOS: cost_team (salários), cost_saas (software), cost_infra (hosting/domínios), cost_legal (jurídico/contabilidade), cost_office (escritório)
TRANSFERÊNCIAS: transfer_intercompany (entre empresas DSJ), transfer_interbank (entre bancos mesma empresa), transfer_fx (câmbio)
INVESTIMENTO: investment_scp_in (aporte investidor), investment_scp_out (retorno investidor)

Retorne APENAS JSON:
{
  "category_id": "string",
  "confidence": 0-100,
  "is_intercompany": true|false,
  "counterpart_entity_id": "string|null",
  "reasoning": "string (1 frase)"
}

REGRAS:
- Se contraparte contém nome de outra empresa do grupo (DSJ Network, Universal MKT, DSJ Connect): é transfer_intercompany
- Se contraparte é o mesmo banco da mesma empresa: é transfer_interbank
- Se descrição menciona "exchange" ou "FX" ou "conversion": é transfer_fx
- Transferências NÃO afetam P&L
- Na dúvida entre duas categorias, escolha a mais conservadora (custo > receita)

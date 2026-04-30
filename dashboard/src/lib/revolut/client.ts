import { createServerClient } from "@/lib/supabase/server";
import { getApiBase, refreshAccessToken } from "./auth";

interface CredentialsRow {
  id: number;
  bank_account_id: string;
  client_id: string;
  issuer: string;
  private_key: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  sandbox: boolean;
}

// Pega credenciais da DB e garante access_token valido
export async function getValidAccessToken(bankAccountId: string): Promise<{
  token: string;
  apiBase: string;
  credentials: CredentialsRow;
}> {
  const sb = createServerClient();
  const { data, error } = await sb
    .from("revolut_credentials")
    .select("*")
    .eq("bank_account_id", bankAccountId)
    .eq("active", true)
    .single();

  if (error || !data) throw new Error(`Credenciais Revolut nao encontradas para ${bankAccountId}`);

  const creds = data as CredentialsRow;
  const now = new Date();
  const expiresAt = creds.access_token_expires_at ? new Date(creds.access_token_expires_at) : null;
  const stillValid = creds.access_token && expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60_000;

  if (stillValid) {
    return {
      token: creds.access_token!,
      apiBase: getApiBase(creds.sandbox),
      credentials: creds,
    };
  }

  // Refresh
  const newToken = await refreshAccessToken({
    client_id: creds.client_id,
    issuer: creds.issuer,
    private_key: creds.private_key,
    refresh_token: creds.refresh_token,
    sandbox: creds.sandbox,
  });

  const newExpiresAt = new Date(Date.now() + newToken.expires_in * 1000);

  await sb
    .from("revolut_credentials")
    .update({
      access_token: newToken.access_token,
      access_token_expires_at: newExpiresAt.toISOString(),
      refresh_token: newToken.refresh_token || creds.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq("id", creds.id);

  return {
    token: newToken.access_token,
    apiBase: getApiBase(creds.sandbox),
    credentials: creds,
  };
}

export interface RevolutAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
  state: string;
  public: boolean;
}

export interface RevolutTransaction {
  id: string;
  type: string;
  state: string;
  request_id?: string;
  reason_code?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  reference?: string;
  legs: Array<{
    leg_id: string;
    account_id: string;
    counterparty?: { account_id?: string; account_type?: string };
    amount: number;
    currency: string;
    description?: string;
    balance?: number;
    bill_amount?: number;
    bill_currency?: string;
  }>;
  merchant?: { name: string; city?: string; category_code?: string; country?: string };
  card?: { card_number: string };
}

// GET /accounts
export async function listAccounts(bankAccountId: string): Promise<RevolutAccount[]> {
  const { token, apiBase } = await getValidAccessToken(bankAccountId);
  const res = await fetch(`${apiBase}/accounts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Revolut accounts failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// GET /transactions?from=YYYY-MM-DD&to=YYYY-MM-DDTHH:mm:ss
// Pagina ate esgotar (Revolut retorna max 1000 por chamada, ordenado desc por created_at).
// Estrategia: usa `to` como cursor, setando para o created_at do item mais antigo da pagina anterior.
// Cap de seguranca: 50 paginas (50k transacoes).
export async function listTransactions(
  bankAccountId: string,
  options: { from?: string; to?: string; pageSize?: number; maxPages?: number } = {}
): Promise<RevolutTransaction[]> {
  const { token, apiBase } = await getValidAccessToken(bankAccountId);
  const pageSize = options.pageSize || 1000;
  const maxPages = options.maxPages || 50;

  const all: RevolutTransaction[] = [];
  const seen = new Set<string>();
  let cursor = options.to; // sera atualizado com created_at do mais antigo

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams();
    if (options.from) params.set("from", options.from);
    if (cursor) params.set("to", cursor);
    params.set("count", String(pageSize));

    const res = await fetch(`${apiBase}/transactions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Revolut transactions failed: ${res.status} ${await res.text()}`);

    const batch: RevolutTransaction[] = await res.json();
    if (batch.length === 0) break;

    let added = 0;
    for (const tx of batch) {
      if (!seen.has(tx.id)) {
        seen.add(tx.id);
        all.push(tx);
        added++;
      }
    }

    // Se a pagina veio incompleta OU nada novo foi adicionado, paramos
    if (batch.length < pageSize || added === 0) break;

    // Avancar cursor: pegar o created_at MAIS ANTIGO da pagina (assumindo ordem desc)
    let oldest = batch[0].created_at;
    for (const tx of batch) {
      if (tx.created_at < oldest) oldest = tx.created_at;
    }
    if (cursor === oldest) break; // proteção contra loop
    cursor = oldest;
  }

  return all;
}

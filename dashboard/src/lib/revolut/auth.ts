import { SignJWT, importPKCS8 } from "jose";
import { createPrivateKey } from "node:crypto";

const REVOLUT_PROD_URL = "https://b2b.revolut.com/api/1.0";
const REVOLUT_SANDBOX_URL = "https://sandbox-b2b.revolut.com/api/1.0";

export function getApiBase(sandbox: boolean): string {
  return sandbox ? REVOLUT_SANDBOX_URL : REVOLUT_PROD_URL;
}

// Aceita PKCS#1 (BEGIN RSA PRIVATE KEY) ou PKCS#8 (BEGIN PRIVATE KEY)
// e retorna sempre em PKCS#8 (que jose requer)
// Normalizacao robusta: extrai body, remove qualquer caractere fora do base64,
// e reconstroi PEM com line breaks corretas (64 chars por linha)
export function normalizePrivateKey(pem: string): string {
  // Normalizar dashes unicode comuns (em-dash, en-dash, etc)
  let normalized = pem
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/ /g, " "); // nbsp -> space

  // Tentar extrair os marcadores BEGIN/END
  const match = normalized.match(
    /-----\s*BEGIN\s+(RSA\s+PRIVATE\s+KEY|PRIVATE\s+KEY|EC\s+PRIVATE\s+KEY)\s*-----([\s\S]*?)-----\s*END\s+(?:RSA\s+PRIVATE\s+KEY|PRIVATE\s+KEY|EC\s+PRIVATE\s+KEY)\s*-----/i
  );

  if (!match) {
    throw new Error(
      "PEM_MARKERS_NOT_FOUND: Nao encontrei -----BEGIN...-----. " +
        "Inicio recebido: " +
        JSON.stringify(normalized.slice(0, 50))
    );
  }

  const keyType = match[1].replace(/\s+/g, " ").toUpperCase();
  const body = match[2].replace(/[^A-Za-z0-9+/=]/g, "");

  if (body.length < 100) {
    throw new Error(`PEM_BODY_TOO_SHORT: corpo tem ${body.length} chars (minimo ~600)`);
  }

  const lines = body.match(/.{1,64}/g)!.join("\n");
  const reconstructed = `-----BEGIN ${keyType}-----\n${lines}\n-----END ${keyType}-----\n`;

  try {
    const keyObject = createPrivateKey({ key: reconstructed, format: "pem" });
    return keyObject.export({ format: "pem", type: "pkcs8" }) as string;
  } catch (err: any) {
    throw new Error(
      `KEY_DECODE_FAILED: ${err.message}. KeyType: ${keyType}, BodyLen: ${body.length}`
    );
  }
}

// URL para o usuario autorizar o app no Revolut
export function buildAuthorizationUrl(params: {
  client_id: string;
  redirect_uri: string;
  state: string;
  sandbox: boolean;
}): string {
  const base = params.sandbox
    ? "https://sandbox-business.revolut.com/app-confirm"
    : "https://business.revolut.com/app-confirm";

  const qs = new URLSearchParams({
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    response_type: "code",
    scope: "READ",
    state: params.state,
  });

  return `${base}?${qs.toString()}`;
}

// Assina JWT client_assertion para autenticacao Revolut
async function signClientAssertion(
  clientId: string,
  issuer: string,
  privateKeyPem: string,
  sandbox: boolean
): Promise<string> {
  const audience = sandbox
    ? "https://revolut.com"
    : "https://revolut.com";

  const normalizedPem = normalizePrivateKey(privateKeyPem);
  const key = await importPKCS8(normalizedPem, "RS256");

  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(issuer)
    .setSubject(clientId)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 30) // 30 min
    .sign(key);
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

// Trocar refresh_token por novo access_token
export async function refreshAccessToken(creds: {
  client_id: string;
  issuer: string;
  private_key: string;
  refresh_token: string;
  sandbox: boolean;
}): Promise<TokenResponse> {
  const assertion = await signClientAssertion(
    creds.client_id,
    creds.issuer,
    creds.private_key,
    creds.sandbox
  );

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: creds.refresh_token,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });

  const res = await fetch(`${getApiBase(creds.sandbox)}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut token refresh failed: ${res.status} ${text}`);
  }

  return res.json();
}

// Trocar authorization code por tokens (primeira vez)
export async function exchangeCodeForTokens(creds: {
  client_id: string;
  issuer: string;
  private_key: string;
  code: string;
  sandbox: boolean;
}): Promise<TokenResponse> {
  const assertion = await signClientAssertion(
    creds.client_id,
    creds.issuer,
    creds.private_key,
    creds.sandbox
  );

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: creds.code,
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });

  const res = await fetch(`${getApiBase(creds.sandbox)}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Revolut code exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

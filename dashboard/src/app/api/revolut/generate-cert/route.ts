import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateKeyPairSync, createSign, X509Certificate } from "node:crypto";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const dynamic = "force-dynamic";

// POST /api/revolut/generate-cert
// Body: { bank_account_id, client_id, issuer, sandbox }
// Gera um novo par RSA 2048 + cert X509 self-signed diretamente no servidor.
// Salva a private key no DB e retorna o cert publico pra user colar no Revolut.
// Elimina toda confusao de copiar arquivos locais.
export async function POST(request: Request) {
  try {
    const { bank_account_id, client_id, issuer, sandbox = false } = await request.json();

    if (!bank_account_id || !client_id || !issuer) {
      return NextResponse.json(
        { error: "bank_account_id, client_id e issuer obrigatorios" },
        { status: 400 }
      );
    }

    // Gerar par RSA 2048
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    // Gerar cert X509 self-signed via openssl (node crypto nao tem API pra criar certs)
    const tmpKey = join(tmpdir(), `revolut_priv_${Date.now()}.pem`);
    const tmpCert = join(tmpdir(), `revolut_cert_${Date.now()}.pem`);
    let certificate: string;

    try {
      writeFileSync(tmpKey, privateKey, { mode: 0o600 });
      execSync(
        `openssl req -new -x509 -key "${tmpKey}" -out "${tmpCert}" -days 3650 ` +
          `-subj "/C=US/ST=Florida/L=Miami/O=DSJ/CN=dsj-finance" 2>&1`
      );
      certificate = readFileSync(tmpCert, "utf-8");
    } finally {
      try { unlinkSync(tmpKey); } catch {}
      try { unlinkSync(tmpCert); } catch {}
    }

    // Salvar private key no DB
    const sb = createServerClient();
    const { error } = await sb.from("revolut_credentials").upsert(
      {
        bank_account_id,
        client_id,
        issuer,
        private_key: privateKey,
        sandbox,
        active: false,
        refresh_token: null,
        access_token: null,
        access_token_expires_at: null,
        revolut_account_id: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bank_account_id" }
    );

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message:
        "Par de chaves gerado. Cole o certificado abaixo no Revolut Business Portal " +
        "(Settings → APIs → Upload certificate). Depois clique Autorizar.",
      certificate,
      public_key: publicKey,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

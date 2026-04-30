import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createPublicKey, createHash } from "node:crypto";

export const dynamic = "force-dynamic";

// GET /api/revolut/public-key?bank_account_id=...
// Deriva a chave publica da chave privada salva no DB.
// Usado pra diagnosticar mismatch com o certificado uploaded no Revolut:
// se o user subiu o cert errado no Revolut Business Portal, esse endpoint
// mostra qual public key DEVERIA estar la (a que casa com a privada salva).
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bankAccountId = url.searchParams.get("bank_account_id");

    if (!bankAccountId) {
      return NextResponse.json({ error: "bank_account_id obrigatorio" }, { status: 400 });
    }

    const sb = createServerClient();
    const { data, error } = await sb
      .from("revolut_credentials")
      .select("private_key, client_id")
      .eq("bank_account_id", bankAccountId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Credenciais nao encontradas" }, { status: 404 });
    }

    const c = data as { private_key: string; client_id: string };

    let publicKeyPem: string;
    let modulusSha256: string;
    try {
      // private_key ja foi normalizada para PKCS#8 quando foi salva
      const privateKey = createPublicKey({ key: c.private_key, format: "pem" });
      publicKeyPem = privateKey.export({ format: "pem", type: "spki" }) as string;

      // Fingerprint SHA256 da chave publica DER (compativel com:
      // openssl pkey -in revolut_private.pem -pubout -outform DER | openssl dgst -sha256)
      const der = privateKey.export({ format: "der", type: "spki" }) as Buffer;
      modulusSha256 = createHash("sha256").update(der).digest("hex");
    } catch (e: any) {
      return NextResponse.json(
        { error: `Falha ao derivar publica: ${e.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bank_account_id: bankAccountId,
      client_id: c.client_id,
      public_key_pem: publicKeyPem,
      public_key_sha256: modulusSha256,
      hint:
        "Esta e a chave publica que CASA com a chave privada salva no DB. " +
        "Compare com o que voce subiu no Revolut Business Portal. " +
        "Pra computar o mesmo fingerprint do seu cert local: " +
        "openssl x509 -in revolut_public.pem -pubkey -noout | " +
        "openssl pkey -pubin -outform DER | openssl dgst -sha256",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { normalizePrivateKey } from "@/lib/revolut/auth";
import { SignJWT, importPKCS8 } from "jose";

export async function POST(request: Request) {
  try {
    const { private_key, client_id, issuer } = await request.json();

    if (!private_key) {
      return NextResponse.json({ stage: "input", error: "private_key vazio" }, { status: 400 });
    }

    const result: any = {
      input_length: private_key.length,
      input_first_50: private_key.slice(0, 50),
      input_last_50: private_key.slice(-50),
      input_has_begin: private_key.includes("BEGIN"),
      input_has_end: private_key.includes("END"),
      input_unicode_dashes: /[‐‑‒–—―−]/.test(private_key),
      input_lines: private_key.split("\n").length,
    };

    // Stage 1: normalize
    let normalized: string;
    try {
      normalized = normalizePrivateKey(private_key);
      result.normalized_length = normalized.length;
      result.normalized_first_50 = normalized.slice(0, 50);
    } catch (err: any) {
      return NextResponse.json({ ...result, stage: "normalize", error: err.message }, { status: 400 });
    }

    // Stage 2: jose import
    let key;
    try {
      key = await importPKCS8(normalized, "RS256");
      result.key_imported = true;
    } catch (err: any) {
      return NextResponse.json({ ...result, stage: "import", error: err.message }, { status: 400 });
    }

    // Stage 3: sign JWT
    if (client_id && issuer) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const jwt = await new SignJWT({})
          .setProtectedHeader({ alg: "RS256", typ: "JWT" })
          .setIssuer(issuer)
          .setSubject(client_id)
          .setAudience("https://revolut.com")
          .setIssuedAt(now)
          .setExpirationTime(now + 60)
          .sign(key);
        result.jwt_signed = true;
        result.jwt_length = jwt.length;
        result.jwt_preview = jwt.slice(0, 30) + "...";
      } catch (err: any) {
        return NextResponse.json({ ...result, stage: "sign", error: err.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ...result, ok: true, message: "Chave validada com sucesso" });
  } catch (e: any) {
    return NextResponse.json({ stage: "unknown", error: e.message }, { status: 500 });
  }
}

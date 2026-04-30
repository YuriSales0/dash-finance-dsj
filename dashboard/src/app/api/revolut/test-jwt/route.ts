import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, refreshAccessToken } from "@/lib/revolut/auth";

export const dynamic = "force-dynamic";

// POST /api/revolut/test-jwt
// Body: { bank_account_id }
// Faz um code exchange com code BOGUS pra ver qual erro Revolut retorna.
// Isso diferencia entre:
//   - cert/jwt mismatch (signature mismatch) → problema NO Revolut Portal
//   - jwt OK mas code invalido → problema com o code exchange (ex: code expirado)
export async function POST(request: Request) {
  try {
    const { bank_account_id } = await request.json();
    if (!bank_account_id) {
      return NextResponse.json({ error: "bank_account_id obrigatorio" }, { status: 400 });
    }

    const sb = createServerClient();
    const { data, error } = await sb
      .from("revolut_credentials")
      .select("client_id, issuer, private_key, sandbox")
      .eq("bank_account_id", bank_account_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Credenciais nao encontradas" }, { status: 404 });
    }

    const c = data as any;

    // Tenta 1: code exchange com code claramente invalido
    // - se voltar "signature mismatch" → cert no Revolut nao bate com a privada salva
    // - se voltar "invalid_grant" / "invalid_request" → JWT OK, problema eh outro
    let codeResult: { ok: boolean; error?: string; status?: number } = { ok: false };
    try {
      await exchangeCodeForTokens({
        client_id: c.client_id,
        issuer: c.issuer,
        private_key: c.private_key,
        code: "BOGUS_TEST_CODE_THAT_DEFINITELY_DOESNT_EXIST_123456",
        sandbox: c.sandbox,
      });
      codeResult = { ok: true };
    } catch (err: any) {
      const msg = err.message || "";
      const statusMatch = msg.match(/(\d{3})/);
      codeResult = {
        ok: false,
        status: statusMatch ? parseInt(statusMatch[1]) : undefined,
        error: msg,
      };
    }

    // Tenta 2: refresh com refresh_token claramente invalido (mesmo principio)
    let refreshResult: { ok: boolean; error?: string; status?: number } = { ok: false };
    try {
      await refreshAccessToken({
        client_id: c.client_id,
        issuer: c.issuer,
        private_key: c.private_key,
        refresh_token: "BOGUS_REFRESH_TOKEN_THAT_DEFINITELY_DOESNT_EXIST",
        sandbox: c.sandbox,
      });
      refreshResult = { ok: true };
    } catch (err: any) {
      const msg = err.message || "";
      const statusMatch = msg.match(/(\d{3})/);
      refreshResult = {
        ok: false,
        status: statusMatch ? parseInt(statusMatch[1]) : undefined,
        error: msg,
      };
    }

    // Diagnose
    const codeMsg = codeResult.error?.toLowerCase() || "";
    const refreshMsg = refreshResult.error?.toLowerCase() || "";

    let diagnosis = "unknown";
    let advice = "";

    if (codeMsg.includes("signature mismatch") || refreshMsg.includes("signature mismatch")) {
      diagnosis = "CERT_MISMATCH_ON_REVOLUT";
      advice =
        "O JWT esta sendo assinado corretamente, mas o Revolut nao consegue validar com o cert que esta no Portal dele. " +
        "Acao: vai em Revolut Business → Settings → APIs, encontra o app com este client_id, " +
        "deleta o cert atual e re-sobe o conteudo do seu revolut_public.pem.";
    } else if (
      codeMsg.includes("invalid_grant") ||
      codeMsg.includes("invalid_request") ||
      codeMsg.includes("authorization code")
    ) {
      diagnosis = "JWT_OK_CODE_INVALID";
      advice =
        "Boa noticia: o JWT esta sendo assinado e validado corretamente pelo Revolut. " +
        "O erro 'invalid code' eh esperado pq mandamos um code falso. " +
        "Se o OAuth real esta falhando com signature mismatch, alguma coisa esta diferente entre o teste e o real " +
        "(provavel: race com cert recem-trocado, cache, ou voce tem multiplos clients).";
    } else if (codeMsg.includes("client_id") || codeMsg.includes("client not found")) {
      diagnosis = "CLIENT_ID_INVALID";
      advice = "O client_id salvo nao existe no Revolut. Confere se copiou corretamente.";
    } else {
      diagnosis = "UNCLEAR";
      advice = "Erro nao reconhecido. Olhe os campos code_exchange e refresh abaixo pra detalhes.";
    }

    return NextResponse.json({
      diagnosis,
      advice,
      client_id_used: c.client_id,
      issuer_used: c.issuer,
      sandbox: c.sandbox,
      code_exchange: codeResult,
      refresh: refreshResult,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

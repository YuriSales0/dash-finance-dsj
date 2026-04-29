import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildAuthorizationUrl } from "@/lib/revolut/auth";
import crypto from "node:crypto";

export async function POST(request: Request) {
  try {
    const { bank_account_id } = await request.json();
    if (!bank_account_id) {
      return NextResponse.json({ error: "bank_account_id obrigatorio" }, { status: 400 });
    }

    const sb = createServerClient();

    // Buscar credenciais (deve existir em modo draft)
    const { data: creds, error } = await sb
      .from("revolut_credentials")
      .select("client_id, sandbox")
      .eq("bank_account_id", bank_account_id)
      .single();

    if (error || !creds) {
      return NextResponse.json(
        { error: "Configure o certificado e client_id antes de autorizar" },
        { status: 400 }
      );
    }

    const { client_id, sandbox } = creds as any;

    // Gerar state aleatorio (CSRF)
    const state = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await sb.from("revolut_oauth_state").insert({
      state,
      bank_account_id,
      expires_at: expiresAt.toISOString(),
    });

    const origin = new URL(request.url).origin;
    const redirect_uri = `${origin}/api/auth/revolut/callback`;

    const url = buildAuthorizationUrl({
      client_id,
      redirect_uri,
      state,
      sandbox,
    });

    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { clearAnthropicKeyCache } from "@/lib/anthropic/key";

export const dynamic = "force-dynamic";

// GET: retorna status (sem expor chave)
export async function GET() {
  const envKey = process.env.ANTHROPIC_API_KEY;

  if (isDemoMode) {
    return NextResponse.json({ has_key: false, source: "demo" });
  }

  let dbKey: string | null = null;
  try {
    const sb = createServerClient();
    const { data } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "anthropic_api_key")
      .single();
    if (data) dbKey = (data as any).value || null;
  } catch {}

  const activeKey = dbKey || envKey || null;

  return NextResponse.json({
    has_key: !!activeKey,
    source: dbKey ? "database" : envKey ? "env" : null,
    masked: activeKey ? mask(activeKey) : null,
  });
}

// POST: salva chave em platform_settings
export async function POST(request: Request) {
  if (isDemoMode) return NextResponse.json({ demo: true });

  const { api_key } = await request.json();
  if (!api_key || typeof api_key !== "string" || api_key.length < 20) {
    return NextResponse.json({ error: "Chave invalida" }, { status: 400 });
  }
  if (!api_key.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "Chave deve comecar com sk-ant-" }, { status: 400 });
  }

  const sb = createServerClient();
  const { error } = await sb.from("platform_settings").upsert({
    key: "anthropic_api_key",
    value: api_key,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  clearAnthropicKeyCache();
  return NextResponse.json({ ok: true });
}

// DELETE: remove chave do DB
export async function DELETE() {
  if (isDemoMode) return NextResponse.json({ demo: true });

  const sb = createServerClient();
  await sb.from("platform_settings").delete().eq("key", "anthropic_api_key");
  clearAnthropicKeyCache();
  return NextResponse.json({ ok: true });
}

function mask(key: string): string {
  if (key.length < 12) return "****";
  return key.slice(0, 10) + "..." + key.slice(-4);
}

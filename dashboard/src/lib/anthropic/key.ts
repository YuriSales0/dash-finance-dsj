import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

let cached: { key: string | null; cachedAt: number } | null = null;
const TTL_MS = 60_000;

// Pega chave Anthropic: primeiro DB (platform_settings), depois env var
export async function getAnthropicKey(): Promise<string | null> {
  if (cached && Date.now() - cached.cachedAt < TTL_MS) {
    return cached.key;
  }

  let dbKey: string | null = null;

  if (!isDemoMode) {
    try {
      const sb = createServerClient();
      const { data } = await sb
        .from("platform_settings")
        .select("value")
        .eq("key", "anthropic_api_key")
        .single();
      if (data && (data as any).value) dbKey = (data as any).value;
    } catch {}
  }

  const envKey = process.env.ANTHROPIC_API_KEY || null;
  const result = dbKey || envKey;

  cached = { key: result, cachedAt: Date.now() };
  return result;
}

// Limpa cache (chamar apos salvar/deletar nova chave)
export function clearAnthropicKeyCache() {
  cached = null;
}

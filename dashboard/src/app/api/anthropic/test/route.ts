import { NextResponse } from "next/server";
import { getAnthropicKey } from "@/lib/anthropic/key";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODELS = ["claude-haiku-4-5-20251001", "claude-3-5-haiku-20241022", "claude-3-haiku-20240307"];

export async function POST() {
  const key = await getAnthropicKey();
  if (!key) {
    return NextResponse.json({ error: "Chave Anthropic nao configurada" }, { status: 400 });
  }

  // Testar varios modelos pra ver qual a chave tem acesso
  const results: any[] = [];

  for (const model of MODELS) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 50,
          messages: [
            { role: "user", content: "Diga apenas: OK" },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        results.push({
          model,
          ok: true,
          usage: data.usage,
          response: data.content?.[0]?.text || "",
        });
      } else {
        const body = await res.text();
        results.push({
          model,
          ok: false,
          status: res.status,
          error: body.slice(0, 300),
        });
      }
    } catch (e: any) {
      results.push({ model, ok: false, error: e.message });
    }
  }

  const workingModels = results.filter((r) => r.ok).map((r) => r.model);
  const firstWorking = results.find((r) => r.ok);

  return NextResponse.json({
    ok: workingModels.length > 0,
    working_models: workingModels,
    all_results: results,
    sample_response: firstWorking?.response,
    model: firstWorking?.model,
    usage: firstWorking?.usage,
  });
}

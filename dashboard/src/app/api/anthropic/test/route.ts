import { NextResponse } from "next/server";
import { getAnthropicKey } from "@/lib/anthropic/key";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Faz uma chamada simples a Claude pra validar a chave
export async function POST() {
  const key = await getAnthropicKey();
  if (!key) {
    return NextResponse.json({ error: "Chave Anthropic nao configurada" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "Responda em uma frase curta: o que e classificacao de transacoes bancarias?",
          },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        {
          error: `API Anthropic retornou ${res.status}: ${errBody.slice(0, 300)}`,
          status: res.status,
        },
        { status: 400 }
      );
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "(sem resposta)";

    return NextResponse.json({
      ok: true,
      model: data.model,
      usage: data.usage,
      sample_response: text,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

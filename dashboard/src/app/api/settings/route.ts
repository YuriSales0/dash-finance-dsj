import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

const demoSettings: Record<string, string> = {
  contract_template: "",
  contract_version: "0",
  platform_name: "DSJ Finance",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (isDemoMode) {
    if (key) return NextResponse.json({ key, value: demoSettings[key] || "" });
    return NextResponse.json(demoSettings);
  }

  const sb = createServerClient();

  if (key) {
    const { data } = await sb.from("platform_settings").select("*").eq("key", key).single();
    return NextResponse.json(data || { key, value: "" });
  }

  const { data } = await sb.from("platform_settings").select("*");
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.value; });
  return NextResponse.json(map);
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) return NextResponse.json({ error: "Key obrigatoria" }, { status: 400 });

    if (isDemoMode) {
      demoSettings[key] = value;
      return NextResponse.json({ ok: true });
    }

    const sb = createServerClient();
    const { error } = await sb.from("platform_settings").upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    // Se atualizou contrato, incrementar versao
    if (key === "contract_template") {
      const { data: ver } = await sb.from("platform_settings").select("value").eq("key", "contract_version").single();
      const newVersion = String(Number((ver as any)?.value || 0) + 1);
      await sb.from("platform_settings").upsert({
        key: "contract_version",
        value: newVersion,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

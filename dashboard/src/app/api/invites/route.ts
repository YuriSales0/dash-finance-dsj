import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { receivable_id, investor_name, investor_email, message } = body;

    const code = generateCode();

    if (isDemoMode) {
      return NextResponse.json({
        code,
        receivable_id,
        investor_name,
        investor_email,
        link: `${process.env.NEXT_PUBLIC_SITE_URL || "https://dash-finance-dsj.vercel.app"}/invest/${code}`,
      });
    }

    const sb = createServerClient();
    const { data, error } = await sb
      .from("invite_codes")
      .insert({
        code,
        created_by: "admin",
        receivable_id: receivable_id || null,
        investor_name: investor_name || null,
        investor_email: investor_email || null,
        message: message || null,
      })
      .select()
      .single();

    if (error) throw error;

    const link = `${process.env.NEXT_PUBLIC_SITE_URL || "https://dash-finance-dsj.vercel.app"}/invest/${code}`;

    return NextResponse.json({ ...data, link });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

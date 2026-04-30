import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/revolut/select-account
// Body: { bank_account_id, revolut_account_id }
// Salva qual sub-conta Revolut esta mapeada para esta bank_account local.
// Sync passa a filtrar legs por esse account_id.
export async function POST(request: Request) {
  try {
    const { bank_account_id, revolut_account_id } = await request.json();

    if (!bank_account_id || !revolut_account_id) {
      return NextResponse.json(
        { error: "bank_account_id e revolut_account_id obrigatorios" },
        { status: 400 }
      );
    }

    const sb = createServerClient();
    const { error } = await sb
      .from("revolut_credentials")
      .update({
        revolut_account_id,
        updated_at: new Date().toISOString(),
      })
      .eq("bank_account_id", bank_account_id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

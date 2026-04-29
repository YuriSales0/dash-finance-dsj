import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json([]);
  }

  const sb = createServerClient();
  const { data } = await sb
    .from("import_batches")
    .select("*, bank_accounts(bank_name, currency)")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json(data || []);
}

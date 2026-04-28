import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    DEMO_MODE_raw: process.env.DEMO_MODE,
    DEMO_MODE_active: process.env.DEMO_MODE !== "false",
    has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    has_supabase_anon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    has_supabase_service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_anthropic: !!process.env.ANTHROPIC_API_KEY,
    node_env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}

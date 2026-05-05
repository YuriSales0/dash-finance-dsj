import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { getSession } from "@/lib/supabase/session";

// GET /api/financings/[id]/verify — recomputa SHA-256 do contract_text e
// compara com contract_hash armazenado. Confirma que o contrato nao foi
// adulterado no DB (auditoria legal/regulatoria).
//
// Acesso: admin (role=dsj) sempre. Investidor: somente se for o dono.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id invalido" }, { status: 400 });
    }

    if (isDemoMode) {
      return NextResponse.json({
        id,
        valid: true,
        demo: true,
      });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    }

    const sb = createServerClient();
    const { data: financing, error } = await sb
      .from("financings")
      .select(
        "id, investor_id, contract_text, contract_hash, contract_signed_at, contract_accepted_at"
      )
      .eq("id", id)
      .single();
    if (error || !financing) {
      return NextResponse.json({ error: "Financing nao encontrado" }, { status: 404 });
    }
    const f = financing as any;

    // Investidor so pode ver contratos proprios; admin (dsj) ve qualquer
    if (session.role === "investor") {
      const { data: investor } = await sb
        .from("investors")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .single();
      if (!investor || (investor as any).id !== f.investor_id) {
        return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
      }
    } else if (session.role !== "dsj") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (!f.contract_text || !f.contract_hash) {
      return NextResponse.json({
        id,
        valid: false,
        reason: "Contrato sem texto ou hash armazenado",
      });
    }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(f.contract_text)
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const recomputed = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const valid = recomputed === f.contract_hash;

    return NextResponse.json({
      id,
      valid,
      stored_hash: f.contract_hash,
      recomputed_hash: recomputed,
      signed_at: f.contract_signed_at,
      accepted_at: f.contract_accepted_at,
      reason: valid ? null : "Hash divergente — contrato pode ter sido alterado",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

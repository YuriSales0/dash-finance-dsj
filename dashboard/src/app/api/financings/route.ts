import { NextResponse } from "next/server";

// Endpoint deprecated — toda criacao de financing passa por /api/financings/sign
// que faz validacao server-side (min/max/available), calcula expected_return,
// gera hash de contrato e tem sanity check pos-insert pra race conditions.
export async function POST() {
  return NextResponse.json(
    { error: "Endpoint deprecated. Use /api/financings/sign" },
    { status: 410 }
  );
}

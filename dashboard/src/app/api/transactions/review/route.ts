import { NextResponse } from "next/server";
import { repository } from "@/lib/data/repository";

export async function POST(request: Request) {
  const body = await request.json();
  const { id, category_id } = body;

  if (!id || !category_id) {
    return NextResponse.json({ error: "id e category_id obrigatorios" }, { status: 400 });
  }

  await repository.updateTransactionCategory(id, category_id, "admin");

  // TODO (modo real): criar registro em classification_rules com source='learned'

  return NextResponse.json({ success: true });
}

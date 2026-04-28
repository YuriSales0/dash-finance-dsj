import { NextResponse } from "next/server";
import { repository } from "@/lib/data/repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await repository.createReceivable(body);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });
    await repository.updateReceivable(id, data);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

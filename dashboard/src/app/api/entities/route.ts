import { NextResponse } from "next/server";
import { repository } from "@/lib/data/repository";

export async function GET() {
  const entities = await repository.getEntities();
  return NextResponse.json(entities);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await repository.createEntity(body);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await repository.deleteEntity(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getLatestRates, convertToUsd, formatFxDisplay } from "@/lib/fx/rates";

export const dynamic = "force-dynamic";

export async function GET() {
  const rates = await getLatestRates();
  return NextResponse.json({
    base: "USD",
    rates,
    display: formatFxDisplay(rates),
    updated_at: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const { amount, currency } = await request.json();
  const result = await convertToUsd(amount, currency);
  return NextResponse.json(result);
}

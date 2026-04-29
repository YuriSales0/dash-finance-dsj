import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

const DEMO_CATEGORIES = [
  { id: "revenue_shopify", group_name: "revenue", label: "Vendas Shopify (payouts)", affects_pnl: true },
  { id: "revenue_other", group_name: "revenue", label: "Outras receitas", affects_pnl: true },
  { id: "cost_ads_meta", group_name: "cost_variable", label: "Meta Ads", affects_pnl: true },
  { id: "cost_ads_tiktok", group_name: "cost_variable", label: "TikTok Ads", affects_pnl: true },
  { id: "cost_ads_google", group_name: "cost_variable", label: "Google Ads", affects_pnl: true },
  { id: "cost_products", group_name: "cost_variable", label: "Custo produto", affects_pnl: true },
  { id: "cost_shipping", group_name: "cost_variable", label: "Frete", affects_pnl: true },
  { id: "cost_gateway", group_name: "cost_variable", label: "Gateway", affects_pnl: true },
  { id: "cost_chargebacks", group_name: "cost_variable", label: "Chargebacks", affects_pnl: true },
  { id: "cost_refunds", group_name: "cost_variable", label: "Reembolsos", affects_pnl: true },
  { id: "cost_team", group_name: "cost_fixed", label: "Team", affects_pnl: true },
  { id: "cost_saas", group_name: "cost_fixed", label: "SaaS", affects_pnl: true },
  { id: "cost_infra", group_name: "cost_fixed", label: "Infra", affects_pnl: true },
  { id: "cost_legal", group_name: "cost_fixed", label: "Legal", affects_pnl: true },
  { id: "cost_office", group_name: "cost_fixed", label: "Escritorio", affects_pnl: true },
  { id: "transfer_intercompany", group_name: "transfer", label: "Intercompany", affects_pnl: false },
  { id: "transfer_interbank", group_name: "transfer", label: "Interbank", affects_pnl: false },
  { id: "transfer_fx", group_name: "transfer", label: "Cambio", affects_pnl: false },
];

export async function GET() {
  if (isDemoMode) {
    return NextResponse.json(DEMO_CATEGORIES);
  }

  const sb = createServerClient();
  const { data } = await sb
    .from("categories")
    .select("*")
    .order("group_name")
    .order("label");

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  try {
    const { id, label, group_name, affects_pnl = true } = await request.json();

    if (!label || !group_name) {
      return NextResponse.json({ error: "label e group_name obrigatorios" }, { status: 400 });
    }

    if (!["revenue", "cost_variable", "cost_fixed", "transfer", "investment"].includes(group_name)) {
      return NextResponse.json({ error: "group_name invalido" }, { status: 400 });
    }

    if (isDemoMode) {
      return NextResponse.json({
        id: id || generateId(group_name, label),
        label,
        group_name,
        affects_pnl,
        demo: true,
      });
    }

    const finalId = id || generateId(group_name, label);

    const sb = createServerClient();
    const { data, error } = await sb
      .from("categories")
      .insert({
        id: finalId,
        label,
        group_name,
        affects_pnl,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ja existe categoria com esse ID" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });

    if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

    const sb = createServerClient();

    // Antes de deletar, mover transacoes para sem categoria
    await sb.from("transactions").update({ category_id: null, needs_review: true }).eq("category_id", id);

    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function generateId(group: string, label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
  // Prefix with group type for clarity
  const prefix = group === "revenue" ? "revenue_" : group.startsWith("cost") ? "cost_" : group.startsWith("transfer") ? "transfer_" : "";
  if (slug.startsWith(prefix)) return slug;
  return prefix + slug;
}

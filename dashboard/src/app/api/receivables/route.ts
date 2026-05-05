import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { repository, isDemoMode } from "@/lib/data/repository";
import { createServerClient } from "@/lib/supabase/server";

// Invalida o data cache do Next pra todas as paginas que dependem de
// recebiveis — caso contrario, edicoes em /admin/receivables nao
// aparecem em /admin/investments, /investor/opportunities, etc.
function invalidateReceivablePaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/receivables");
  revalidatePath("/admin/investments");
  revalidatePath("/admin/debts");
  revalidatePath("/admin/pnl");
  revalidatePath("/admin/calendar");
  revalidatePath("/investor");
  revalidatePath("/investor/opportunities");
  revalidatePath("/investor/portfolio");
  // /invest/[code] e suas sub-rotas (landing publica + contract + register)
  // dependem de receivable. revalidate by 'layout' invalida toda a arvore.
  revalidatePath("/invest/[code]", "layout");
  // /api/invites/product tambem cacheia o GET
  revalidatePath("/api/invites/product");
}

// GET /api/receivables — retorna lista fresca (no-cache).
// Query params:
//   ?open_for_financing=true → filtra so abertos
export async function GET(request: Request) {
  const url = new URL(request.url);
  const openForFinancing = url.searchParams.get("open_for_financing");
  const filter: any = {};
  if (openForFinancing === "true") filter.open_for_financing = true;
  if (openForFinancing === "false") filter.open_for_financing = false;
  try {
    const list = await repository.getReceivables(filter);
    return NextResponse.json(list, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const created = await repository.createReceivable(body);
    invalidateReceivablePaths();
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

    // Se amount_received aumentou, criar transaction representando o pagamento
    // (pra que P&L e reconciliacao reflitam)
    let creditedAmount = 0;
    let transactionCreated = false;
    if (!isDemoMode && typeof data.amount_received === "number") {
      try {
        const sb = createServerClient();
        const { data: existing } = await sb
          .from("receivables")
          .select("amount_received, entity_id, currency, description, counterparty")
          .eq("id", id)
          .single();

        const before = Number((existing as any)?.amount_received || 0);
        const after = Number(data.amount_received);
        creditedAmount = after - before;

        if (creditedAmount > 0) {
          // Buscar primeira conta ativa da empresa na mesma moeda
          const ent = (existing as any).entity_id;
          const cur = (existing as any).currency;
          const { data: accounts } = await sb
            .from("bank_accounts")
            .select("id, balance_current")
            .eq("entity_id", ent)
            .eq("currency", cur)
            .eq("active", true)
            .limit(1);

          if (accounts && accounts.length > 0) {
            const acc = accounts[0] as any;
            const newBalance = Number(acc.balance_current || 0) + creditedAmount;

            // Atualizar saldo
            await sb
              .from("bank_accounts")
              .update({
                balance_current: Math.round(newBalance * 100) / 100,
                balance_updated_at: new Date().toISOString(),
              })
              .eq("id", acc.id);

            // Criar transaction de receita
            // external_id unico: receivable:{id}:{timestamp} — evita dedup colisao
            const externalId = `receivable:${id}:${Date.now()}`;
            await sb.from("transactions").insert({
              external_id: externalId,
              bank_account_id: acc.id,
              entity_id: ent,
              timestamp: new Date().toISOString(),
              description: `Recebimento: ${(existing as any).description}`,
              counterparty: (existing as any).counterparty || null,
              amount_original: creditedAmount,
              currency_original: cur,
              amount_usd: creditedAmount,
              fx_rate: 1,
              category_id: "revenue_other",
              classified_by: "rule",
              classification_confidence: 100,
              needs_review: false,
            });
            transactionCreated = true;
          }
        }
      } catch (e: any) {
        console.error("Erro ao registrar recebimento:", e.message);
      }
    }

    await repository.updateReceivable(id, data);
    invalidateReceivablePaths();
    return NextResponse.json({ ok: true, transaction_created: transactionCreated, credited: creditedAmount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "ID obrigatorio" }, { status: 400 });

    // H6: nao deletar recebivel com financings ativos — investidores ja
    // assinaram contrato vinculado a essa operacao. Admin precisa primeiro
    // resolver os financings (resgatar/cancelar) antes de deletar o recebivel.
    if (!isDemoMode) {
      try {
        const sb = createServerClient();
        const { data: actives, count } = await sb
          .from("financings")
          .select("id", { count: "exact", head: true })
          .eq("receivable_id", id)
          .in("status", ["active", "pending"]);
        const n = (actives && (actives as any).length) || count || 0;
        if (n > 0) {
          return NextResponse.json(
            {
              error:
                `Recebivel tem ${n} financiamento(s) ativo(s). Resgate ou cancele os financings antes de deletar.`,
            },
            { status: 409 }
          );
        }
      } catch {
        // se falhar a checagem, segue com a delete (best effort)
      }
    }

    await repository.deleteReceivable(id);
    invalidateReceivablePaths();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro" }, { status: 500 });
  }
}

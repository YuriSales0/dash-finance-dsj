import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { formatCurrency, formatDate } from "@/lib/format";
import { InviteGenerator } from "@/components/invite/InviteGenerator";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const receivables = await repository.getReceivables({ open_for_financing: true });
  const open = receivables.filter((r) => r.status !== "paid");

  return (
    <>
      <Header
        title="Gerar convite"
        subtitle="Crie um link unico para o investidor acessar o produto"
      />
      <div className="p-6 max-w-3xl space-y-6">
        <InviteGenerator receivables={open.map((r) => ({
          id: r.id,
          description: r.description,
          amount_total: r.amount_total,
          currency: r.currency,
          interest_rate: r.financing_interest_rate_pct || 0,
          redemption_days: r.financing_redemption_days || 0,
        }))} />
      </div>
    </>
  );
}

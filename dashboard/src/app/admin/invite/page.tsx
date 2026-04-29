import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { InviteGenerator } from "@/components/invite/InviteGenerator";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/repository";
import { AlertTriangle, FileText } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const receivables = await repository.getReceivables({ open_for_financing: true });
  const open = receivables.filter((r) => r.status !== "paid");

  // Checar se contrato foi configurado
  let hasContract = false;
  if (!isDemoMode) {
    const sb = createServerClient();
    const { data } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "contract_template")
      .single();
    hasContract = !!((data as any)?.value?.trim());
  }

  return (
    <>
      <Header
        title="Gerar convite"
        subtitle="Crie um link unico para o investidor acessar o produto"
      />
      <div className="p-6 max-w-3xl space-y-6">
        {!hasContract && !isDemoMode && (
          <div className="card card-body bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-red-900">Contrato nao configurado</p>
                <p className="text-sm text-red-700 mt-1">
                  Voce precisa adicionar o texto do contrato SCP antes de gerar convites.
                  O investidor nao conseguira assinar sem o contrato.
                </p>
                <Link
                  href="/admin/contract"
                  className="btn-primary mt-3 inline-flex items-center gap-2 text-sm"
                >
                  <FileText size={14} />
                  Configurar contrato
                </Link>
              </div>
            </div>
          </div>
        )}

        <InviteGenerator
          receivables={open.map((r) => ({
            id: r.id,
            description: r.description,
            amount_total: r.amount_total,
            currency: r.currency,
            interest_rate: r.financing_interest_rate_pct || 0,
            redemption_days: r.financing_redemption_days || 0,
          }))}
          disabled={!hasContract && !isDemoMode}
        />
      </div>
    </>
  );
}

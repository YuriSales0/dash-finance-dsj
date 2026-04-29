import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { RevolutSetup } from "@/components/integrations/RevolutSetup";

export const dynamic = "force-dynamic";

export default async function RevolutIntegrationPage() {
  const accounts = await repository.getBankAccounts();
  const revolutAccounts = accounts.filter((a) =>
    a.bank_name.toLowerCase().includes("revolut") || a.api_provider === "revolut"
  );

  return (
    <>
      <Header
        title="Integracao Revolut"
        subtitle="Conectar API Revolut Business para sync automatico"
      />
      <div className="p-6 max-w-4xl space-y-6">
        <RevolutSetup
          accounts={revolutAccounts.map((a) => ({
            id: a.id,
            entity_id: a.entity_id,
            bank_name: a.bank_name,
            currency: a.currency,
          }))}
        />
      </div>
    </>
  );
}

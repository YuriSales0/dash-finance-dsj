import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { entityNames } from "@/lib/format";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const [entities, accounts] = await Promise.all([
    repository.getEntities(),
    repository.getBankAccounts(),
  ]);

  const entitiesWithAccounts = entities.map((e) => ({
    ...e,
    accounts: accounts.filter((a) => a.entity_id === e.id),
  }));

  const revolutAccounts = accounts.filter(
    (a) => a.bank_name.toLowerCase().includes("revolut") || a.api_provider === "revolut"
  );

  const tab = (searchParams.tab as "entities" | "integrations" | "contract" | "categories") || "entities";

  return (
    <>
      <Header
        title="Configuracoes"
        subtitle="Empresas, integracoes e contrato SCP"
      />
      <div className="p-6 max-w-5xl">
        <SettingsTabs
          activeTab={tab}
          entities={entitiesWithAccounts}
          revolutAccounts={revolutAccounts.map((a) => ({
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

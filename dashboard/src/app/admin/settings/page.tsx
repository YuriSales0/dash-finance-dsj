import { Header } from "@/components/layout/Header";
import { repository } from "@/lib/data/repository";
import { formatCurrency, entityNames } from "@/lib/format";
import { SettingsForms } from "@/components/settings/SettingsForms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [entities, accounts] = await Promise.all([
    repository.getEntities(),
    repository.getBankAccounts(),
  ]);

  const entitiesWithAccounts = entities.map((e) => ({
    ...e,
    accounts: accounts.filter((a) => a.entity_id === e.id),
  }));

  return (
    <>
      <Header
        title="Configuracoes"
        subtitle="Empresas, contas bancarias e saldos"
      />
      <div className="p-6 max-w-4xl space-y-6">
        <SettingsForms entities={entitiesWithAccounts} />
      </div>
    </>
  );
}

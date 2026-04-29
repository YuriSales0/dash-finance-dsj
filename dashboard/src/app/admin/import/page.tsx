import { Header } from "@/components/layout/Header";
import { ImportForm } from "@/components/import/ImportForm";
import { repository } from "@/lib/data/repository";
import { entityNames } from "@/lib/format";
import { Info } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const accounts = await repository.getBankAccounts();
  const options = accounts.map((a) => ({
    id: a.id,
    bank_name: a.bank_name,
    currency: a.currency,
    entity_id: a.entity_id,
    entity_name: entityNames[a.entity_id] || a.entity_id,
  }));

  return (
    <>
      <Header
        title="Importar transacoes"
        subtitle="Upload de CSV exportado do banco"
      />
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="card card-body bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="text-blue-600 mt-0.5" size={18} />
            <div className="text-sm text-blue-900 space-y-2">
              <p className="font-semibold">Como exportar do Revolut Business:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 text-xs">
                <li>Login na conta &gt; Account &gt; Statements</li>
                <li>Selecionar periodo desejado</li>
                <li>Format: <strong>CSV</strong></li>
                <li>Download e fazer upload aqui</li>
              </ol>
              <p className="text-xs text-blue-800 mt-2">
                Transacoes duplicadas (mesmo ID) sao automaticamente ignoradas.
                Cada uma e classificada por regras + AI Claude Haiku.
              </p>
            </div>
          </div>
        </div>

        <ImportForm accounts={options} />
      </div>
    </>
  );
}

import { Header } from "@/components/layout/Header";
import { AuditView } from "@/components/audit/AuditView";

export const dynamic = "force-dynamic";

export default function AuditPage() {
  return (
    <>
      <Header
        title="Auditoria"
        subtitle="Compara saldo das transacoes vs P&L. Detecta divergencias."
      />
      <div className="p-6">
        <AuditView />
      </div>
    </>
  );
}

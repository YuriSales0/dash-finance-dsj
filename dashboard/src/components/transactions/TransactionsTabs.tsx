"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { Transaction, BankAccount } from "@/types/database";
import { TransactionsList } from "./TransactionsList";
import { ReconciliationView } from "@/components/reconciliation/ReconciliationView";
import { AuditView } from "@/components/audit/AuditView";
import { entityNames } from "@/lib/format";
import { List, Scale, Search } from "lucide-react";

interface Props {
  activeTab: "list" | "reconciliation" | "audit";
  transactions: Transaction[];
  accounts: BankAccount[];
  entities: { id: string; name: string }[];
}

export function TransactionsTabs(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}

function Inner({ activeTab, transactions, accounts, entities }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState(activeTab);

  function changeTab(newTab: typeof tab) {
    setTab(newTab);
    const next = new URLSearchParams(params.toString());
    if (newTab === "list") next.delete("tab");
    else next.set("tab", newTab);
    router.push(`/admin/transactions${next.toString() ? "?" + next.toString() : ""}`);
  }

  return (
    <div className="space-y-4">
      {/* Abas */}
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === "list"} onClick={() => changeTab("list")} icon={<List size={14} />}>
          Lista de transacoes
        </TabButton>
        <TabButton active={tab === "reconciliation"} onClick={() => changeTab("reconciliation")} icon={<Scale size={14} />}>
          Reconciliacao
        </TabButton>
        <TabButton active={tab === "audit"} onClick={() => changeTab("audit")} icon={<Search size={14} />}>
          Auditoria
        </TabButton>
      </div>

      {tab === "list" && (
        <TransactionsList transactions={transactions} accounts={accounts} entities={entities} />
      )}
      {tab === "reconciliation" && (
        <ReconciliationView
          accounts={accounts.map((a) => ({
            id: a.id,
            label: `${entityNames[a.entity_id] || a.entity_id} - ${a.bank_name} (${a.currency})`,
            currency: a.currency,
            entity_id: a.entity_id,
          }))}
        />
      )}
      {tab === "audit" && <AuditView />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2 ${
        active
          ? "border-brand-600 text-brand-600"
          : "border-transparent text-slate-600 hover:text-slate-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

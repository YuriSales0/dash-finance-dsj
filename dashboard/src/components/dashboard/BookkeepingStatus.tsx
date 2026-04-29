"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";

interface Props {
  pendingReviews: number;
  receivablesOverdue: number;
  debtsOverdue: number;
  lastSyncedAt: string | null;
  lastPnlGeneratedAt: string | null;
}

export function BookkeepingStatus({
  pendingReviews,
  receivablesOverdue,
  debtsOverdue,
  lastSyncedAt,
  lastPnlGeneratedAt,
}: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function generatePnl() {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/pnl/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(`P&L gerado para ${data.months_processed} meses, ${data.intercompany_detected || 0} intercompany detectadas`);
        router.refresh();
      } else {
        setResult(`Erro: ${data.error}`);
      }
    } catch (err: any) {
      setResult(`Erro: ${err.message}`);
    }
    setGenerating(false);
  }

  const isHealthy =
    pendingReviews === 0 && receivablesOverdue === 0 && debtsOverdue === 0;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-slate-600" />
          <h3 className="font-semibold">Status do Bookkeeping</h3>
        </div>
        <button
          onClick={generatePnl}
          disabled={generating}
          className="btn-secondary text-xs inline-flex items-center gap-1.5"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Regenerar P&L
        </button>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusItem
            ok={pendingReviews === 0}
            icon={<AlertTriangle size={14} />}
            label="Transacoes a revisar"
            value={pendingReviews}
            href="/admin/transactions"
            okLabel="Todas classificadas"
          />
          <StatusItem
            ok={receivablesOverdue === 0}
            icon={<Clock size={14} />}
            label="Recebiveis atrasados"
            value={receivablesOverdue}
            href="/admin/receivables"
            okLabel="Em dia"
          />
          <StatusItem
            ok={debtsOverdue === 0}
            icon={<Clock size={14} />}
            label="Dividas atrasadas"
            value={debtsOverdue}
            href="/admin/debts"
            okLabel="Em dia"
          />
          <StatusItem
            ok={!!lastSyncedAt}
            icon={<RefreshCw size={14} />}
            label="Ultima atualizacao"
            value={lastSyncedAt ? formatDateTime(lastSyncedAt) : "Nunca"}
            href="/admin/import"
            okLabel={lastSyncedAt ? formatDateTime(lastSyncedAt) : "Nunca"}
            stringValue
          />
        </div>

        {isHealthy && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <CheckCircle2 size={16} />
            Bookkeeping em dia. Tudo classificado e nada atrasado.
          </div>
        )}

        {result && (
          <div className="mt-4 text-xs text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusItem({
  ok,
  icon,
  label,
  value,
  href,
  okLabel,
  stringValue = false,
}: {
  ok: boolean;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  href: string;
  okLabel: string;
  stringValue?: boolean;
}) {
  const color = ok ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50";

  return (
    <a
      href={href}
      className="block bg-slate-50 rounded-lg px-3 py-2 hover:bg-slate-100 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1 rounded ${color}`}>{icon}</div>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className={`font-semibold text-sm ${ok ? "text-slate-700" : "text-amber-700"}`}>
        {stringValue ? value : ok ? okLabel : value}
      </p>
    </a>
  );
}

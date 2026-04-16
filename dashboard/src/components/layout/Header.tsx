"use client";

import { RefreshCw, AlertTriangle } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  pendingReviews?: number;
  lastSyncedAt?: string | null;
  onSync?: () => void;
  syncing?: boolean;
}

export function Header({
  title,
  subtitle,
  pendingReviews = 0,
  lastSyncedAt,
  onSync,
  syncing = false,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {pendingReviews > 0 && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">
                {pendingReviews} pendente{pendingReviews > 1 ? "s" : ""}
              </span>
            </div>
          )}

          {lastSyncedAt && (
            <span className="text-xs text-slate-400">
              Sync:{" "}
              {new Date(lastSyncedAt).toLocaleString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}

          {onSync && (
            <button
              onClick={onSync}
              disabled={syncing}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando..." : "Sync"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

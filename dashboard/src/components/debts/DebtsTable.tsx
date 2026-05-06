"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, entityNames } from "@/lib/format";
import { DebtForm } from "@/components/debts/DebtForm";
import { Pencil } from "lucide-react";
import type { Debt } from "@/types/database";

interface EntityOption {
  id: string;
  name: string;
  currency_default: string;
}

export function DebtsTable({ debts, entities }: { debts: Debt[]; entities: EntityOption[] }) {
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  if (editingDebt) {
    return (
      <DebtForm
        entities={entities}
        editDebt={editingDebt}
        forceOpen
        onClose={() => setEditingDebt(null)}
      />
    );
  }

  return (
    <div className="card">
      <div className="card-header"><h3 className="font-semibold">Dividas</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Descricao</th>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Credor</th>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Empresa</th>
              <th className="text-left py-2 px-4 font-medium text-slate-500">Vencimento</th>
              <th className="text-right py-2 px-4 font-medium text-slate-500">Valor</th>
              <th className="text-center py-2 px-4 font-medium text-slate-500">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {debts.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Nenhuma dívida</td></tr>
            ) : debts.map((d) => {
              const isOverdue = d.status !== "paid" && new Date(d.due_date) < new Date();
              return (
                <tr
                  key={d.id}
                  onClick={() => setEditingDebt(d)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="py-3 px-4">
                    <div className="font-medium">{d.description}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {d.category === "aporte_investidor" ? (
                        <span className="text-xs text-blue-600">Aporte de investidor</span>
                      ) : d.category ? (
                        <span className="text-xs text-slate-500">{d.category}</span>
                      ) : null}
                      {d.is_recurring && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                          {d.recurrence_interval === "weekly" ? "Semanal" :
                           d.recurrence_interval === "biweekly" ? "Quinzenal" :
                           d.recurrence_interval === "monthly" ? "Mensal" :
                           d.recurrence_interval === "quarterly" ? "Trimestral" :
                           d.recurrence_interval === "yearly" ? "Anual" : "Recorrente"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">{d.creditor || "-"}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{entityNames[d.entity_id] || d.entity_id}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{formatDate(d.due_date)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono">{formatCurrency(d.amount_total, d.currency)}</span>
                    {(d.interest_rate_pct || d.fixed_commission) ? (
                      <div className={`text-[10px] mt-0.5 ${d.category === "aporte_investidor" ? "text-blue-600" : "text-purple-600"}`}>
                        {d.interest_rate_pct ? `${d.interest_rate_pct}% juros` : ""}
                        {d.interest_rate_pct && d.fixed_commission ? " + " : ""}
                        {d.fixed_commission ? `${formatCurrency(d.fixed_commission, d.currency)} comissao` : ""}
                        {d.is_recurring && (
                          <> = {formatCurrency(d.amount_total + (d.fixed_commission || 0), d.currency)}/rec</>
                        )}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={
                      d.status === "paid" ? "success" :
                      isOverdue ? "danger" :
                      d.status === "partial" ? "warning" : "neutral"
                    }>
                      {d.status === "paid" ? "Pago" :
                       isOverdue ? "Atrasado" :
                       d.status === "partial" ? "Parcial" : "Pendente"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Pencil size={14} className="text-slate-400 inline" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

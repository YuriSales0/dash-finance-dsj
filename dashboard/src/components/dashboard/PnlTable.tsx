import type { MonthlyPnl } from "@/types/database";
import { formatCurrency } from "@/lib/format";

interface Props {
  rows: MonthlyPnl[];
  currency?: string;
}

const ROWS_DEF = [
  { key: "revenue", label: "Receita", group: "revenue" },
  { key: "cost_ads", label: "Ads (Meta + TikTok + Google)", group: "cost" },
  { key: "cost_products", label: "Produtos", group: "cost" },
  { key: "cost_shipping", label: "Frete", group: "cost" },
  { key: "cost_gateway", label: "Gateway/Processador", group: "cost" },
  { key: "cost_chargebacks", label: "Chargebacks", group: "cost" },
  { key: "cost_refunds", label: "Reembolsos", group: "cost" },
  { key: "cost_team", label: "Team", group: "cost" },
  { key: "cost_saas", label: "SaaS", group: "cost" },
  { key: "cost_infra", label: "Infraestrutura", group: "cost" },
  { key: "cost_legal", label: "Legal", group: "cost" },
  { key: "cost_other", label: "Outros", group: "cost" },
  { key: "total_costs", label: "Custos Totais", group: "subtotal" },
  { key: "net_profit", label: "Lucro Liquido", group: "total" },
  { key: "margin_pct", label: "Margem %", group: "pct" },
] as const;

export function PnlTable({ rows, currency = "USD" }: Props) {
  if (rows.length === 0) return <p className="text-slate-400">Sem dados</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 font-medium text-slate-500">Linha</th>
            {rows.map((r) => (
              <th key={r.month} className="text-right py-2 px-3 font-medium text-slate-500">
                {new Date(r.month).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS_DEF.map((def) => (
            <tr
              key={def.key}
              className={`border-b border-slate-100 ${
                def.group === "subtotal" ? "bg-slate-50 font-medium" :
                def.group === "total" ? "bg-blue-50 font-bold" :
                def.group === "pct" ? "bg-slate-50" : ""
              }`}
            >
              <td className="py-2 px-3 text-slate-700">{def.label}</td>
              {rows.map((r) => {
                const value = r[def.key];
                return (
                  <td key={r.month} className="py-2 px-3 text-right font-mono">
                    {def.group === "pct"
                      ? `${(value as number).toFixed(1)}%`
                      : formatCurrency(value as number, currency)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

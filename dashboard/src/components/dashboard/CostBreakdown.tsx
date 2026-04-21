"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import type { MonthlyPnl } from "@/types/database";

interface Props {
  pnl: MonthlyPnl;
}

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899", "#64748b"];

export function CostBreakdown({ pnl }: Props) {
  const data = [
    { name: "Ads", value: pnl.cost_ads },
    { name: "Produtos", value: pnl.cost_products },
    { name: "Frete", value: pnl.cost_shipping },
    { name: "Gateway", value: pnl.cost_gateway },
    { name: "Team", value: pnl.cost_team },
    { name: "SaaS", value: pnl.cost_saas },
    { name: "Legal", value: pnl.cost_legal },
    { name: "Outros", value: pnl.cost_chargebacks + pnl.cost_refunds + pnl.cost_infra + pnl.cost_other },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={50}
          label={(entry) => entry.name}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

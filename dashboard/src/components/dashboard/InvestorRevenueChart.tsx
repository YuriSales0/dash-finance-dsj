"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { MonthlyPnl } from "@/types/database";

interface Props {
  data: MonthlyPnl[];
}

export function InvestorRevenueChart({ data }: Props) {
  const chartData = data.map((p) => ({
    month: new Date(p.month).toLocaleDateString("pt-BR", { month: "short" }),
    Receita: Math.round(p.revenue),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
        <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: number) => `$${v.toLocaleString("en-US")}`}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="Receita" fill="#10b981" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

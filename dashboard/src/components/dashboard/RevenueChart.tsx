"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { MonthlyPnl } from "@/types/database";

interface Props {
  data: MonthlyPnl[];
}

export function RevenueChart({ data }: Props) {
  const chartData = data.map((p) => {
    // Parsear YYYY-MM-DD sem shift de timezone
    const [y, m] = p.month.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return {
      month: d.toLocaleDateString("pt-BR", { month: "short" }),
      Receita: Math.round(p.revenue),
      Custos: Math.round(p.total_costs),
      Lucro: Math.round(p.net_profit),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v: number) => `$${v.toLocaleString("en-US")}`}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend />
        <Line type="monotone" dataKey="Receita" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Custos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Lucro" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

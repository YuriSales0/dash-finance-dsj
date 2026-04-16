export function formatCurrency(
  value: number,
  currency: string = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const entityColors: Record<string, string> = {
  dsj_network: "#3b82f6",
  universal_mkt: "#8b5cf6",
  dsj_connect: "#06b6d4",
  consolidated: "#10b981",
};

export const entityNames: Record<string, string> = {
  dsj_network: "DSJ Network LLC",
  universal_mkt: "Universal MKT LLP",
  dsj_connect: "DSJ Connect LLC",
  consolidated: "Consolidado",
};

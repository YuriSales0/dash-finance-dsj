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

// Cores fixas para empresas conhecidas
const KNOWN_COLORS: Record<string, string> = {
  dsj_network: "#3b82f6",
  universal_mkt: "#8b5cf6",
  dsj_connect: "#06b6d4",
  dsj_commerce: "#f59e0b",
  consolidated: "#10b981",
};

// Paleta de fallback para empresas novas (gerada deterministicamente pelo id)
const FALLBACK_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e",
  "#14b8a6", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899",
  "#f43f5e", "#d946ef",
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Proxy: retorna cor fixa se conhecida, senao gera deterministicamente
export const entityColors: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    if (KNOWN_COLORS[prop]) return KNOWN_COLORS[prop];
    return FALLBACK_PALETTE[hashString(prop) % FALLBACK_PALETTE.length];
  },
});

// Nomes hardcoded para retrocompatibilidade
const KNOWN_NAMES: Record<string, string> = {
  dsj_network: "DSJ Network LLC",
  universal_mkt: "Universal MKT LLP",
  dsj_connect: "DSJ Connect LLC",
  dsj_commerce: "DSJ Commerce LTDA",
  consolidated: "Consolidado",
};

// Proxy: retorna nome conhecido ou faz prettify do id
export const entityNames: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, prop: string) {
    if (KNOWN_NAMES[prop]) return KNOWN_NAMES[prop];
    // Fallback: capitalizar e remover underscores
    return prop
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  },
});

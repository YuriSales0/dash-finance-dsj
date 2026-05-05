import type { Receivable } from "@/types/database";

// Detecta se um recebivel foi criado pelo seed de teste do SCP.
// Usado pra filtrar test data das projecoes contabeis (Visao Geral, P&L,
// Caixa Total, fluxo de caixa) — esses recebiveis devem aparecer SO em
// /admin/receivables (com badge TEST) e /admin/investments (pra testar
// o fluxo de assinatura), nunca contaminar metricas reais.
export function isTestReceivable(r: Pick<Receivable, "description" | "notes">): boolean {
  const desc = r.description || "";
  if (desc.startsWith("TEST —") || desc.startsWith("TEST -") || desc.startsWith("TEST ")) {
    return true;
  }
  const notes = r.notes || "";
  if (notes.includes("seed de teste") || notes.includes("Recebivel criado pelo seed")) {
    return true;
  }
  return false;
}

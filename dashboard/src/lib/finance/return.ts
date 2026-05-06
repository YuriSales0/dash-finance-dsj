// Convencao da plataforma: taxa configurada no recebivel e MENSAL.
// Retorno calculado com juros COMPOSTOS sobre o periodo:
//
//   meses        = redemption_days / 30
//   total_return = principal * (1 + monthly_rate/100)^meses
//   juros        = total_return - principal
//
// Para 30 dias o resultado e identico a "principal * (1 + rate/100)" (1 mes).
// Para 60+ dias os juros se acumulam por mes.

export function monthsFromDays(redemptionDays: number): number {
  return Math.max(0, redemptionDays) / 30;
}

export function calculateExpectedReturn(
  principal: number,
  monthlyRatePct: number,
  redemptionDays: number
): number {
  const months = monthsFromDays(redemptionDays);
  if (!(principal > 0)) return 0;
  // L8: dias=0 → retorna principal sem juros (prazo instantaneo).
  // Quem chamar deve validar se isso faz sentido pro negocio
  // (sign route ja bloqueia redemptionDays<=0 em S6).
  if (months === 0) return principal;
  if (!Number.isFinite(monthlyRatePct) || monthlyRatePct <= 0) return principal;
  const total = principal * Math.pow(1 + monthlyRatePct / 100, months);
  return Math.round(total * 100) / 100;
}

export function calculateInterestAmount(
  principal: number,
  monthlyRatePct: number,
  redemptionDays: number
): number {
  return calculateExpectedReturn(principal, monthlyRatePct, redemptionDays) - principal;
}

// Taxa efetiva no periodo total (apenas pra exibicao). Ex: 2% ao mes em 90d
// equivale a (1.02^3 - 1) * 100 = 6.12% no periodo.
export function effectivePeriodRatePct(
  monthlyRatePct: number,
  redemptionDays: number
): number {
  const months = monthsFromDays(redemptionDays);
  if (months === 0) return 0;
  return (Math.pow(1 + monthlyRatePct / 100, months) - 1) * 100;
}

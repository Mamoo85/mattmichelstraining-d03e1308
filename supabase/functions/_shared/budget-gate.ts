// budget-gate.ts — pure budget-gate logic. Used by walker / enrichment scalers.

export interface BudgetGateInput {
  spendToday: number;     // USD spent so far today by this provider
  capDaily: number;       // USD daily cap; 0 / null treated as "no cap" (allow)
  costPerLead: number;    // estimated USD cost of one more enrichment
}

export interface BudgetGateResult {
  allow: boolean;
  reason: "under_cap" | "no_cap" | "would_exceed" | "at_cap" | "invalid_input";
  remaining_usd: number;  // 0 if at/over
  pct_used: number;       // 0..1; 0 when no cap
}

export function shouldAllowScale(input: BudgetGateInput): BudgetGateResult {
  const { spendToday, capDaily, costPerLead } = input;

  if (
    !Number.isFinite(spendToday) ||
    !Number.isFinite(capDaily) ||
    !Number.isFinite(costPerLead) ||
    spendToday < 0 ||
    capDaily < 0 ||
    costPerLead < 0
  ) {
    return { allow: false, reason: "invalid_input", remaining_usd: 0, pct_used: 0 };
  }

  // No cap configured = always allow.
  if (capDaily === 0) {
    return { allow: true, reason: "no_cap", remaining_usd: Infinity, pct_used: 0 };
  }

  const remaining = capDaily - spendToday;
  const pct = Math.min(1, spendToday / capDaily);

  if (remaining <= 0) {
    return { allow: false, reason: "at_cap", remaining_usd: 0, pct_used: pct };
  }
  if (costPerLead > remaining) {
    return { allow: false, reason: "would_exceed", remaining_usd: remaining, pct_used: pct };
  }
  return { allow: true, reason: "under_cap", remaining_usd: remaining, pct_used: pct };
}

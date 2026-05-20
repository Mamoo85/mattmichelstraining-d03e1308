// Pure pricing math for the velocity engine described in the brief.
export type VelocityTier = "penetration" | "momentum" | "established";

export interface VelocityResult {
  tier: VelocityTier;
  label: string;
  multiplier: number;
  price: number;
  basePrice: number;
  unitsSold: number;
  nextTierAt: number | null;
  unitsUntilNext: number | null;
  nextTierLabel: string | null;
}

const TIERS = [
  { max: 15, tier: "penetration" as const, label: "Penetration Pricing", multiplier: 0.8 },
  { max: 50, tier: "momentum" as const, label: "Momentum Pricing", multiplier: 0.9 },
  { max: Infinity, tier: "established" as const, label: "Established", multiplier: 1.0 },
];

export function computeVelocity(basePrice: number, unitsSold: number): VelocityResult {
  const idx = TIERS.findIndex((t) => unitsSold < t.max);
  const current = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  const price = Math.round(basePrice * current.multiplier * 100) / 100;
  return {
    tier: current.tier,
    label: current.label,
    multiplier: current.multiplier,
    price,
    basePrice,
    unitsSold,
    nextTierAt: next ? current.max : null,
    unitsUntilNext: next ? current.max - unitsSold : null,
    nextTierLabel: next?.label ?? null,
  };
}

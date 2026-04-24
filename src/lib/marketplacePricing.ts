// Shared marketplace pricing map. Keep in sync with create-marketplace-lead-checkout.
export const MARKETPLACE_PRICE_CENTS: Record<string, number> = {
  mortgage: 4900,
  talent: 5900,
  demand: 4900,
  growth: 4900,
  supply: 3900,
};

export function priceCentsFor(product?: string | null): number {
  if (!product) return 4900;
  return MARKETPLACE_PRICE_CENTS[product] ?? 4900;
}

export function priceLabelFor(product?: string | null): string {
  return `$${(priceCentsFor(product) / 100).toFixed(0)}`;
}

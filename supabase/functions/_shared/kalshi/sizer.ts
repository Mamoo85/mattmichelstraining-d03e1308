// Position sizer: Kelly fraction × conviction × portfolio cap.
// All inputs in cents. Returns integer contract count.

export interface SizerInput {
  capitalUsd: number;
  kellyFrac: number;          // 0.0 - 1.0 (we use fractional Kelly, default 0.25)
  conviction: number;         // 0.0 - 1.0
  edgeBps: number;            // basis points of expected edge
  marketPriceCents: number;   // current ask we'd cross
  maxPositionUsd: number;     // hard cap per signal
}

export function sizeOrder(i: SizerInput): { contracts: number; notionalUsd: number } {
  if (i.marketPriceCents <= 0 || i.marketPriceCents >= 100) return { contracts: 0, notionalUsd: 0 };
  // Kelly: f* = edge / (1 - p) approx; we already pass edge_bps so cap by it directly.
  const edge = Math.max(0, i.edgeBps) / 10000;
  const kellyDollar = i.capitalUsd * i.kellyFrac * edge * i.conviction;
  const capped = Math.min(kellyDollar, i.maxPositionUsd);
  // Each Kalshi contract = $1 payout; price is cents.
  const contracts = Math.floor((capped * 100) / i.marketPriceCents);
  return {
    contracts: Math.max(0, contracts),
    notionalUsd: (contracts * i.marketPriceCents) / 100,
  };
}

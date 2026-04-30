/**
 * Canonical trade names — single source of truth.
 * All edge functions and the frontend admin use these exact strings.
 * Search queries may be broader (see TRADE_SEARCH_QUERIES), but stored
 * trade values are always one of the CANONICAL_TRADES set.
 */
export const CANONICAL_TRADES = [
  "Roofing",
  "HVAC",
  "Plumbing",
  "Electrical",
  "General Contractor",
  "Siding",
  "Gutters",
  "Solar",
  "Boiler",
  "Painting",
  "Landscaping",
] as const;

export type CanonicalTrade = typeof CANONICAL_TRADES[number];

// Maps any raw/alias trade string (lowercase) → canonical form
const TRADE_ALIAS_MAP: Record<string, string> = {
  // Roofing
  "roofing": "Roofing",
  "roofer": "Roofing",
  "roofing contractor": "Roofing",
  "roof repair": "Roofing",
  "roof replacement": "Roofing",
  "roof installation": "Roofing",
  "licensed roofer": "Roofing",
  "shingle": "Roofing",
  "metal roof": "Roofing",
  // HVAC
  "hvac": "HVAC",
  "hvac contractor": "HVAC",
  "heating and cooling": "HVAC",
  "air conditioning": "HVAC",
  "ac repair": "HVAC",
  "ac contractor": "HVAC",
  "furnace repair": "HVAC",
  "furnace installation": "HVAC",
  "heat pump": "HVAC",
  "air conditioning repair": "HVAC",
  "ductwork": "HVAC",
  // Plumbing
  "plumbing": "Plumbing",
  "plumber": "Plumbing",
  "plumbing service": "Plumbing",
  "licensed plumber": "Plumbing",
  "drain cleaning": "Plumbing",
  "water heater": "Plumbing",
  "emergency plumber": "Plumbing",
  // Electrical
  "electrical": "Electrical",
  "electrician": "Electrical",
  "electrical contractor": "Electrical",
  "licensed electrician": "Electrical",
  "residential electrician": "Electrical",
  "electrical repair": "Electrical",
  // General Contractor
  "general contractor": "General Contractor",
  "home remodeling": "General Contractor",
  "renovation contractor": "General Contractor",
  "remodeling contractor": "General Contractor",
  "home improvement": "General Contractor",
  // Siding
  "siding": "Siding",
  "siding contractor": "Siding",
  "vinyl siding": "Siding",
  "siding installation": "Siding",
  "siding repair": "Siding",
  // Gutters — separate from Roofing (many roofers do gutters, but this is a distinct trade)
  "gutters": "Gutters",
  "gutter": "Gutters",
  "gutter installation": "Gutters",
  "gutter cleaning": "Gutters",
  "gutter guard": "Gutters",
  "seamless gutters": "Gutters",
  "gutter repair": "Gutters",
  // Solar
  "solar": "Solar",
  "solar installer": "Solar",
  "solar installation": "Solar",
  "solar panel installation": "Solar",
  "solar energy contractor": "Solar",
  "solar energy": "Solar",
  // Boiler
  "boiler": "Boiler",
  "boiler repair": "Boiler",
  "boiler installation": "Boiler",
  "boiler contractor": "Boiler",
  // Painting
  "painting": "Painting",
  "painter": "Painting",
  "painting contractor": "Painting",
  "interior painting": "Painting",
  "exterior painting": "Painting",
  // Landscaping
  "landscaping": "Landscaping",
  "landscaper": "Landscaping",
  "lawn care": "Landscaping",
  "lawn service": "Landscaping",
  "tree service": "Landscaping",
  "snow removal": "Landscaping",
};

/**
 * Normalize any trade string to its canonical form.
 * Falls back to title-casing the input if no alias is found.
 */
export function canonicalizeTrade(trade: string): string {
  if (!trade) return "General Contractor";
  const lower = trade.toLowerCase().trim();
  if (TRADE_ALIAS_MAP[lower]) return TRADE_ALIAS_MAP[lower];
  // Partial-match fallback for unrecognized variants
  if (lower.includes("roof") || lower.includes("shingle")) return "Roofing";
  if (lower.includes("hvac") || lower.includes("heating") || lower.includes("furnace") || lower.includes("air cond")) return "HVAC";
  if (lower.includes("plumb") || lower.includes("drain")) return "Plumbing";
  if (lower.includes("electric")) return "Electrical";
  if (lower.includes("solar")) return "Solar";
  if (lower.includes("siding") || lower.includes("vinyl")) return "Siding";
  if (lower.includes("gutter")) return "Gutters";
  if (lower.includes("boiler")) return "Boiler";
  if (lower.includes("general") || lower.includes("remodel") || lower.includes("renovati")) return "General Contractor";
  if (lower.includes("paint")) return "Painting";
  if (lower.includes("landscap") || lower.includes("lawn") || lower.includes("tree")) return "Landscaping";
  // Already canonical — return as-is
  return trade;
}

/**
 * Google Maps search query variants per canonical trade.
 * Using multiple specific variants finds more contractors than a single broad query.
 * Max 4 variants — beyond that the marginal Places API cost exceeds value.
 */
export const TRADE_SEARCH_QUERIES: Record<string, string[]> = {
  "Roofing": ["roofing contractor", "roof replacement", "roof repair", "licensed roofer"],
  "HVAC": ["HVAC contractor", "AC repair", "furnace repair", "heating and cooling company"],
  "Plumbing": ["licensed plumber", "plumbing service", "drain cleaning", "emergency plumber"],
  "Electrical": ["licensed electrician", "electrical contractor", "residential electrician", "electrical repair"],
  "General Contractor": ["general contractor", "home remodeling contractor", "renovation contractor", "home improvement contractor"],
  "Siding": ["siding contractor", "vinyl siding installation", "siding repair", "exterior siding"],
  "Gutters": ["gutter installation", "seamless gutters", "gutter cleaning", "gutter contractor"],
  "Solar": ["solar installer", "solar panel installation", "solar energy contractor", "residential solar"],
  "Boiler": ["boiler repair", "boiler installation", "boiler contractor", "steam boiler service"],
  "Painting": ["painting contractor", "interior painter", "exterior painting", "residential painter"],
  "Landscaping": ["landscaping contractor", "lawn care service", "tree service", "lawn maintenance"],
};

/** Get search queries for a trade, with fallback to generic variants */
export function getSearchQueries(trade: string): string[] {
  const canonical = canonicalizeTrade(trade);
  return TRADE_SEARCH_QUERIES[canonical] || [
    `${canonical} contractor`,
    `${canonical} company`,
    `licensed ${canonical}`,
    `${canonical} services`,
  ];
}

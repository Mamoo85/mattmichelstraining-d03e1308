// US metro reference for national market targeting.
// Each metro lists state, ZIP prefixes (used to filter NPI/Nursys/Medicare results),
// and an honest coverage label so checkout pages don't lie to buyers.

export type CoverageTier = "full" | "healthcare_full_trades_partial" | "healthcare_only";

export interface MetroOption {
  id: string;
  label: string;
  state: string;          // 2-letter
  stateName: string;
  zipPrefixes: string[];
  coverage: CoverageTier;
  coverageLabel: string;
  priorityMarket?: boolean; // top-tier launch markets (DFW, Phoenix)
}

export const US_METROS: MetroOption[] = [
  {
    id: "detroit",
    label: "Detroit Metro, MI",
    state: "MI",
    stateName: "Michigan",
    zipPrefixes: ["480", "481", "482", "483"],
    coverage: "full",
    coverageLabel: "Trades + Healthcare — full coverage (MIOSHA, BPL, LARA, BSEED, NPI, Nursys, CMS)",
  },
  {
    id: "dfw",
    label: "Dallas–Fort Worth, TX",
    state: "TX",
    stateName: "Texas",
    zipPrefixes: ["750", "751", "752", "753", "754", "760", "761", "762"],
    coverage: "healthcare_full_trades_partial",
    coverageLabel: "Healthcare full coverage (TX BON + Nursys + NPI + CMS) — Trades expanding Q2 2026",
    priorityMarket: true,
  },
  {
    id: "houston",
    label: "Houston Metro, TX",
    state: "TX",
    stateName: "Texas",
    zipPrefixes: ["770", "771", "772", "773", "774", "775"],
    coverage: "healthcare_only",
    coverageLabel: "Healthcare coverage (TX BON + Nursys + NPI + CMS) — Trades coming Q2 2026",
  },
  {
    id: "phoenix",
    label: "Phoenix Metro, AZ",
    state: "AZ",
    stateName: "Arizona",
    zipPrefixes: ["850", "851", "852", "853"],
    coverage: "full",
    coverageLabel: "Trades + Healthcare full coverage (AZ ROC + Nursys + NPI + CMS)",
    priorityMarket: true,
  },
  {
    id: "atlanta",
    label: "Atlanta Metro, GA",
    state: "GA",
    stateName: "Georgia",
    zipPrefixes: ["300", "301", "302", "303", "305", "311"],
    coverage: "healthcare_only",
    coverageLabel: "Healthcare only (Nursys + NPI + CMS) — Trades licensed at county level",
  },
  {
    id: "miami",
    label: "Miami Metro, FL",
    state: "FL",
    stateName: "Florida",
    zipPrefixes: ["330", "331", "332", "334"],
    coverage: "healthcare_only",
    coverageLabel: "Healthcare only (Nursys + NPI + CMS) — FL DBPR trades coverage in roadmap",
  },
  {
    id: "nyc",
    label: "New York City Metro",
    state: "NY",
    stateName: "New York",
    zipPrefixes: ["100", "101", "102", "103", "104", "110", "111", "112", "113", "114", "116"],
    coverage: "healthcare_only",
    coverageLabel: "Healthcare only (Nursys + NPI + CMS)",
  },
  {
    id: "la",
    label: "Los Angeles Metro, CA",
    state: "CA",
    stateName: "California",
    zipPrefixes: ["900", "901", "902", "904", "905", "906", "907", "908", "910", "911", "912", "913"],
    coverage: "healthcare_only",
    coverageLabel: "Healthcare only (Nursys + NPI + CMS)",
  },
  {
    id: "chicago",
    label: "Chicago Metro, IL",
    state: "IL",
    stateName: "Illinois",
    zipPrefixes: ["600", "601", "602", "603", "604", "605", "606"],
    coverage: "healthcare_only",
    coverageLabel: "Healthcare only (Nursys + NPI + CMS)",
  },
  {
    id: "philly",
    label: "Philadelphia Metro, PA",
    state: "PA",
    stateName: "Pennsylvania",
    zipPrefixes: ["190", "191"],
    coverage: "healthcare_only",
    coverageLabel: "Healthcare only (Nursys + NPI + CMS)",
  },
  {
    id: "boston",
    label: "Boston Metro, MA",
    state: "MA",
    stateName: "Massachusetts",
    zipPrefixes: ["021", "022", "023", "024"],
    coverage: "healthcare_only",
    coverageLabel: "Healthcare only (Nursys + NPI + CMS)",
  },
];

export const DEFAULT_METRO_ID = "detroit";

export function getMetroById(id: string | null | undefined): MetroOption {
  return US_METROS.find((m) => m.id === id) ?? US_METROS[0];
}

// Pricing override per metro — TX/AZ premium markets command higher pricing
export function getMetroPricing(metroId: string, plan: "standalone" | "bundle"): number {
  const premiumMetros = new Set(["dfw", "houston", "phoenix"]);
  if (premiumMetros.has(metroId)) {
    return plan === "bundle" ? 9900 : 24900; // $99 bundle, $249 standalone
  }
  return plan === "bundle" ? 7900 : 14900; // $79 bundle, $149 standalone (MI baseline)
}

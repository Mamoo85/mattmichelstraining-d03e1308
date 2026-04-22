// Distributor / supply-house lists per metro for Supply Radar play.
// These are the people who PAY for Supply Radar — they want to know which
// contractors in their territory are about to spend big.
// LinkedIn URLs use search-by-company so we surface real sales managers,
// not random employees.

export type Trade = "hvac" | "plumbing" | "electrical" | "general";

export interface Distributor {
  name: string;
  trade: Trade;
  city: string;
  linkedinSearchUrl: string; // search for sales managers / branch managers at this distributor
  note?: string;
}

function liSearch(company: string, title = "sales manager OR branch manager OR purchasing"): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`"${company}" (${title})`)}`;
}

export const METRO_DISTRIBUTORS: Record<string, Distributor[]> = {
  detroit: [
    { name: "Behler-Young", trade: "hvac", city: "Detroit", linkedinSearchUrl: liSearch("Behler-Young"), note: "Largest HVAC distributor in MI" },
    { name: "Johnstone Supply Detroit", trade: "hvac", city: "Detroit", linkedinSearchUrl: liSearch("Johnstone Supply Detroit") },
    { name: "R.E. Michel Company", trade: "hvac", city: "Detroit", linkedinSearchUrl: liSearch("R.E. Michel") },
    { name: "Standard Plumbing & Heating", trade: "plumbing", city: "Detroit", linkedinSearchUrl: liSearch("Standard Plumbing Heating Detroit") },
    { name: "Etna Supply", trade: "plumbing", city: "Detroit", linkedinSearchUrl: liSearch("Etna Supply") },
    { name: "Ferguson Plumbing", trade: "plumbing", city: "Detroit", linkedinSearchUrl: liSearch("Ferguson Detroit") },
    { name: "Madison Electric Company", trade: "electrical", city: "Warren", linkedinSearchUrl: liSearch("Madison Electric Company") },
    { name: "Kendall Electric", trade: "electrical", city: "Detroit", linkedinSearchUrl: liSearch("Kendall Electric") },
  ],
  dfw: [
    { name: "Lennox Stores DFW", trade: "hvac", city: "Dallas", linkedinSearchUrl: liSearch("Lennox Stores Dallas") },
    { name: "Johnstone Supply Dallas", trade: "hvac", city: "Dallas", linkedinSearchUrl: liSearch("Johnstone Supply Dallas") },
    { name: "Morrison Supply", trade: "plumbing", city: "Dallas", linkedinSearchUrl: liSearch("Morrison Supply") },
    { name: "Ferguson Dallas", trade: "plumbing", city: "Dallas", linkedinSearchUrl: liSearch("Ferguson Dallas") },
    { name: "Elliott Electric Supply", trade: "electrical", city: "Dallas", linkedinSearchUrl: liSearch("Elliott Electric Supply") },
  ],
  phoenix: [
    { name: "Goodman Distribution Phoenix", trade: "hvac", city: "Phoenix", linkedinSearchUrl: liSearch("Goodman Distribution Phoenix") },
    { name: "Johnstone Supply Phoenix", trade: "hvac", city: "Phoenix", linkedinSearchUrl: liSearch("Johnstone Supply Phoenix") },
    { name: "Hughes Supply", trade: "plumbing", city: "Phoenix", linkedinSearchUrl: liSearch("Hughes Supply Phoenix") },
    { name: "CED Phoenix", trade: "electrical", city: "Phoenix", linkedinSearchUrl: liSearch("CED Phoenix") },
  ],
};

/**
 * Pick the right distributor list for a signal based on its city/location and trade.
 * Falls back to Detroit (our home metro + densest list).
 */
export function distributorsFor(location: string | null, tradeHint: string | null): Distributor[] {
  const loc = (location || "").toLowerCase();
  let metro: keyof typeof METRO_DISTRIBUTORS = "detroit";
  if (/dallas|fort worth|plano|arlington|irving|frisco|dfw/.test(loc)) metro = "dfw";
  else if (/phoenix|scottsdale|mesa|tempe|chandler|gilbert/.test(loc)) metro = "phoenix";

  const all = METRO_DISTRIBUTORS[metro] || METRO_DISTRIBUTORS.detroit;

  // Match by trade if we can detect one
  const t = (tradeHint || "").toLowerCase();
  let trade: Trade | null = null;
  if (/hvac|heating|cooling|mechanical|boiler|refriger/.test(t)) trade = "hvac";
  else if (/plumb|pipe/.test(t)) trade = "plumbing";
  else if (/electric/.test(t)) trade = "electrical";

  if (trade) {
    const matched = all.filter(d => d.trade === trade);
    if (matched.length) return matched.slice(0, 3);
  }
  // Otherwise return one from each major trade for variety
  const out: Distributor[] = [];
  for (const tr of ["hvac", "plumbing", "electrical"] as Trade[]) {
    const first = all.find(d => d.trade === tr);
    if (first) out.push(first);
  }
  return out.length ? out : all.slice(0, 3);
}

/** Rough commodity prediction from trade — feeds Supply Radar pitch */
export function predictedCommodities(tradeHint: string | null): string[] {
  const t = (tradeHint || "").toLowerCase();
  if (/hvac|mechanical|boiler/.test(t)) return ["commercial HVAC equipment", "copper line sets", "refrigerant", "ductwork"];
  if (/plumb/.test(t)) return ["copper pipe", "PEX", "fixtures", "water heaters"];
  if (/electric/.test(t)) return ["wire", "panels", "conduit", "switchgear"];
  if (/roof/.test(t)) return ["shingles", "underlayment", "ice & water shield"];
  return ["materials", "equipment", "consumables"];
}

/** Rough $ value prediction based on permit + hire counts */
export function predictedSpend(permits: number, hires: number): string {
  const base = permits * 8000 + hires * 12000;
  const low = Math.max(20000, Math.round(base * 0.7 / 1000) * 1000);
  const high = Math.max(60000, Math.round(base * 1.6 / 1000) * 1000);
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  return `${fmt(low)}–${fmt(high)} over next 60 days`;
}

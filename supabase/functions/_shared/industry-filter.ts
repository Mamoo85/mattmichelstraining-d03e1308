// Industry filter for contractor/trades-only outreach.
// Missed-Call Catch, Dead Lead Reactivation, and homeowner permit signals
// are contractor offers — pitching them to a manufacturer or commercial
// property manager is wrong-target and instantly destroys credibility.

const TRADES_KEYWORDS = [
  "hvac", "heating", "cooling", "air condition", "furnace", "boiler",
  "plumb", "drain", "sewer", "water heater",
  "electric", "electrician",
  "roof", "shingle",
  "gutter",
  "pest", "exterminat", "rodent",
  "restoration", "water damage", "mold", "fire damage",
  "exterior", "siding", "window", "paint",
  "foundation", "concrete", "masonry",
  "demo", "demolition", "junk removal", "haul",
  "tree", "arborist", "landscape", "lawn",
  "contractor", "remodel", "renovation", "handyman",
  "construction", "general contract", "build",
  "fence", "deck", "patio",
  "garage door", "insulation", "drywall",
  "chimney", "septic",
  "cleaning service", "pressure wash", "carpet",
];

/**
 * Returns true when the industry string matches a residential trade
 * eligible for the contractor pitch (Missed-Call / Dead Lead / homeowner signals).
 *
 * Defaults to TRUE on null/empty/unknown — many enriched leads have no
 * industry tag, and our prospect lists are already trades-curated. Only
 * skip when we KNOW the industry is non-trades (e.g. manufacturing,
 * property mgmt, real estate, restaurant, hospital, dealership).
 */
export function isTradesIndustry(industry: string | null | undefined): boolean {
  if (!industry) return true; // unknown → assume trades (lists are pre-curated)
  const s = String(industry).toLowerCase().trim();
  if (!s) return true;

  // Hard exclusions — known non-trades verticals
  const NON_TRADES = [
    "manufactur", "factory", "industrial supply",
    "property manage", "real estate", "broker", "realtor",
    "restaurant", "hospitality", "hotel", "food service", "catering",
    "dealership", "auto sale", "car dealer",
    "hospital", "clinic", "medical", "dental", "pharmac",
    "law firm", "attorney", "legal",
    "accounting", "cpa", "tax prep",
    "bank", "credit union", "insurance",
    "school", "university", "education",
    "church", "nonprofit",
    "logistics", "trucking", "freight", "warehous",
    "retail", "ecommerce",
    "saas", "software", "tech compan",
  ];
  for (const bad of NON_TRADES) {
    if (s.includes(bad)) return false;
  }

  // Positive match (or unknown vertical we don't recognize → allow)
  for (const good of TRADES_KEYWORDS) {
    if (s.includes(good)) return true;
  }

  // Unknown industry string — allow (curated lists)
  return true;
}

/**
 * Normalize industry → human noun for body copy.
 * "HVAC Contractors" → "HVAC", "Plumbing Services" → "plumbing".
 * Falls back to "contractor" so the email never says "we help businesses".
 */
export function tradeNoun(industry: string | null | undefined): string {
  if (!industry) return "contractor";
  const s = String(industry).toLowerCase();
  if (s.includes("hvac") || s.includes("heating") || s.includes("cooling")) return "HVAC";
  if (s.includes("plumb")) return "plumbing";
  if (s.includes("electric")) return "electrical";
  if (s.includes("roof")) return "roofing";
  if (s.includes("gutter")) return "gutter";
  if (s.includes("pest")) return "pest control";
  if (s.includes("restoration") || s.includes("water damage") || s.includes("mold")) return "restoration";
  if (s.includes("siding") || s.includes("window") || s.includes("exterior")) return "exterior";
  if (s.includes("foundation") || s.includes("concrete") || s.includes("masonry")) return "foundation";
  if (s.includes("demo") || s.includes("junk") || s.includes("haul")) return "demo & junk-removal";
  if (s.includes("tree") || s.includes("arborist")) return "tree service";
  if (s.includes("landscape") || s.includes("lawn")) return "landscape";
  if (s.includes("paint")) return "painting";
  return "contractor";
}

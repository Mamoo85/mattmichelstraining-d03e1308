// Shared per-pool discovery recipes used by every non-Apollo discovery lane.
// Centralizing this kills 6× duplication.

export interface PoolRecipe {
  // Free-text keywords for SERP / Places / Sonar prompts
  keywords: string[];
  // Foursquare category IDs (https://docs.foursquare.com/data-products/docs/categories)
  fsq_categories?: string[];
  // OSM Overpass tag filters (key=value)
  osm_tags?: string[];
  // SAM.gov NAICS codes
  naics?: string[];
  // Default state list
  states: string[];
  // Per-lane upper bound on discovered rows per run
  per_run?: number;
  // Suggested target titles for SERP/sonar prompts
  titles: string[];
}

export const POOL_RECIPES: Record<string, PoolRecipe> = {
  staffing_agency: {
    keywords: ["staffing agency", "nurse staffing agency", "healthcare staffing"],
    fsq_categories: ["12013"], // Professional services
    osm_tags: ["office=employment_agency"],
    naics: ["561311", "561312", "561320"],
    states: ["MI", "OH", "IN", "IL"],
    per_run: 30,
    titles: ["owner", "ceo", "president", "director of recruiting"],
  },
  hospital_hr: {
    keywords: ["hospital", "medical center", "regional health system"],
    fsq_categories: ["15014"], // Hospital
    osm_tags: ["amenity=hospital"],
    naics: ["622110", "622210", "622310"],
    states: ["MI", "OH", "IN", "IL"],
    per_run: 30,
    titles: ["chief nursing officer", "vp human resources", "director of nursing"],
  },
  trade_contractor: {
    keywords: [
      "roofing contractor",
      "hvac contractor",
      "plumber",
      "electrician",
      "general contractor",
    ],
    fsq_categories: ["11138", "12095"], // construction / trade
    osm_tags: ["craft=plumber", "craft=electrician", "craft=hvac", "craft=roofer"],
    naics: ["238220", "238210", "238160", "238150", "238110"],
    states: ["MI"],
    per_run: 40,
    titles: ["owner", "general manager", "operations manager"],
  },
  mortgage_lo: {
    keywords: ["mortgage broker", "mortgage company", "home loan office"],
    fsq_categories: ["11045"], // Financial services
    osm_tags: ["office=financial"],
    naics: ["522292", "522310"],
    states: ["MI", "OH"],
    per_run: 40,
    titles: ["loan officer", "mortgage broker", "senior loan officer", "branch manager"],
  },
  property_manager: {
    keywords: ["property management", "property manager", "rental management"],
    fsq_categories: ["11103"],
    osm_tags: ["office=estate_agent"],
    naics: ["531311"],
    states: ["MI"],
    per_run: 30,
    titles: ["owner", "property manager", "operations director"],
  },
  real_estate: {
    keywords: ["real estate brokerage", "realtor office", "real estate agent"],
    fsq_categories: ["11103"],
    osm_tags: ["office=estate_agent"],
    naics: ["531210"],
    states: ["MI"],
    per_run: 30,
    titles: ["broker", "managing broker", "team lead"],
  },
  dental_medical: {
    keywords: ["dental office", "dentist", "medical clinic", "family practice"],
    fsq_categories: ["15029", "15012"],
    osm_tags: ["amenity=dentist", "amenity=clinic"],
    naics: ["621210", "621111"],
    states: ["MI"],
    per_run: 30,
    titles: ["owner", "practice administrator", "office manager"],
  },
  auto_repair: {
    keywords: ["auto repair", "mechanic shop", "car repair", "transmission shop"],
    fsq_categories: ["11146"],
    osm_tags: ["shop=car_repair"],
    naics: ["811111", "811112"],
    states: ["MI"],
    per_run: 30,
    titles: ["owner", "general manager", "shop manager"],
  },
};

// State name expansion for SERP / Sonar prompts that prefer full names
export const STATE_NAMES: Record<string, string> = {
  MI: "Michigan",
  OH: "Ohio",
  IN: "Indiana",
  IL: "Illinois",
  TX: "Texas",
  FL: "Florida",
  TN: "Tennessee",
  GA: "Georgia",
  AZ: "Arizona",
  NC: "North Carolina",
  PA: "Pennsylvania",
};

// State bbox for Overpass (south, west, north, east)
export const STATE_BBOX: Record<string, [number, number, number, number]> = {
  MI: [41.696, -90.418, 48.306, -82.413],
  OH: [38.403, -84.820, 42.327, -80.518],
  IN: [37.771, -88.097, 41.760, -84.784],
  IL: [36.970, -91.513, 42.508, -87.494],
};

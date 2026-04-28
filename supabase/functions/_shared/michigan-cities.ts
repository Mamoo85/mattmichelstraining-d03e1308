// Statewide Michigan city catalog used for serial Google Places sweeps.
// Tiered by population/contractor density so we can prioritize large markets first
// and back-fill secondary/tertiary markets opportunistically.

export type MichiganTier = "primary" | "secondary" | "tertiary";

export interface MichiganCity {
  city: string;
  county: string;
  tier: MichiganTier;
}

export const MICHIGAN_CITIES: MichiganCity[] = [
  // Primary — Metro Detroit + major metros (territory_priority = 1)
  { city: "Detroit", county: "Wayne", tier: "primary" },
  { city: "Grosse Pointe", county: "Wayne", tier: "primary" },
  { city: "Grosse Pointe Park", county: "Wayne", tier: "primary" },
  { city: "Grosse Pointe Farms", county: "Wayne", tier: "primary" },
  { city: "St. Clair Shores", county: "Macomb", tier: "primary" },
  { city: "Warren", county: "Macomb", tier: "primary" },
  { city: "Sterling Heights", county: "Macomb", tier: "primary" },
  { city: "Troy", county: "Oakland", tier: "primary" },
  { city: "Royal Oak", county: "Oakland", tier: "primary" },
  { city: "Birmingham", county: "Oakland", tier: "primary" },
  { city: "Bloomfield Hills", county: "Oakland", tier: "primary" },
  { city: "Southfield", county: "Oakland", tier: "primary" },
  { city: "Farmington Hills", county: "Oakland", tier: "primary" },
  { city: "Novi", county: "Oakland", tier: "primary" },
  { city: "Livonia", county: "Wayne", tier: "primary" },
  { city: "Dearborn", county: "Wayne", tier: "primary" },
  { city: "Ann Arbor", county: "Washtenaw", tier: "primary" },

  // Secondary — Mid-size markets (territory_priority = 2)
  { city: "Grand Rapids", county: "Kent", tier: "secondary" },
  { city: "Lansing", county: "Ingham", tier: "secondary" },
  { city: "East Lansing", county: "Ingham", tier: "secondary" },
  { city: "Flint", county: "Genesee", tier: "secondary" },
  { city: "Kalamazoo", county: "Kalamazoo", tier: "secondary" },
  { city: "Saginaw", county: "Saginaw", tier: "secondary" },
  { city: "Bay City", county: "Bay", tier: "secondary" },
  { city: "Midland", county: "Midland", tier: "secondary" },
  { city: "Pontiac", county: "Oakland", tier: "secondary" },
  { city: "Rochester Hills", county: "Oakland", tier: "secondary" },
  { city: "Ypsilanti", county: "Washtenaw", tier: "secondary" },
  { city: "Wyoming", county: "Kent", tier: "secondary" },
  { city: "Kentwood", county: "Kent", tier: "secondary" },
  { city: "Holland", county: "Ottawa", tier: "secondary" },
  { city: "Muskegon", county: "Muskegon", tier: "secondary" },
  { city: "Battle Creek", county: "Calhoun", tier: "secondary" },
  { city: "Jackson", county: "Jackson", tier: "secondary" },
  { city: "Port Huron", county: "St. Clair", tier: "secondary" },

  // Tertiary — Outstate / Up North (territory_priority = 3)
  { city: "Traverse City", county: "Grand Traverse", tier: "tertiary" },
  { city: "Petoskey", county: "Emmet", tier: "tertiary" },
  { city: "Cadillac", county: "Wexford", tier: "tertiary" },
  { city: "Mount Pleasant", county: "Isabella", tier: "tertiary" },
  { city: "Big Rapids", county: "Mecosta", tier: "tertiary" },
  { city: "Alpena", county: "Alpena", tier: "tertiary" },
  { city: "Marquette", county: "Marquette", tier: "tertiary" },
  { city: "Sault Ste. Marie", county: "Chippewa", tier: "tertiary" },
  { city: "Escanaba", county: "Delta", tier: "tertiary" },
  { city: "Houghton", county: "Houghton", tier: "tertiary" },
  { city: "Iron Mountain", county: "Dickinson", tier: "tertiary" },
  { city: "Adrian", county: "Lenawee", tier: "tertiary" },
  { city: "Monroe", county: "Monroe", tier: "tertiary" },
  { city: "Owosso", county: "Shiawassee", tier: "tertiary" },
];

export function tierToPriority(tier: MichiganTier): 1 | 2 | 3 {
  return tier === "primary" ? 1 : tier === "secondary" ? 2 : 3;
}

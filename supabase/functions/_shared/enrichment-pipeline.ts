// Shared enrichment helpers — single source of truth for:
//  - aggregator/job-board domain detection
//  - enterprise targeting blocklist
//  - Google Places website fallback
//  - clean-website normalization
//
// Promoted out of techalert-enrich so every enrichment function can use it.

const AGGREGATOR_DOMAINS = [
  "indeed", "ziprecruiter", "linkedin", "github", "sec.gov", "uspto", "sam.gov",
  "eventbrite", "usaspending", "nlrb", "courtlistener", "consumerfinance",
  "detroitmi.gov", "michigan.gov", "mitalent.org", "simplyhired", "glassdoor",
  "monster.com", "careerbuilder", "snagajob", "jobs2careers", "talent.com",
  "jobcase", "google.com", "facebook.com", "yelp.com", "bbb.org", "yellowpages",
  "manta.com", "dnb.com", "bizapedia", "buzzfile", "opencorporates",
  "houzz.com", "thumbtack", "homeadvisor", "angi.com", "angieslist",
  "yellow.com", "superpages", "merchantcircle",
];

const ENTERPRISE_BLOCKLIST = [
  "ford motor", "general motors", "stellantis", "dte energy", "consumers energy",
  "wayne state", "university of michigan", "michigan state", "henry ford health",
  "beaumont", "trinity health", "ascension", "corewell", "magna international",
  "lear", "borgwarner", "delphi", "denso", "fca", " gm ", " ge ", "amazon",
  "google", "microsoft", "wayne resa", "comerica", "rocket mortgage",
  "quicken loans", "ilitch", "blue cross blue shield",
];

export function isAggregatorDomain(d: string | null | undefined): boolean {
  if (!d) return true;
  const dl = d.toLowerCase();
  return AGGREGATOR_DOMAINS.some((a) => dl.includes(a));
}

export function isEnterprise(name: string, employeeCount?: number | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  if (ENTERPRISE_BLOCKLIST.some((b) => n.includes(b))) return true;
  if (employeeCount && employeeCount > 500) return true;
  return false;
}

export function domainFromUrl(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const u = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

/** Returns the website if its hostname is real, else null. */
export function cleanWebsite(raw?: string | null): string | null {
  const d = domainFromUrl(raw);
  if (!d || isAggregatorDomain(d)) return null;
  return `https://${d}`;
}

const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

/** Google Places fallback: Find Place + Place Details → website. Skips aggregator results. */
export async function googlePlacesWebsite(
  name: string,
  city?: string | null,
  state?: string | null,
): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY || !name) return null;
  try {
    const q = encodeURIComponent([name, city, state || "MI"].filter(Boolean).join(" "));
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id&key=${GOOGLE_MAPS_API_KEY}`;
    const f = await fetch(findUrl).then((r) => r.json());
    const pid = f?.candidates?.[0]?.place_id;
    if (!pid) return null;
    const detUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=website,formatted_phone_number&key=${GOOGLE_MAPS_API_KEY}`;
    const d = await fetch(detUrl).then((r) => r.json());
    const site = d?.result?.website || null;
    return cleanWebsite(site);
  } catch (e) {
    console.warn("[enrichment-pipeline] places:", e instanceof Error ? e.message : e);
    return null;
  }
}

export const SHARED_AGGREGATOR_DOMAINS = AGGREGATOR_DOMAINS;
export const SHARED_ENTERPRISE_BLOCKLIST = ENTERPRISE_BLOCKLIST;

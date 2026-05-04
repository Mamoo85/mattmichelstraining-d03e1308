// Centralized domain resolver — strips aggregators, canonicalizes, and falls
// back to Google Places when a website is missing or dirty.

const AGGREGATORS = new Set([
  "yelp.com", "facebook.com", "fb.com", "instagram.com", "linkedin.com",
  "yellowpages.com", "yp.com", "bbb.org", "angi.com", "angieslist.com",
  "homeadvisor.com", "thumbtack.com", "houzz.com", "porch.com", "nextdoor.com",
  "manta.com", "mapquest.com", "merchantcircle.com", "superpages.com",
  "citysearch.com", "foursquare.com", "googleusercontent.com", "sites.google.com",
  "wix.com", "squarespace.com", "wordpress.com", "weebly.com", "godaddysites.com",
  "google.com", "bing.com", "yahoo.com",
]);

const JUNK = new Set([
  "example.com", "test.com", "yourdomain.com", "yoursite.com",
  "domain.com", "schema.org", "w3.org", "gravatar.com", "cloudflare.com",
]);

export function isAggregator(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (AGGREGATORS.has(h) || JUNK.has(h)) return true;
  // Also strip subdomains of aggregators (e.g. m.yelp.com)
  for (const agg of AGGREGATORS) {
    if (h.endsWith("." + agg)) return true;
  }
  return false;
}

export function canonicalize(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (isAggregator(host)) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

export interface ResolveOpts {
  businessName: string;
  city?: string;
  state?: string;
  existingWebsite?: string | null;
}

/** Resolve a real website, falling back to Google Places if needed. */
export async function resolveDomain(opts: ResolveOpts): Promise<string | null> {
  const canon = canonicalize(opts.existingWebsite);
  if (canon) return canon;

  const PLACES_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
  if (!PLACES_KEY) return null;

  try {
    const q = encodeURIComponent(`${opts.businessName} ${opts.city || ""} ${opts.state || ""}`.trim());
    const findRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id&key=${PLACES_KEY}`,
    );
    const find = await findRes.json();
    const placeId = find?.candidates?.[0]?.place_id;
    if (!placeId) return null;

    const detRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${PLACES_KEY}`,
    );
    const det = await detRes.json();
    return canonicalize(det?.result?.website || null);
  } catch {
    return null;
  }
}

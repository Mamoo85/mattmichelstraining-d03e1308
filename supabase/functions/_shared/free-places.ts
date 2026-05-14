// =============================================================================
// Free Places — OpenStreetMap Overpass API (primary), Yelp Fusion (fallback).
// =============================================================================
// Replaces Google Places Text Search / Place Details for B2B prospect discovery.
// All zero-cost (Yelp free tier = 5,000/day if YELP_API_KEY is set).
// =============================================================================

export interface FreePlace {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  website?: string;
  lat?: number;
  lon?: number;
  source: "overpass" | "yelp";
}

const YELP_API_KEY = Deno.env.get("YELP_API_KEY") || "";

/** OSM Overpass — query businesses by category in a bounding box. Free, no key. */
export async function overpassSearchBusinesses(opts: {
  /** OSM "shop" or "amenity" or "office" tag to match */
  tag: string;
  value: string;
  /** Bounding box [south, west, north, east] — Detroit metro default */
  bbox?: [number, number, number, number];
  limit?: number;
}): Promise<FreePlace[]> {
  const bbox = opts.bbox || [42.0, -83.6, 42.7, -82.7]; // Detroit metro
  const limit = opts.limit ?? 50;
  const query = `
    [out:json][timeout:25];
    (
      node["${opts.tag}"="${opts.value}"](${bbox.join(",")});
      way["${opts.tag}"="${opts.value}"](${bbox.join(",")});
    );
    out tags center ${limit};
  `.trim();

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain", "User-Agent": "DWA-Prospector/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const elements = j?.elements || [];
    return elements.map((e: any): FreePlace => ({
      name: e.tags?.name || "Unknown",
      address: [e.tags?.["addr:housenumber"], e.tags?.["addr:street"]].filter(Boolean).join(" ") || undefined,
      city: e.tags?.["addr:city"],
      state: e.tags?.["addr:state"],
      zip: e.tags?.["addr:postcode"],
      phone: e.tags?.phone || e.tags?.["contact:phone"],
      website: e.tags?.website || e.tags?.["contact:website"],
      lat: e.lat ?? e.center?.lat,
      lon: e.lon ?? e.center?.lon,
      source: "overpass",
    })).filter((p: FreePlace) => p.name && p.name !== "Unknown");
  } catch {
    return [];
  }
}

/** Yelp Fusion — free 5,000/day. Requires YELP_API_KEY. */
export async function yelpSearchBusinesses(opts: {
  term: string;
  location: string;
  limit?: number;
}): Promise<FreePlace[]> {
  if (!YELP_API_KEY) return [];
  try {
    const url = new URL("https://api.yelp.com/v3/businesses/search");
    url.searchParams.set("term", opts.term);
    url.searchParams.set("location", opts.location);
    url.searchParams.set("limit", String(opts.limit ?? 50));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${YELP_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.businesses || []).map((b: any): FreePlace => ({
      name: b.name,
      address: b.location?.address1,
      city: b.location?.city,
      state: b.location?.state,
      zip: b.location?.zip_code,
      phone: b.phone || b.display_phone,
      website: b.url,
      lat: b.coordinates?.latitude,
      lon: b.coordinates?.longitude,
      source: "yelp",
    }));
  } catch {
    return [];
  }
}

/** Trade-vertical → OSM tag mapping. */
export const TRADE_OSM_TAGS: Record<string, { tag: string; value: string }[]> = {
  hvac: [{ tag: "craft", value: "hvac" }, { tag: "office", value: "hvac" }],
  plumbing: [{ tag: "craft", value: "plumber" }],
  electrical: [{ tag: "craft", value: "electrician" }],
  roofing: [{ tag: "craft", value: "roofer" }],
  painting: [{ tag: "craft", value: "painter" }],
  carpentry: [{ tag: "craft", value: "carpenter" }],
  landscaping: [{ tag: "shop", value: "garden_centre" }, { tag: "craft", value: "gardener" }],
  pest_control: [{ tag: "shop", value: "pest_control" }],
  contractor: [{ tag: "office", value: "construction" }, { tag: "craft", value: "general_contractor" }],
  dental: [{ tag: "amenity", value: "dentist" }, { tag: "healthcare", value: "dentist" }],
  industrial: [{ tag: "landuse", value: "industrial" }, { tag: "office", value: "company" }],
};

/** Convenience: trade vertical + city → places, free first then optional Yelp. */
export async function freePlacesByTrade(trade: string, location: string, opts: { yelpFallback?: boolean; limit?: number } = {}): Promise<FreePlace[]> {
  const tags = TRADE_OSM_TAGS[trade.toLowerCase()] || [{ tag: "shop", value: trade }];
  const all: FreePlace[] = [];
  for (const t of tags) {
    const r = await overpassSearchBusinesses({ tag: t.tag, value: t.value, limit: opts.limit ?? 50 });
    all.push(...r);
  }
  if (all.length === 0 && opts.yelpFallback) {
    const y = await yelpSearchBusinesses({ term: trade, location, limit: opts.limit ?? 50 });
    all.push(...y);
  }
  // Dedupe by name+address
  const seen = new Set<string>();
  return all.filter((p) => {
    const k = `${p.name}|${p.address || ""}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

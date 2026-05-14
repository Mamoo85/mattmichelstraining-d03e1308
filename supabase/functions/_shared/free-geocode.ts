// =============================================================================
// Free Geocoding — US Census Geocoder (primary) + Nominatim/OSM (fallback).
// =============================================================================
// Replaces Google Address Validation for ~95% of US addresses (BSEED, ArcGIS,
// county records). All zero-cost. Used by anti-hallucination.validateAddress().
// =============================================================================

export interface FreeGeocodeResult {
  pass: boolean;
  formatted?: string;
  lat?: number;
  lon?: number;
  source?: "census" | "nominatim";
  confidence?: string;
}

/** US Census Geocoder — free, unlimited, no key, US-only. */
export async function censusGeocode(input: { address: string; city?: string; state?: string; zip?: string }): Promise<FreeGeocodeResult> {
  try {
    const addr = [input.address, input.city, input.state, input.zip].filter(Boolean).join(", ");
    const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
    url.searchParams.set("address", addr);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return { pass: false };
    const j = await res.json();
    const matches = j?.result?.addressMatches || [];
    if (!matches.length) return { pass: false };
    const m = matches[0];
    const lat = m?.coordinates?.y;
    const lon = m?.coordinates?.x;
    if (typeof lat !== "number" || typeof lon !== "number") return { pass: false };
    return {
      pass: true,
      formatted: m.matchedAddress || addr,
      lat,
      lon,
      source: "census",
      confidence: m.tigerLine?.side || "match",
    };
  } catch {
    return { pass: false };
  }
}

// Nominatim is rate-limited to 1 req/sec — serialize via a simple in-process gate.
let nominatimChain: Promise<unknown> = Promise.resolve();
function nominatimQueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = nominatimChain.then(() => new Promise<void>((r) => setTimeout(r, 1100))).then(fn);
  nominatimChain = next.catch(() => {});
  return next as Promise<T>;
}

/** Nominatim/OpenStreetMap — free, requires User-Agent, 1 req/sec. */
export async function nominatimGeocode(input: { address: string; city?: string; state?: string; zip?: string }): Promise<FreeGeocodeResult> {
  return nominatimQueue(async () => {
    try {
      const q = [input.address, input.city, input.state, input.zip, "USA"].filter(Boolean).join(", ");
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", q);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "us");

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "DetroitWebAgency-LeadValidator/1.0 (matt@detroitwebagent.com)" },
      });
      if (!res.ok) return { pass: false };
      const arr = await res.json();
      if (!Array.isArray(arr) || arr.length === 0) return { pass: false };
      const r = arr[0];
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      if (!isFinite(lat) || !isFinite(lon)) return { pass: false };
      return {
        pass: true,
        formatted: r.display_name || input.address,
        lat,
        lon,
        source: "nominatim",
        confidence: r.type || "match",
      };
    } catch {
      return { pass: false };
    }
  });
}

/** Waterfall: Census → Nominatim. Returns first hit or { pass: false }. */
export async function freeGeocode(input: { address: string; city?: string; state?: string; zip?: string }): Promise<FreeGeocodeResult> {
  const c = await censusGeocode(input);
  if (c.pass) return c;
  const n = await nominatimGeocode(input);
  return n;
}

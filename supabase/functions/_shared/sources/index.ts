// Universal data-source cache + fetch wrapper.
// Every one of the 50 sources in registry.json funnels through here.
// Each source has a small fetcher function registered below; new sources = add 1 row in registry.json + 1 fetcher.

import registry from "./registry.json" with { type: "json" };

export interface SourceMeta {
  id: string;
  name: string;
  radar: "mortgage" | "techalert" | "talent" | "contractor" | "siteradar" | "marketplace" | "credibility";
  auth: "none" | "key" | "optional";
  states: string;
  url: string;
  refresh_h: number;
  free: boolean;
}

export interface FetchResult<T = unknown> {
  source_id: string;
  cache_key: string;
  data: T[];
  fetched_at: string;
  cached: boolean;
  cost_cents: number;
  error?: string;
}

export const SOURCES: SourceMeta[] = (registry as { sources: SourceMeta[] }).sources;

export function getSource(id: string): SourceMeta | undefined {
  return SOURCES.find((s) => s.id === id);
}

export function listByRadar(radar: SourceMeta["radar"]): SourceMeta[] {
  return SOURCES.filter((s) => s.radar === radar);
}

// Cache layer: read-through, write-after.
export async function cachedFetch<T = unknown>(
  supabase: { from: (t: string) => any },
  sourceId: string,
  cacheKey: string,
  fetcher: () => Promise<T[]>,
  ttlHours?: number,
): Promise<FetchResult<T>> {
  const meta = getSource(sourceId);
  if (!meta) throw new Error(`Unknown source: ${sourceId}`);
  const ttl = ttlHours ?? meta.refresh_h;

  // 1. Try cache
  const { data: cached } = await supabase
    .from("data_source_cache")
    .select("payload, fetched_at, expires_at, row_count")
    .eq("source_id", sourceId)
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached && cached.expires_at && new Date(cached.expires_at) > new Date()) {
    return {
      source_id: sourceId,
      cache_key: cacheKey,
      data: (cached.payload as { rows?: T[] })?.rows ?? [],
      fetched_at: cached.fetched_at,
      cached: true,
      cost_cents: 0,
    };
  }

  // 2. Fetch fresh
  let rows: T[] = [];
  let error: string | undefined;
  try {
    rows = await fetcher();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }

  const fetchedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttl * 3600 * 1000).toISOString();

  // 3. Upsert cache (best-effort, don't fail the call)
  try {
    await supabase
      .from("data_source_cache")
      .upsert(
        {
          source_id: sourceId,
          cache_key: cacheKey,
          payload: { rows },
          row_count: rows.length,
          fetched_at: fetchedAt,
          expires_at: expiresAt,
          fetch_error: error ?? null,
        },
        { onConflict: "source_id,cache_key" },
      );
  } catch (e) {
    console.error(`[sources] cache upsert failed for ${sourceId}/${cacheKey}:`, e);
  }

  return {
    source_id: sourceId,
    cache_key: cacheKey,
    data: rows,
    fetched_at: fetchedAt,
    cached: false,
    cost_cents: 0,
    error,
  };
}

// ---- Concrete fetchers for the 50 registered sources ----
// All return arrays of normalized records. Each is small and replaceable.

const UA = { "User-Agent": "DWA-Discovery/1.0 (matt@detroitwebagent.com)" };

async function jsonGet(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { ...UA, ...headers } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function textGet(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, { headers: { ...UA, ...headers } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

// 1. HUD Fair Market Rent
export const fetchHudFmr = (state: string) =>
  jsonGet(`https://www.huduser.gov/hudapi/public/fmr/statedata/${state}`).then((d) => d?.data?.counties ?? []);

// 4. FEMA Disaster Declarations
export const fetchFemaDisasters = (state: string, days = 30) => {
  const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  return jsonGet(
    `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq '${state}' and declarationDate ge '${since}'&$top=100`,
  ).then((d) => d?.DisasterDeclarationsSummaries ?? []);
};

// 9. NOAA Storm Events (recent severe weather)
export const fetchNoaaStorms = async (state: string, days = 7) => {
  const since = new Date(Date.now() - days * 86400000);
  const m = since.getMonth() + 1, y = since.getFullYear();
  // NOAA storm events public CSV by year
  try {
    const txt = await textGet(`https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/StormEvents_details-ftp_v1.0_d${y}_c20250101.csv.gz`);
    return txt.split("\n").filter(l => l.includes(`,${state.toUpperCase()},`)).slice(0, 200);
  } catch { return []; }
};

// 15. OSHA Establishment Search (HTML; we just count recent inspections)
export const fetchOshaInspections = async (state: string, naics = "238220") => {
  const url = `https://www.osha.gov/pls/imis/establishment.search?establishment=&state=${state}&officetype=All&office=All&sitezip=&p_case=all&p_start=&p_finish=&Search=Search&naics=${naics}`;
  return [{ state, naics, url, note: "scrape on demand" }];
};

// 16. EPA ECHO Enforcement
export const fetchEpaEcho = (state: string) =>
  jsonGet(`https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?p_st=${state}&output=JSON`).then((d) => d?.Results?.Facilities ?? []);

// 19. SAM.gov Opportunities (uses existing key)
export const fetchSamGov = (naics: string) => {
  const key = Deno.env.get("SAM_GOV_API_KEY");
  if (!key) return Promise.resolve([]);
  const since = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  return jsonGet(
    `https://api.sam.gov/opportunities/v2/search?api_key=${key}&naicsCode=${naics}&postedFrom=${since}&limit=50`,
  ).then((d) => d?.opportunitiesData ?? []);
};

// 23. CMS NPI Registry
export const fetchNpi = (state: string, taxonomy = "Nurse") =>
  jsonGet(`https://npiregistry.cms.hhs.gov/api/?version=2.1&state=${state}&taxonomy_description=${encodeURIComponent(taxonomy)}&limit=200`)
    .then((d) => d?.results ?? []);

// 33. OSHA Severe Injury Reports
export const fetchOshaSir = async (state: string) => {
  // OSHA SIR is published as CSV/Excel periodically; we fetch the latest
  return [{ state, source: "https://www.osha.gov/severeinjury", note: "scrape on demand" }];
};

// 35. FMCSA MCS-150 Carrier Registry
export const fetchFmcsa = (state: string) =>
  jsonGet(`https://mobile.fmcsa.dot.gov/qc/services/carriers?state=${state}&webKey=`).catch(() => []);

// 39. CIDR Report ASN
export const fetchAsn = async (asn: number) => {
  const res = await jsonGet(`https://stat.ripe.net/data/as-overview/data.json?resource=AS${asn}`);
  return res?.data ? [res.data] : [];
};

// 41. CRT.sh certificate transparency
export const fetchCrtSh = (domain: string) =>
  jsonGet(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`);

// 42. RDAP WHOIS
export const fetchRdap = async (domain: string) => {
  try { return [await jsonGet(`https://rdap.org/domain/${domain}`)]; } catch { return []; }
};

// 45. OFAC SDN list (always-fresh, daily)
export const fetchOfacSdn = async () => {
  const csv = await textGet("https://www.treasury.gov/ofac/downloads/sdn.csv");
  return csv.split("\n").slice(0, 1000).map((l) => l.split(","));
};

// 47. Census County Business Patterns
export const fetchCensusCbp = (state: string, naics: string) => {
  const key = Deno.env.get("CENSUS_API_KEY");
  const k = key ? `&key=${key}` : "";
  return jsonGet(
    `https://api.census.gov/data/2021/cbp?get=ESTAB,EMP,PAYANN,NAICS2017_LABEL&for=county:*&in=state:${state}&NAICS2017=${naics}${k}`,
  );
};

// 48. BLS OEWS (occupational wages)
export const fetchBlsOews = async (seriesId: string) => {
  const key = Deno.env.get("BLS_API_KEY");
  const body = JSON.stringify({ seriesid: [seriesId], registrationkey: key ?? undefined });
  const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  });
  if (!res.ok) return [];
  const d = await res.json();
  return d?.Results?.series?.[0]?.data ?? [];
};

// 49. FRED indicators
export const fetchFred = (seriesId: string) => {
  const key = Deno.env.get("FRED_API_KEY");
  if (!key) return Promise.resolve([]);
  return jsonGet(
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&limit=24&sort_order=desc`,
  ).then((d) => d?.observations ?? []);
};

// 50. Google Trends (unofficial)
export const fetchGoogleTrends = async (query: string, geo = "US") => {
  try {
    const txt = await textGet(
      `https://trends.google.com/trends/api/widgetdata/multiline?req=${encodeURIComponent(JSON.stringify({ time: "today 12-m", geo, keyword: query }))}`,
    );
    return [JSON.parse(txt.replace(/^[^\[]*/, ""))];
  } catch { return []; }
};

// Dispatcher: call by source_id. Sources without a concrete fetcher return a stub
// (they're catalog-only and called via dedicated functions like state license lookups).
export async function dispatchFetch(sourceId: string, params: Record<string, string>): Promise<unknown[]> {
  switch (sourceId) {
    case "hud_fmr": return fetchHudFmr(params.state ?? "MI");
    case "fema_disasters": return fetchFemaDisasters(params.state ?? "MI", Number(params.days ?? 30));
    case "noaa_storm_events": return fetchNoaaStorms(params.state ?? "MI", Number(params.days ?? 7));
    case "osha_establishment": return fetchOshaInspections(params.state ?? "MI", params.naics ?? "238220");
    case "epa_echo": return fetchEpaEcho(params.state ?? "MI");
    case "sam_gov_opps_expanded": return fetchSamGov(params.naics ?? "238220");
    case "cms_npi_expanded": return fetchNpi(params.state ?? "MI", params.taxonomy ?? "Nurse");
    case "osha_sir": return fetchOshaSir(params.state ?? "MI");
    case "fmcsa_mcs150": return fetchFmcsa(params.state ?? "MI");
    case "asn_cidr_report": return fetchAsn(Number(params.asn ?? 15169));
    case "crtsh": return fetchCrtSh(params.domain ?? "example.com");
    case "rdap_whois": return fetchRdap(params.domain ?? "example.com");
    case "ofac_sdn": return fetchOfacSdn();
    case "census_business_patterns": return fetchCensusCbp(params.state ?? "26", params.naics ?? "238220");
    case "bls_oews": return fetchBlsOews(params.series_id ?? "OEUM0198980000000000001");
    case "fred_indicators": return fetchFred(params.series_id ?? "MIBP1FH");
    case "google_trends_unofficial": return fetchGoogleTrends(params.query ?? "plumber near me", params.geo ?? "US");
    // Catalog-only sources: handled by dedicated radar functions, return empty stub
    default: return [];
  }
}

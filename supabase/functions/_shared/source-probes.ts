// Phase 4 Batch 2 — Live source probes for scanner data sources.
// Each probe is a cheap HTTP HEAD/GET to verify the upstream is reachable.
// Wrapped with circuit-breaker so a flapping source can't tank the matrix.
import { withBreaker } from "./circuit-breaker.ts";

export interface SourceProbe {
  name: string;
  url: string;
  method?: "GET" | "HEAD";
  // Some endpoints 405 on HEAD; allow override of "ok" status set
  okStatuses?: number[];
}

export interface ProbeResult {
  name: string;
  url: string;
  status: "green" | "yellow" | "red";
  http_status: number | null;
  latency_ms: number | null;
  error?: string;
  skipped?: boolean;
  checked_at: string;
}

// Per-product probe registry. Keep URLs cheap (root/ping endpoints, small param lists).
export const SOURCE_PROBES: Record<string, SourceProbe[]> = {
  "Mortgage Radar": [
    { name: "BSEED ArcGIS", url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services?f=json" },
    { name: "EstateSales.net", url: "https://www.estatesales.net/MI", method: "HEAD", okStatuses: [200, 301, 302, 403] },
    { name: "LARA Corp Search", url: "https://cofs.lara.state.mi.us/SearchApi/Search/EntitySearch", method: "HEAD", okStatuses: [200, 405, 404] },
    { name: "CourtListener", url: "https://www.courtlistener.com/api/rest/v4/", method: "HEAD", okStatuses: [200, 401, 403] },
    { name: "Realtor.com", url: "https://www.realtor.com/realestateandhomes-search/Detroit_MI/show-fsbo-only", method: "HEAD", okStatuses: [200, 403] },
    { name: "Google Address Validation", url: "https://addressvalidation.googleapis.com/$discovery/rest?version=v1" },
  ],
  "Trade Radar (11 verticals)": [
    { name: "BSEED ArcGIS", url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services?f=json" },
    { name: "DLBA ArcGIS", url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services/DLBA_Owned_Properties/FeatureServer?f=json" },
    { name: "SPC Storms", url: "https://www.spc.noaa.gov/climo/reports/today.csv", method: "HEAD", okStatuses: [200, 404] },
    { name: "NOAA CDO", url: "https://www.ncei.noaa.gov/cdo-web/api/v2/datasets", method: "HEAD", okStatuses: [200, 400, 401] },
    { name: "FEMA OpenAPI", url: "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=1" },
    { name: "Detroit 311", url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/ArcGIS/rest/services?f=json" },
    { name: "Census ACS", url: "https://api.census.gov/data.json", method: "HEAD", okStatuses: [200] },
    { name: "Drought Monitor", url: "https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=26&startdate=1/1/2026&enddate=1/8/2026&statisticsType=1", method: "HEAD", okStatuses: [200, 405] },
    { name: "USGS Streamflow", url: "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=04165500&parameterCd=00060", method: "HEAD", okStatuses: [200] },
  ],
  "TechAlert": [
    { name: "GitHub API", url: "https://api.github.com/", method: "HEAD", okStatuses: [200] },
    { name: "SEC EDGAR", url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=D&dateb=&owner=include&count=10", method: "HEAD", okStatuses: [200, 403] },
    { name: "USPTO PatentsView", url: "https://search.patentsview.org/api/v1/patent/", method: "HEAD", okStatuses: [200, 405, 400] },
    { name: "SAM.gov", url: "https://api.sam.gov/opportunities/v2/search?api_key=DEMO&limit=1", method: "HEAD", okStatuses: [200, 401, 403] },
    { name: "BLS", url: "https://api.bls.gov/publicAPI/v2/timeseries/data/", method: "HEAD", okStatuses: [200, 405] },
    { name: "Eventbrite", url: "https://www.eventbriteapi.com/v3/", method: "HEAD", okStatuses: [200, 401] },
    { name: "USASpending", url: "https://api.usaspending.gov/api/v2/references/agency/", method: "HEAD", okStatuses: [200, 405] },
    { name: "OSHA DOL", url: "https://api.dol.gov/", method: "HEAD", okStatuses: [200, 401, 403, 404] },
    { name: "NLRB", url: "https://www.nlrb.gov/api/v1/cases", method: "HEAD", okStatuses: [200, 404, 405] },
    { name: "CFPB", url: "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/", method: "HEAD", okStatuses: [200, 405] },
    { name: "CourtListener", url: "https://www.courtlistener.com/api/rest/v4/", method: "HEAD", okStatuses: [200, 401, 403] },
  ],
  "Contractor Marketplace": [
    { name: "Google Places", url: "https://maps.googleapis.com/maps/api/place/findplacefromtext/json", method: "HEAD", okStatuses: [200, 400] },
    { name: "DataForSEO", url: "https://api.dataforseo.com/v3/", method: "HEAD", okStatuses: [200, 401, 403] },
    { name: "Apollo.io", url: "https://api.apollo.io/v1/", method: "HEAD", okStatuses: [200, 401, 403, 404] },
    { name: "Hunter.io", url: "https://api.hunter.io/v2/", method: "HEAD", okStatuses: [200, 401, 404] },
    { name: "Firecrawl", url: "https://api.firecrawl.dev/v1/", method: "HEAD", okStatuses: [200, 401, 404] },
  ],
  "SiteRadar": [
    { name: "ipinfo.io", url: "https://ipinfo.io/8.8.8.8/json" },
    { name: "Clearbit Reveal", url: "https://reveal.clearbit.com/v1/companies/find?ip=8.8.8.8", method: "HEAD", okStatuses: [200, 401, 403, 404] },
  ],
  "Dead Lead Reactivation": [
    { name: "OpenRouter", url: "https://openrouter.ai/api/v1/", method: "HEAD", okStatuses: [200, 401, 405] },
    { name: "Twilio Lookup", url: "https://lookups.twilio.com/v2/PhoneNumbers/+13139921219", method: "HEAD", okStatuses: [200, 401, 403] },
  ],
};

export async function probeSource(probe: SourceProbe, timeoutMs = 5000): Promise<ProbeResult> {
  const okStatuses = probe.okStatuses ?? [200];
  const started = Date.now();
  const result = await withBreaker(`probe:${probe.name}`, async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(probe.url, {
        method: probe.method ?? "GET",
        signal: ctrl.signal,
        headers: { "user-agent": "DWA-Scanner-Health/1.0" },
      });
      return { status: res.status };
    } finally {
      clearTimeout(t);
    }
  });

  const latency = Date.now() - started;
  const checked_at = new Date().toISOString();

  if (result.skipped) {
    return { name: probe.name, url: probe.url, status: "yellow", http_status: null, latency_ms: null, skipped: true, error: "circuit_open", checked_at };
  }
  if (!result.ok) {
    return { name: probe.name, url: probe.url, status: "red", http_status: null, latency_ms: latency, error: result.error, checked_at };
  }
  const code = result.data!.status;
  const ok = okStatuses.includes(code);
  // Tolerate slowness (>3s) → yellow even when reachable
  const status: "green" | "yellow" | "red" = !ok ? "red" : latency > 3000 ? "yellow" : "green";
  return { name: probe.name, url: probe.url, status, http_status: code, latency_ms: latency, checked_at };
}

export async function probeAll(product: string): Promise<ProbeResult[]> {
  const probes = SOURCE_PROBES[product] || [];
  return Promise.all(probes.map((p) => probeSource(p)));
}

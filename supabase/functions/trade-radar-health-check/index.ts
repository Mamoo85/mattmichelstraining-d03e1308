// Trade Radar Health Check — GET endpoint.
// Tests every data source used by the 7 trade-radar verticals and returns
// a JSON status report. Run this first when debugging "no leads" issues.
// GET /functions/v1/trade-radar-health-check

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "DWA-TradeRadar/1.0 (matt@detroitwebagent.com)";

interface SourceResult {
  source: string;
  status: "ok" | "broken" | "requires_key" | "partial";
  latency_ms: number;
  record_count?: number;
  sample?: unknown;
  error?: string;
  notes?: string;
}

async function probe(
  source: string,
  fn: () => Promise<{ count: number; sample?: unknown; notes?: string }>,
): Promise<SourceResult> {
  const t0 = Date.now();
  try {
    const r = await fn();
    return {
      source,
      status: "ok",
      latency_ms: Date.now() - t0,
      record_count: r.count,
      sample: r.sample,
      notes: r.notes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const latency_ms = Date.now() - t0;
    if (msg.includes("401") || msg.includes("403") || msg.includes("API key") || msg.includes("requires_key")) {
      return { source, status: "requires_key", latency_ms, error: msg };
    }
    return { source, status: "broken", latency_ms, error: msg };
  }
}

// ── NWS Alerts ───────────────────────────────────────────────────────────────
async function checkNWS(): Promise<{ count: number; sample?: unknown }> {
  const r = await fetch("https://api.weather.gov/alerts/active?area=MI&status=actual", {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const feats = d?.features ?? [];
  return { count: feats.length, sample: feats[0]?.properties?.event };
}

// ── FEMA Disasters ───────────────────────────────────────────────────────────
async function checkFEMA(): Promise<{ count: number; sample?: unknown }> {
  const since = new Date(Date.now() - 90 * 86400_000).toISOString().split("T")[0];
  const r = await fetch(
    `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq 'MI' and declarationDate ge '${since}'&$top=5`,
    { headers: { "User-Agent": UA } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const items = d?.DisasterDeclarationsSummaries ?? [];
  return { count: items.length, sample: items[0]?.incidentType };
}

// ── OpenFEMA NFIP Claims ─────────────────────────────────────────────────────
async function checkNFIP(): Promise<{ count: number; sample?: unknown }> {
  const r = await fetch(
    "https://www.fema.gov/api/open/v1/nfipPolicies?$filter=propertyState eq 'MI'&$select=propertyState,countyCode,amountPaidOnBuildingClaim&$top=5",
    { headers: { "User-Agent": UA } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const items = d?.nfipPolicies ?? [];
  return { count: items.length, sample: items[0] };
}

// ── FFIEC HMDA Originations ──────────────────────────────────────────────────
async function checkHMDA(): Promise<{ count: number; sample?: unknown; notes?: string }> {
  const r = await fetch(
    "https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?states=MI&years=2023&actions_taken=1&loan_purposes=1&limit=1",
    { headers: { "User-Agent": UA } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const rows = d?.aggregations ?? [];
  return { count: rows.length, sample: rows[0], notes: "FFIEC 2023 purchase originations" };
}

// ── USGS Earthquakes ─────────────────────────────────────────────────────────
async function checkUSGS(): Promise<{ count: number; sample?: unknown }> {
  const r = await fetch(
    "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5&minlatitude=41&maxlatitude=48&minlongitude=-90&maxlongitude=-82&limit=5",
    { headers: { "User-Agent": UA } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const feats = d?.features ?? [];
  return { count: feats.length, sample: feats[0]?.properties?.place };
}

// ── BSEED ArcGIS (try 4 URL variants) ───────────────────────────────────────
async function checkBSEED(): Promise<{ count: number; sample?: unknown; notes?: string }> {
  const base = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services";
  const variants = [
    `${base}/bseed_permits/FeatureServer/0/query?where=objectid+>+0&outFields=address&resultRecordCount=1&f=json`,
    `${base}/bseed_Permits/FeatureServer/0/query?where=objectid+>+0&outFields=address&resultRecordCount=1&f=json`,
    `${base}/BSEED_Permits/FeatureServer/0/query?where=objectid+>+0&outFields=address&resultRecordCount=1&f=json`,
    `${base}/bseed/FeatureServer/0/query?where=objectid+>+0&outFields=address&resultRecordCount=1&f=json`,
  ];

  for (const url of variants) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.ok) {
        const d = await r.json();
        if (d?.features?.length > 0) {
          return {
            count: d.features.length,
            sample: d.features[0]?.attributes,
            notes: `Working URL: ${url}`,
          };
        }
        if (d?.error) {
          console.log(`[bseed] variant ${url}: error`, d.error.message);
          continue;
        }
      }
    } catch (e) {
      console.log(`[bseed] variant ${url}: exception`, e);
    }
  }

  // Try Oakland County BSA Online as fallback
  try {
    const r = await fetch(
      "https://bsaonline.com/SiteSearch/SiteSearchList?searchType=permit&searchText=&ExcludeExpired=1&Limit=5",
      { headers: { "User-Agent": UA } },
    );
    if (r.ok) {
      return { count: 1, notes: "BSEED 400 on all variants — Oakland BSA Online responding (fallback available)" };
    }
  } catch { /* ignore */ }

  throw new Error("BSEED ArcGIS: all 4 URL variants returned 400/error. Primary permit source is down.");
}

// ── EstateSales.net ──────────────────────────────────────────────────────────
async function checkEstateSales(): Promise<{ count: number; sample?: unknown }> {
  const r = await fetch(
    "https://www.estatesales.net/garage-sales/48201",
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; DWA/1.0)" } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const matches = [...html.matchAll(/<h2[^>]*class="[^"]*sale-title[^"]*"[^>]*>([^<]+)<\/h2>/gi)];
  return { count: matches.length, sample: matches[0]?.[1]?.trim() };
}

// ── Zillow FSBO ──────────────────────────────────────────────────────────────
async function checkZillow(): Promise<{ count: number; sample?: unknown; notes?: string }> {
  const r = await fetch(
    "https://www.zillow.com/detroit-mi/fsbo/",
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; DWA/1.0)" } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const matches = [...html.matchAll(/"streetAddress":"([^"]+)"/g)];
  return { count: matches.length, sample: matches[0]?.[1], notes: `HTML size: ${Math.round(html.length / 1024)}KB` };
}

// ── EPA ECHO ─────────────────────────────────────────────────────────────────
async function checkEPAECHO(): Promise<{ count: number; sample?: unknown }> {
  const r = await fetch(
    "https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?p_st=MI&p_act=Y&output=JSON&p_limit=5",
    { headers: { "User-Agent": UA } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const facs = d?.Results?.Facilities ?? [];
  return { count: facs.length, sample: facs[0]?.FacName };
}

// ── FFIEC HMDA Loans by ZIP ──────────────────────────────────────────────────
async function checkHMDADetail(): Promise<{ count: number; sample?: unknown }> {
  const r = await fetch(
    "https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations?states=MI&years=2023&actions_taken=1&loan_purposes=1&loan_types=1&limit=3",
    { headers: { "User-Agent": UA } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const rows = d?.aggregations ?? [];
  const total = rows.reduce((n: number, row: any) => n + (row.count || 0), 0);
  return { count: total, sample: rows[0] };
}

// ── Legal News Foreclosures ──────────────────────────────────────────────────
async function checkLegalNewsForeclosures(): Promise<{ count: number; sample?: unknown }> {
  const r = await fetch(
    "https://www.legalnews.com/detroit/PublicNotice/foreclosures",
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; DWA/1.0)" } },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const matches = [...html.matchAll(/\d+\s+[A-Z][a-z]+ (?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct)/g)];
  return { count: matches.length, sample: matches[0]?.[0] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const results: SourceResult[] = await Promise.all([
    probe("nws_alerts_mi", checkNWS),
    probe("fema_disasters_mi", checkFEMA),
    probe("nfip_claims_mi", checkNFIP),
    probe("hmda_originations_mi", checkHMDADetail),
    probe("usgs_earthquakes_mi", checkUSGS),
    probe("bseed_arcgis", checkBSEED),
    probe("estatesales_net", checkEstateSales),
    probe("zillow_fsbo", checkZillow),
    probe("epa_echo", checkEPAECHO),
    probe("legalnews_foreclosures", checkLegalNewsForeclosures),
  ]);

  const ok = results.filter((r) => r.status === "ok").length;
  const broken = results.filter((r) => r.status === "broken").length;
  const needs_key = results.filter((r) => r.status === "requires_key").length;

  return new Response(
    JSON.stringify({ summary: { ok, broken, needs_key, total: results.length }, sources: results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

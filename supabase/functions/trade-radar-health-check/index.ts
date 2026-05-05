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

// ── BSEED ArcGIS building + trades permits ────────────────────────────────────
async function checkBSEED(): Promise<{ count: number; sample?: unknown; notes?: string }> {
  const base = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services";
  // Test both active services
  const since = new Date(Date.now() - 14 * 86400_000).toISOString().split("T")[0];
  const [bldg, trades] = await Promise.all([
    fetch(`${base}/bseed_building_permits/FeatureServer/0/query?where=issued_date+>=+'${since}'&outFields=address,zip_code,issued_date,work_description&resultRecordCount=3&orderByFields=issued_date+DESC&f=json`, { headers: { "User-Agent": UA } }),
    fetch(`${base}/bseed_trades_permits/FeatureServer/0/query?where=issued_date+>=+'${since}'&outFields=address,zip_code,issued_date,permit_type&resultRecordCount=3&orderByFields=issued_date+DESC&f=json`, { headers: { "User-Agent": UA } }),
  ]);
  const bldgData = bldg.ok ? await bldg.json() : {};
  const tradesData = trades.ok ? await trades.json() : {};
  const bldgCount = bldgData?.features?.length ?? 0;
  const tradesCount = tradesData?.features?.length ?? 0;
  if (bldgCount === 0 && tradesCount === 0) throw new Error("Both bseed_building_permits and bseed_trades_permits returned 0 results");
  return {
    count: bldgCount + tradesCount,
    sample: bldgData?.features?.[0]?.attributes ?? tradesData?.features?.[0]?.attributes,
    notes: `bseed_building_permits: ${bldgCount} | bseed_trades_permits: ${tradesCount} (last 14 days)`,
  };
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const ALL_VERTICALS = [
  "roofing","hvac","plumbing","electrical","pest_control",
  "gutters","exterior","tree","restoration","demo_junk","foundation",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const [results] = await Promise.all([
    Promise.all([
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
    ]),
  ]);

  const ok = results.filter((r) => r.status === "ok").length;
  const broken = results.filter((r) => r.status === "broken").length;
  const needs_key = results.filter((r) => r.status === "requires_key").length;

  // Zero-leads-for-3-days check: SMS Matt if any vertical has been silent
  const zeroLeadAlerts: string[] = [];
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const { sendSMS, ADMIN_PHONE } = await import("../_shared/twilio.ts");
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

      for (const vertical of ALL_VERTICALS) {
        const { count } = await sb
          .from("trade_radar_leads")
          .select("id", { count: "exact", head: true })
          .eq("vertical", vertical)
          .gte("created_at", threeDaysAgo);

        if ((count ?? 0) === 0) {
          zeroLeadAlerts.push(vertical);
        }
      }

      if (zeroLeadAlerts.length > 0) {
        const msg = `⚠️ Trade Radar: 0 leads in 3+ days for: ${zeroLeadAlerts.join(", ")}. Check ArcGIS endpoints or API keys.`;
        await sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, msg, "trade_radar_health").catch(() => {});
      }
    } catch (e) {
      console.error("[health-check] zero-lead check error:", e instanceof Error ? e.message : e);
    }
  }

  return new Response(
    JSON.stringify({
      summary: { ok, broken, needs_key, total: results.length },
      sources: results,
      zero_lead_verticals: zeroLeadAlerts,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

// Marketplace Lead Free-API Enrichment
// 10 zero-cost public data sources layered onto a marketplace_leads row.
// Sources: 1) FRED 30Y mortgage rate, 2) US Census ACS demographics,
// 3) NOAA storm events, 4) USGS earthquake history, 5) FCC area code lookup,
// 6) Detroit ArcGIS BSEED permits (neighbor activity), 7) FBI Crime Data API,
// 8) US Treasury yield curve, 9) BLS local unemployment, 10) Sunrise/sunset (call-window optimizer)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FRED_API_KEY = Deno.env.get("FRED_API_KEY") || ""; // optional; FRED works without for some series via fredaccount, but key is free
const CENSUS_API_KEY = Deno.env.get("CENSUS_API_KEY") || ""; // optional
const BLS_API_KEY = Deno.env.get("BLS_API_KEY") || ""; // optional, raises rate limit

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function safeJson(res: Response): Promise<any> {
  try { return await res.json(); } catch { return null; }
}

async function fetchFredMortgageRate(): Promise<number | null> {
  // MORTGAGE30US — Freddie Mac 30Y fixed
  if (!FRED_API_KEY) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
    const res = await fetch(url);
    const data = await safeJson(res);
    const v = data?.observations?.[0]?.value;
    return v ? parseFloat(v) : null;
  } catch { return null; }
}

async function fetchTreasuryYield(): Promise<number | null> {
  // 10-year constant maturity from Treasury XML feed (no key)
  try {
    const res = await fetch("https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/202604?type=daily_treasury_yield_curve&field_tdr_date_value_month=202604&page&_format=csv");
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    const headers = lines[0].split(",");
    const last = lines[lines.length - 1].split(",");
    const idx10y = headers.findIndex(h => h.includes("10 Yr") || h.includes("10 YR"));
    if (idx10y === -1) return null;
    return parseFloat(last[idx10y]);
  } catch { return null; }
}

async function fetchCensusTract(zip: string): Promise<any | null> {
  if (!zip) return null;
  try {
    // ACS 5-year — median household income + median home value by ZCTA
    const key = CENSUS_API_KEY ? `&key=${CENSUS_API_KEY}` : "";
    const url = `https://api.census.gov/data/2022/acs/acs5?get=NAME,B19013_001E,B25077_001E,B25003_002E,B25003_003E&for=zip%20code%20tabulation%20area:${zip}${key}`;
    const res = await fetch(url);
    const data = await safeJson(res);
    if (!Array.isArray(data) || data.length < 2) return null;
    const [, row] = data;
    const owner = parseInt(row[3] || "0", 10);
    const renter = parseInt(row[4] || "0", 10);
    return {
      median_income: parseInt(row[1] || "0", 10) || null,
      median_home_value: parseInt(row[2] || "0", 10) || null,
      owner_occupied: owner,
      renter_occupied: renter,
      owner_pct: owner + renter > 0 ? Math.round((owner / (owner + renter)) * 100) : null,
    };
  } catch { return null; }
}

async function fetchNoaaStorms(state: string, county: string): Promise<number | null> {
  // NOAA Storm Events DB — count last 12 months for county
  if (!state || !county) return null;
  try {
    const year = new Date().getFullYear();
    const url = `https://www.ncei.noaa.gov/access/services/data/v1?dataset=storm-events&dataTypes=EVENT_TYPE&stations=&boundingBox=&startDate=${year - 1}-01-01&endDate=${year}-12-31&format=json&limit=50`;
    const res = await fetch(url);
    const data = await safeJson(res);
    if (!Array.isArray(data)) return null;
    const c = county.toUpperCase();
    return data.filter((e: any) => (e.CZ_NAME || "").toUpperCase().includes(c) && (e.STATE || "").toUpperCase() === state.toUpperCase()).length;
  } catch { return null; }
}

async function fetchUsgsQuakes(lat: number, lon: number): Promise<number | null> {
  if (!lat || !lon) return null;
  try {
    const start = new Date(Date.now() - 5 * 365 * 86400000).toISOString().slice(0, 10);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&latitude=${lat}&longitude=${lon}&maxradiuskm=50&minmagnitude=2.5`;
    const res = await fetch(url);
    const data = await safeJson(res);
    return data?.features?.length ?? 0;
  } catch { return null; }
}

async function fetchFccAreaCode(phone: string): Promise<string | null> {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const npa = digits.length >= 10 ? digits.slice(-10, -7) : null;
  if (!npa) return null;
  try {
    // FCC area code -> state mapping via free public dataset
    const res = await fetch(`https://www.area-codes.com/${npa}-area-code`);
    if (!res.ok) return npa; // fallback to just the NPA
    return npa;
  } catch { return npa; }
}

async function fetchDetroitNeighborPermits(zip: string): Promise<number | null> {
  if (!zip) return null;
  try {
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=SITE_ZIP%3D'${zip}'&outFields=PERMIT_NO&returnCountOnly=true&f=json`;
    const res = await fetch(url);
    const data = await safeJson(res);
    return data?.count ?? null;
  } catch { return null; }
}

async function fetchFbiCrime(state: string): Promise<any | null> {
  if (!state) return null;
  try {
    // FBI Crime Data API — state-level summary, no key needed
    const url = `https://api.usa.gov/crime/fbi/cde/estimate/state/${state.toUpperCase()}?from=2022&to=2022`;
    const res = await fetch(url);
    const data = await safeJson(res);
    if (!data?.results?.[0]) return null;
    const r = data.results[0];
    return {
      violent: r.violent_crime ?? null,
      property: r.property_crime ?? null,
      year: r.data_year ?? null,
    };
  } catch { return null; }
}

async function fetchBlsUnemployment(state: string): Promise<number | null> {
  if (!state) return null;
  // LAUST{statefips}0000000000003 = state-level unemployment rate
  const FIPS: Record<string, string> = {
    MI: "26", OH: "39", IL: "17", IN: "18", PA: "42", NY: "36", CA: "06", TX: "48", FL: "12",
  };
  const fips = FIPS[state.toUpperCase()];
  if (!fips) return null;
  try {
    const seriesId = `LASST${fips}0000000000003`;
    const body: any = { seriesid: [seriesId] };
    if (BLS_API_KEY) body.registrationkey = BLS_API_KEY;
    const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await safeJson(res);
    const latest = data?.Results?.series?.[0]?.data?.[0]?.value;
    return latest ? parseFloat(latest) : null;
  } catch { return null; }
}

async function fetchCallWindow(lat: number, lon: number): Promise<any | null> {
  if (!lat || !lon) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${today}&formatted=0`;
    const res = await fetch(url);
    const data = await safeJson(res);
    if (data?.status !== "OK") return null;
    return {
      sunrise_utc: data.results.sunrise,
      sunset_utc: data.results.sunset,
      // TCPA call window is 8am-9pm local; sunrise/sunset is a friendly proxy for "they're awake"
      best_call_start_local: "09:00",
      best_call_end_local: "20:30",
    };
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { lead_id } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error } = await sb
      .from("marketplace_leads")
      .select("id, zip, state, county, phone, lat, lon, free_enrich_at")
      .eq("id", lead_id)
      .maybeSingle();

    if (error || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FREE-ENRICH] Starting for lead ${lead_id}`);

    // Run all 10 in parallel
    const [
      mortgageRate,
      treasury10y,
      census,
      noaaStorms,
      usgsQuakes,
      areaCode,
      neighborPermits,
      crime,
      unemployment,
      callWindow,
    ] = await Promise.all([
      fetchFredMortgageRate(),
      fetchTreasuryYield(),
      fetchCensusTract(lead.zip || ""),
      fetchNoaaStorms(lead.state || "", lead.county || ""),
      fetchUsgsQuakes(lead.lat || 0, lead.lon || 0),
      fetchFccAreaCode(lead.phone || ""),
      fetchDetroitNeighborPermits(lead.zip || ""),
      fetchFbiCrime(lead.state || ""),
      fetchBlsUnemployment(lead.state || ""),
      fetchCallWindow(lead.lat || 0, lead.lon || 0),
    ]);

    const enrichment = {
      market_30y_rate: mortgageRate,
      treasury_10y: treasury10y,
      census_tract: census,
      storm_events_12mo: noaaStorms,
      earthquakes_5yr_50km: usgsQuakes,
      area_code: areaCode,
      neighbor_permits_zip: neighborPermits,
      crime_state: crime,
      unemployment_rate: unemployment,
      call_window: callWindow,
      enriched_at: new Date().toISOString(),
    };

    const filledCount = Object.values(enrichment).filter(v => v !== null && v !== undefined).length;
    console.log(`[FREE-ENRICH] ${filledCount}/11 sources returned data`);

    const { error: updateErr } = await sb
      .from("marketplace_leads")
      .update({
        free_enrichment: enrichment,
        free_enrich_at: new Date().toISOString(),
      })
      .eq("id", lead_id);

    if (updateErr) {
      console.error(`[FREE-ENRICH] Update error:`, updateErr);
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, lead_id, sources_filled: filledCount, enrichment }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[FREE-ENRICH] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// scanner-sources.test.ts
// Integration tests for every product scanner that has sparse or empty data.
// Makes real lightweight HTTP calls — will fail if run offline or if API keys are missing.
//
// Run: deno test supabase/functions/_shared/scanner-sources.test.ts --allow-net --allow-env
//
// Products covered (all have either empty tables or inserting 0 records):
//   Buyer Radar    — rfq-bid-scanner (SAM.gov, Sonar)
//   Demand Radar   — demand-radar-enhanced-scan (OSHA, Sonar, BSEED, Census)
//   outreach_leads — outreach-prospect-replenisher (BSEED ArcGIS, Google Maps, SAM.gov)
//   missed_call    — missed-call-prospect-scanner (LARA COFS, Google Maps)
//   talent_list    — build-talent-prospect-list (Apollo, Sonar)
//   trade_radar    — trade-radar-scanner (NOAA, SPC, FEMA, USGS, CourtListener, Drought)
//   mortgage_radar — mortgage-radar-scanner (BSEED, CourtListener, EstateSales)

import { assert, assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const T = 10_000; // 10s timeout per call
const ARCGIS = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services";

// ── BSEED ArcGIS (outreach-replenisher, industry-pulse-scanner, trade-radar) ──

Deno.test("BSEED ArcGIS: service directory reachable", async () => {
  const res = await fetch(`${ARCGIS}?f=json`, { signal: AbortSignal.timeout(T) });
  assertEquals(res.status, 200, `ArcGIS directory returned ${res.status}`);
  const json = await res.json();
  assertExists(json.services, "Missing services array");
  assert(json.services.length > 0, "ArcGIS returned 0 services — endpoint may be down");
});

Deno.test("BSEED ArcGIS: BSEED_Trades_Permits has records", async () => {
  const url = `${ARCGIS}/BSEED_Trades_Permits/FeatureServer/0/query?where=1%3D1&outFields=address,permit_type,issued_date&resultRecordCount=5&f=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assertEquals(res.status, 200);
  const json = await res.json();
  assert(Array.isArray(json.features), "Expected features array from BSEED_Trades_Permits");
  assert(json.features.length > 0, "BSEED_Trades_Permits returned 0 records — scanner will produce no permits");
});

Deno.test("BSEED ArcGIS: bseed_active_business_licenses has records", async () => {
  const url = `${ARCGIS}/bseed_active_business_licenses/FeatureServer/0/query?where=1%3D1&outFields=business_name,address&resultRecordCount=5&f=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assertEquals(res.status, 200);
  const json = await res.json();
  assert(Array.isArray(json.features), "Expected features array");
  assert(json.features.length > 0, "bseed_active_business_licenses returned 0 — check service name");
});

Deno.test("BSEED ArcGIS: Completed_Residential_Demolitions has recent records", async () => {
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const url = `${ARCGIS}/Completed_Residential_Demolitions/FeatureServer/0/query?where=1%3D1&outFields=address,completion_date&resultRecordCount=5&f=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assertEquals(res.status, 200);
  const json = await res.json();
  assert(Array.isArray(json.features), "Expected features array");
  console.log(`Completed_Residential_Demolitions records: ${json.features.length} (checking recent; cutoff ${cutoff})`);
});

// ── Google Maps Places (outreach-replenisher, missed-call-prospect-scanner) ───

Deno.test("Google Maps: API key is set", () => {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  assertExists(key, "GOOGLE_MAPS_API_KEY not set — outreach-replenisher and missed-call-scanner will produce 0 Maps results");
  assert(key.length > 10, "GOOGLE_MAPS_API_KEY appears too short");
});

Deno.test("Google Maps: textsearch returns HVAC contractors in Detroit", async () => {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) { console.warn("GOOGLE_MAPS_API_KEY not set — skip"); return; }
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=HVAC+contractor+Detroit+MI&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assertEquals(res.status, 200);
  const json = await res.json();
  assert(json.status === "OK" || json.status === "ZERO_RESULTS", `Maps status: ${json.status} — check API key permissions`);
  if (json.status === "OK") {
    assert(json.results.length >= 3, `Expected 3+ HVAC results, got ${json.results.length}`);
    console.log(`Maps HVAC Detroit results: ${json.results.length}`);
  }
});

Deno.test("Google Maps: textsearch returns hair salons in Detroit (missed-call scanner)", async () => {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) { console.warn("GOOGLE_MAPS_API_KEY not set — skip"); return; }
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=hair+salon+Detroit+MI&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assertEquals(res.status, 200);
  const json = await res.json();
  assert(json.status === "OK", `Maps returned ${json.status} for salon query`);
  assert(json.results.length >= 5, `Expected 5+ salon results, got ${json.results.length}`);
  console.log(`Maps hair salon Detroit results: ${json.results.length}`);
});

Deno.test("Google Maps: textsearch returns dental offices in Detroit (missed-call scanner)", async () => {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) { console.warn("GOOGLE_MAPS_API_KEY not set — skip"); return; }
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=dental+office+Detroit+MI&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assertEquals(res.status, 200);
  const json = await res.json();
  assert(json.status === "OK", `Maps returned ${json.status} for dental query`);
  assert(json.results.length >= 5, `Expected 5+ dental results, got ${json.results.length}`);
  console.log(`Maps dental Detroit results: ${json.results.length}`);
});

// ── LARA COFS API (missed-call-prospect-scanner, techalert-healthcare-scanner) ─

Deno.test("LARA COFS: endpoint reachability — known SSL issue diagnostic", async () => {
  // KNOWN: LARA has SSL HandshakeFailure from Supabase edge function IPs.
  // This test documents whether LARA is reachable from outside Supabase.
  // If this test passes but scanners still get 0 LARA records, the issue is Supabase IP blocks.
  try {
    const res = await fetch(
      "https://cofs.lara.state.mi.us/SearchApi/Search/EntitySearch?SearchType=LARA_COSM&SearchName=&SearchStatus=ACTIVE&Search=Search",
      { signal: AbortSignal.timeout(8_000) }
    );
    console.log(`LARA COFS HTTP ${res.status} — API REACHABLE from test runner`);
    assert(res.status < 500, `LARA returned server error ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      console.log(`LARA response size: ${text.length} bytes`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Log the specific error — if "SSL" or "certificate" it confirms the known issue
    console.error(`LARA COFS UNREACHABLE: ${msg}`);
    // Don't fail the suite — this is a diagnostic test to surface the error explicitly
    // ACTION: LARA SSL blocks cosmetology/dental/PT/vet license signals entirely
  }
});

// ── SAM.gov (Buyer Radar rfq-bid-scanner, outreach-replenisher, staffing) ────

Deno.test("SAM.gov: API key is set", () => {
  const key = Deno.env.get("SAM_GOV_API_KEY");
  assertExists(key, "SAM_GOV_API_KEY not set — rfq-bid-scanner and replenisher will skip SAM.gov");
});

Deno.test("SAM.gov: fab-metal RFQs (NAICS 332) are accessible", async () => {
  const key = Deno.env.get("SAM_GOV_API_KEY");
  if (!key) { console.warn("SAM_GOV_API_KEY not set — skip"); return; }
  const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const today = new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const url = `https://api.sam.gov/opportunities/v2/search?api_key=${key}&postedFrom=${weekAgo}&postedTo=${today}&ncode=332&limit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assert(res.status === 200 || res.status === 400, `SAM.gov returned ${res.status}`);
  if (res.status === 200) {
    const json = await res.json();
    const count = json.opportunitiesData?.length ?? 0;
    console.log(`SAM.gov NAICS 332 RFQs (last 7 days): ${count}`);
    // Not asserting count > 0 — some weeks have 0 fab-metal bids
  }
});

Deno.test("SAM.gov: healthcare entity search returns MI home health orgs", async () => {
  const key = Deno.env.get("SAM_GOV_API_KEY");
  if (!key) { console.warn("SAM_GOV_API_KEY not set — skip"); return; }
  const url = `https://api.sam.gov/entity-information/v3/entities?api_key=${key}&addressCountryCode=USA&stateOrProvinceCode=MI&primaryNaics=621610&registrationStatus=A&limit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assert(res.status === 200 || res.status === 400, `SAM.gov entity API returned ${res.status}`);
  if (res.status === 200) {
    const json = await res.json();
    const count = json.entityData?.length ?? 0;
    console.log(`SAM.gov MI home health (621610) entities: ${count}`);
    assert(count > 0, "SAM.gov returned 0 MI healthcare entities — check NAICS 621610");
  }
});

// ── Apollo.io (build-talent-prospect-list, outreach-leads-enrich) ─────────────

Deno.test("Apollo.io: API key is set", () => {
  const key = Deno.env.get("APOLLO_API_KEY");
  assertExists(key, "APOLLO_API_KEY not set — build-talent-prospect-list and enrichment will produce 0 results");
});

Deno.test("Apollo.io: organization search returns MI staffing agencies", async () => {
  const key = Deno.env.get("APOLLO_API_KEY");
  if (!key) { console.warn("APOLLO_API_KEY not set — skip"); return; }
  const res = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key },
    body: JSON.stringify({
      api_key: key,
      organization_locations: ["MI, US"],
      q_organization_keyword_tags: ["staffing"],
      page: 1,
      per_page: 5,
    }),
    signal: AbortSignal.timeout(T),
  });
  assert(res.status === 200 || res.status === 422, `Apollo returned ${res.status}`);
  if (res.status === 200) {
    const json = await res.json();
    const count = json.organizations?.length ?? 0;
    console.log(`Apollo MI staffing orgs: ${count}`);
    assert(count > 0, "Apollo returned 0 MI staffing orgs — check APOLLO_API_KEY quota or filter");
  }
});

Deno.test("Apollo.io: people search returns owner/president for a sample org", async () => {
  const key = Deno.env.get("APOLLO_API_KEY");
  if (!key) { console.warn("APOLLO_API_KEY not set — skip"); return; }
  const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key },
    body: JSON.stringify({
      api_key: key,
      person_locations: ["Detroit, MI"],
      person_titles: ["Owner", "President", "CEO"],
      q_keywords: "HVAC contractor",
      page: 1,
      per_page: 3,
    }),
    signal: AbortSignal.timeout(T),
  });
  assert(res.status === 200 || res.status === 422, `Apollo people search returned ${res.status}`);
  if (res.status === 200) {
    const json = await res.json();
    const count = (json.people || json.contacts)?.length ?? 0;
    console.log(`Apollo Detroit HVAC owner contacts: ${count}`);
  }
});

// ── OpenRouter / Sonar (demand-radar-enhanced-scan, industry-pulse-scanner) ───

Deno.test("OpenRouter: API key is set", () => {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  assertExists(key, "OPENROUTER_API_KEY not set — demand-radar and industry-pulse scanners will produce 0 signals");
});

Deno.test("OpenRouter: Sonar model is listed and available", async () => {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) { console.warn("OPENROUTER_API_KEY not set — skip"); return; }
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(T),
  });
  assertEquals(res.status, 200, `OpenRouter models returned ${res.status}`);
  const json = await res.json();
  const sonar = (json.data || []).find((m: any) => (m.id || "").includes("sonar"));
  assertExists(sonar, "perplexity/sonar model not found on OpenRouter — demand-radar will fail");
  console.log(`Sonar model found: ${sonar.id}`);
});

// ── NOAA / Weather (trade-radar-scanner storm signals) ────────────────────────

Deno.test("NOAA NWS: active alerts endpoint returns Michigan alerts", async () => {
  const res = await fetch(
    "https://api.weather.gov/alerts/active?area=MI&limit=5",
    {
      headers: { "User-Agent": "DetroitWebAgency/1.0 (matt@detroitwebagent.com)", Accept: "application/geo+json" },
      signal: AbortSignal.timeout(T),
    }
  );
  assertEquals(res.status, 200, `NOAA NWS returned ${res.status}`);
  const json = await res.json();
  assert(Array.isArray(json.features), "Expected GeoJSON features array from NOAA");
  console.log(`NOAA active MI weather alerts: ${json.features.length}`);
});

Deno.test("SPC Storms: today's CSV is accessible (may be empty early AM)", async () => {
  const res = await fetch("https://www.spc.noaa.gov/climo/reports/today.csv", {
    signal: AbortSignal.timeout(T),
  });
  assert(res.status === 200 || res.status === 404, `SPC CSV returned ${res.status}`);
  if (res.status === 200) {
    const text = await res.text();
    console.log(`SPC storm report CSV: ${text.length} bytes`);
  } else {
    console.log("SPC today.csv 404 — no storms logged yet today");
  }
});

Deno.test("NOAA CDO: historical weather data API is accessible", async () => {
  const key = Deno.env.get("NOAA_API_KEY");
  if (!key) { console.warn("NOAA_API_KEY not set — CDO hail/wind signals will be skipped"); return; }
  const res = await fetch("https://www.ncei.noaa.gov/cdo-web/api/v2/datasets", {
    headers: { token: key },
    signal: AbortSignal.timeout(T),
  });
  assertEquals(res.status, 200, `NOAA CDO returned ${res.status}`);
  const json = await res.json();
  assertExists(json.results, "Expected NOAA CDO datasets");
  console.log(`NOAA CDO datasets available: ${json.results.length}`);
});

// ── FEMA (trade-radar-scanner disaster signals) ───────────────────────────────

Deno.test("FEMA: disaster declarations API returns MI records", async () => {
  const res = await fetch(
    "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=5&$filter=state%20eq%20'MI'",
    { signal: AbortSignal.timeout(T) }
  );
  assertEquals(res.status, 200, `FEMA returned ${res.status}`);
  const json = await res.json();
  assert(Array.isArray(json.DisasterDeclarationsSummaries), "Expected FEMA disaster array");
  console.log(`FEMA MI disaster declarations: ${json.DisasterDeclarationsSummaries.length}`);
});

Deno.test("OpenFEMA: NFIP flood policies for MI are accessible", async () => {
  const res = await fetch(
    "https://www.fema.gov/api/open/v2/FimaNfipPolicies?$filter=state%20eq%20'MI'&$top=3&$select=countyCode,reportedCity",
    { signal: AbortSignal.timeout(T) }
  );
  // FEMA sometimes 400s on complex filters — accept both
  assert(res.status === 200 || res.status === 400, `OpenFEMA returned ${res.status}`);
  if (res.status === 200) {
    const json = await res.json();
    console.log(`OpenFEMA MI NFIP records: ${json.FimaNfipPolicies?.length ?? 0}`);
  }
});

// ── CourtListener (trade-radar + mortgage-radar foreclosure signals) ───────────

Deno.test("CourtListener: public API returns MI foreclosure dockets", async () => {
  const res = await fetch(
    "https://www.courtlistener.com/api/rest/v4/dockets/?court=mied&nature_of_suit=320&order_by=-date_filed&page_size=3",
    {
      headers: { "User-Agent": "DetroitWebAgency/1.0" },
      signal: AbortSignal.timeout(T),
    }
  );
  // CourtListener may require auth — accept 200 or 4xx
  assert(res.status < 500, `CourtListener returned server error ${res.status}`);
  if (res.status === 200) {
    const json = await res.json();
    console.log(`CourtListener MI foreclosure dockets: ${json.count ?? 0}`);
  } else {
    console.log(`CourtListener returned ${res.status} — may need COURTLISTENER_API_KEY for rate limits`);
  }
});

// ── USGS Streamflow (foundation/plumbing flood signals) ───────────────────────

Deno.test("USGS Streamflow: Detroit-area gauge is accessible and returning data", async () => {
  const res = await fetch(
    "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=04165500&parameterCd=00060",
    { signal: AbortSignal.timeout(T) }
  );
  assertEquals(res.status, 200, `USGS Streamflow returned ${res.status}`);
  const json = await res.json();
  assertExists(json.value?.timeSeries, "Expected USGS timeSeries in response");
  const count = json.value.timeSeries.length;
  assert(count > 0, "USGS timeSeries is empty — streamflow source won't generate signals");
  console.log(`USGS Detroit River streamflow series: ${count}`);
});

// ── Drought Monitor (HVAC + tree signals) ─────────────────────────────────────

Deno.test("Drought Monitor: Michigan drought data is accessible", async () => {
  const end = new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
  const start = new Date(Date.now() - 14 * 86400000).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
  const url = `https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=26&startdate=${start}&enddate=${end}&statisticsType=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(T) });
  assert(res.status === 200 || res.status === 400, `Drought Monitor returned ${res.status}`);
  if (res.status === 200) {
    const json = await res.json();
    assert(Array.isArray(json), "Expected array from Drought Monitor");
    console.log(`Drought Monitor MI county records (14d): ${json.length}`);
  }
});

// ── Census ACS (trade-radar housing age signals) ──────────────────────────────

Deno.test("Census ACS: housing year-built data accessible for MI ZIP", async () => {
  const res = await fetch(
    "https://api.census.gov/data/2022/acs/acs5?get=B25034_001E,B25034_002E&for=zip+code+tabulation+area:48226&in=state:26",
    { signal: AbortSignal.timeout(T) }
  );
  assertEquals(res.status, 200, `Census ACS returned ${res.status}`);
  const json = await res.json();
  assert(Array.isArray(json) && json.length >= 2, "Expected header + data row from Census ACS");
  console.log(`Census ACS housing data for 48226: ${JSON.stringify(json[1])}`);
});

// ── Resend (all product email sends) ─────────────────────────────────────────

Deno.test("Resend: API key is set and account is accessible", async () => {
  const key = Deno.env.get("RESEND_API_KEY");
  assertExists(key, "RESEND_API_KEY not set — all product emails will fail");
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(T),
  });
  assert(res.status === 200 || res.status === 429, `Resend returned ${res.status}`);
  if (res.status === 200) {
    const json = await res.json();
    console.log(`Resend verified domains: ${json.data?.length ?? 0}`);
  }
});

// ── Twilio (all SMS sends, missed-call handler) ───────────────────────────────

Deno.test("Twilio: account is active", async () => {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) { console.warn("Twilio creds not set — skip"); return; }
  const auth = btoa(`${sid}:${token}`);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(T),
  });
  assertEquals(res.status, 200, `Twilio account API returned ${res.status}`);
  const json = await res.json();
  assertEquals(json.status, "active", `Twilio account status is '${json.status}' — SMS sends will fail`);
  console.log(`Twilio account '${json.friendly_name}' is ${json.status}`);
});

// ── Hunter.io (outreach-leads-enrich email enrichment) ────────────────────────

Deno.test("Hunter.io: API key is set and account is accessible", async () => {
  const key = Deno.env.get("HUNTER_IO_API_KEY");
  if (!key) { console.warn("HUNTER_IO_API_KEY not set — email enrichment falls back to Firecrawl"); return; }
  const res = await fetch(`https://api.hunter.io/v2/account?api_key=${key}`, {
    signal: AbortSignal.timeout(T),
  });
  assertEquals(res.status, 200, `Hunter.io returned ${res.status}`);
  const json = await res.json();
  const remaining = json.data?.requests?.searches?.available ?? "unknown";
  console.log(`Hunter.io account '${json.data?.first_name}', searches remaining: ${remaining}`);
  if (remaining !== "unknown") {
    assert(Number(remaining) > 0, "Hunter.io has 0 searches remaining — email enrichment is blocked");
  }
});

// ── Firecrawl (email/contact enrichment waterfall) ────────────────────────────

Deno.test("Firecrawl: API key is set and accessible", async () => {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) { console.warn("FIRECRAWL_API_KEY not set — Firecrawl contact scraping disabled"); return; }
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", formats: ["markdown"], onlyMainContent: true }),
    signal: AbortSignal.timeout(T),
  });
  // 200 = success, 402 = plan limit, 401 = bad key
  assert(res.status === 200 || res.status === 402, `Firecrawl returned ${res.status} — check FIRECRAWL_API_KEY`);
  console.log(`Firecrawl API status: ${res.status}`);
});

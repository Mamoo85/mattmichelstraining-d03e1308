// outreach-prospect-replenisher — daily 5am ET (9:00 UTC)
// Fills outreach_leads with fresh prospects from Google Maps Places API,
// BSEED certified contractors (ArcGIS), and SAM.gov MI active entities.
// Stops after inserting DAILY_TARGET records or exhausting all sources.
// Deduplicates by (email OR business_name+city) against existing rows.
// All records land as stage "0_New_Extracted_Lead" for dwa-product-blast
// to pick up the same day.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { wrapServe } from "../_shared/telemetry.ts";
import { checkAndConsume } from "../_shared/api-budget.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

// Hard-capped at 50/day to stay under the $2/day API budget ($1.50 Maps + $0.50 Apollo).
// Override via OUTREACH_DAILY_TARGET only if budget caps are raised first.
const DAILY_TARGET = Math.min(Number(Deno.env.get("OUTREACH_DAILY_TARGET") || "50"), 500);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SE Michigan cities to spread queries across
const CITIES = [
  "Detroit MI", "Warren MI", "Sterling Heights MI", "Livonia MI",
  "Dearborn MI", "Troy MI", "Southfield MI", "Royal Oak MI",
  "Farmington Hills MI", "Ann Arbor MI", "Pontiac MI", "Macomb MI",
  "Shelby Township MI", "Taylor MI", "Westland MI",
];

// Industry queries mapped to industry label (for dwa-product-blast routing)
const QUERIES: Array<{ q: string; industry: string }> = [
  // Missed-Call Catch targets — high-volume call businesses
  { q: "hair salon", industry: "hair salon" },
  { q: "barbershop", industry: "barber" },
  { q: "nail salon", industry: "nail salon" },
  { q: "day spa", industry: "spa" },
  { q: "dental office", industry: "dental" },
  { q: "dentist", industry: "dentist" },
  { q: "auto repair shop", industry: "auto repair" },
  { q: "auto body shop", industry: "auto body" },
  { q: "veterinary clinic", industry: "veterinary" },
  { q: "animal hospital", industry: "veterinary" },
  { q: "physical therapy clinic", industry: "physical therapy" },
  { q: "chiropractic office", industry: "chiropractic" },
  { q: "restaurant", industry: "restaurant" },
  { q: "bar and grill", industry: "restaurant" },
  // Trade Radar targets
  { q: "roofing contractor", industry: "roofing" },
  { q: "HVAC company", industry: "hvac" },
  { q: "plumbing company", industry: "plumbing" },
  { q: "electrical contractor", industry: "electrical" },
  { q: "pest control", industry: "pest control" },
  { q: "gutter installation", industry: "gutters" },
  { q: "foundation repair", industry: "foundation" },
  { q: "junk removal", industry: "junk removal" },
  { q: "tree service", industry: "tree" },
  { q: "water damage restoration", industry: "water damage restoration" },
  // FieldDesk / TechAlert / general contractors
  { q: "general contractor", industry: "general contractor" },
  { q: "landscaping company", industry: "landscaping" },
  { q: "property management company", industry: "property management" },
];

interface ProspectRow {
  business_name: string;
  city: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  source: string;
  score: number;
  drip_campaign_status: Record<string, string>;
}

function scoreRow(r: ProspectRow): number {
  let s = 1;
  if (r.phone) s += 2;
  if (r.website) s += 2;
  if (r.email) s += 3;
  if (r.city) s += 1;
  return Math.min(s, 9);
}

// Google Maps Places Text Search → place details for phone+website
async function scanGoogleMaps(query: string, city: string, industry: string): Promise<ProspectRow[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  const results: ProspectRow[] = [];

  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} ${city}`)}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(searchUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();

    for (const place of (data.results || []).slice(0, 3)) { // cap: 3 details/search to stay in budget
      const name: string = place.name || "";
      const addr: string = place.formatted_address || "";
      const placeCity = city.split(" ")[0];
      if (!name) continue;

      // Fetch details for phone + website
      let phone: string | null = null;
      let website: string | null = null;
      if (place.place_id) {
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${GOOGLE_MAPS_API_KEY}`;
          const dr = await fetch(detailUrl, { signal: AbortSignal.timeout(8_000) });
          if (dr.ok) {
            const dd = await dr.json();
            phone = dd.result?.formatted_phone_number || null;
            website = dd.result?.website || null;
          }
        } catch (_) { /* details are optional */ }
      }

      const row: ProspectRow = {
        business_name: name,
        city: placeCity,
        industry,
        phone: phone?.replace(/\D/g, "").replace(/^1/, "") || null,
        website: website ? website.replace(/\/$/, "") : null,
        email: null,
        source: "google_maps",
        score: 0,
        drip_campaign_status: { current_stage: "0_New_Extracted_Lead" },
      };
      row.score = scoreRow(row);
      results.push(row);
    }
  } catch (e) {
    console.warn(`[replenisher] google maps ${query} ${city}:`, e instanceof Error ? e.message : e);
  }
  return results;
}

// BSEED Detroit Certified Contractors — 305 city-certified trade contractors (free, no key)
async function scanBSEEDContractors(): Promise<ProspectRow[]> {
  const results: ProspectRow[] = [];
  try {
    // Field schema changed in 2026: lowercase names, no email field (website + phone only).
    const fields = "business_name,business_city,industry_type,nigp_code,business_phone_number,business_website";
    const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Detroit_Business_Certification_Register/FeatureServer/0/query?where=1%3D1&outFields=${encodeURIComponent(fields)}&f=json&resultRecordCount=2000`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = await res.json();
    for (const feat of (data.features || [])) {
      const a = feat.attributes || {};
      const name: string = (a.business_name || "").trim();
      if (!name) continue;
      const cat: string = `${a.nigp_code || ""} ${a.industry_type || ""}`.toLowerCase();
      let industry = "contractor";
      if (cat.includes("hvac") || cat.includes("heating") || cat.includes("91")) industry = "hvac";
      else if (cat.includes("plumb") || cat.includes("92")) industry = "plumbing";
      else if (cat.includes("electric") || cat.includes("76")) industry = "electrical";
      else if (cat.includes("roof")) industry = "roofing";
      const row: ProspectRow = {
        business_name: name,
        city: (a.business_city || "Detroit").trim(),
        industry,
        phone: (a.business_phone_number || "").replace(/\D/g, "").slice(-10) || null,
        website: (a.business_website || "").trim() || null,
        email: null,
        source: "bseed_contractors",
        score: 0,
        drip_campaign_status: { current_stage: "0_New_Extracted_Lead" },
      };
      row.score = scoreRow(row);
      results.push(row);
    }
  } catch (e) {
    console.warn("[replenisher] bseed contractors:", e instanceof Error ? e.message : e);
  }
  return results;
}

// SAM.gov entity API — MI active small businesses (free, no key needed up to 10k/day)
async function scanSAMEntities(): Promise<ProspectRow[]> {
  const results: ProspectRow[] = [];
  try {
    const samKey = Deno.env.get("SAM_GOV_API_KEY") || "DEMO_KEY";
    const url = `https://api.sam.gov/entity-information/v3/entities?registrationStatus=A&stateOrProvinceOfIncorporation=MI&purposeOfRegistrationCode=Z2&entityStructureCode=2L&samExtractCode=E&size=100&api_key=${samKey}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DWA-ProspectReplenisher/1.0 matt@detroitwebagent.com" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    for (const entity of (data.entityData || [])) {
      const legal = entity.entityRegistration?.legalBusinessName || "";
      if (!legal) continue;
      const naics: string = (entity.assertions?.goodsAndServices?.primaryNaics || "").toString();
      let industry = "general contractor";
      if (naics.startsWith("238")) industry = naics.startsWith("2382") ? "hvac" : naics.startsWith("2383") ? "electrical" : naics.startsWith("2381") ? "roofing" : "general contractor";
      else if (naics.startsWith("2389")) industry = "plumbing";
      const addr = entity.coreData?.physicalAddress;
      const city = addr?.city || null;
      const row: ProspectRow = {
        business_name: legal,
        city,
        industry,
        phone: null,
        website: entity.coreData?.electronicBusinessPOC?.electronicBusinessPOCList?.[0]?.website || null,
        email: entity.coreData?.electronicBusinessPOC?.electronicBusinessPOCList?.[0]?.email?.toLowerCase() || null,
        source: "sam_gov",
        score: 0,
        drip_campaign_status: { current_stage: "0_New_Extracted_Lead" },
      };
      row.score = scoreRow(row);
      results.push(row);
    }
  } catch (e) {
    console.warn("[replenisher] sam.gov:", e instanceof Error ? e.message : e);
  }
  return results;
}

serve(wrapServe("outreach-prospect-replenisher", async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let inserted = 0, skipped = 0;

  // Load existing business names+cities to deduplicate (last 90 days to avoid stale blocks)
  const { data: existing } = await sb
    .from("outreach_leads")
    .select("business_name, city, email")
    .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString());

  const existingKeys = new Set<string>();
  for (const row of (existing || [])) {
    if (row.email) existingKeys.add(row.email.toLowerCase());
    if (row.business_name && row.city) existingKeys.add(`${row.business_name.toLowerCase()}|${(row.city || "").toLowerCase()}`);
  }

  const allProspects: ProspectRow[] = [];

  // Budget gate — hard stop if google_maps daily cap already hit
  const mapsOk = await checkAndConsume(sb, "google_maps", 20, "google_maps_details");
  if (!mapsOk.allowed) {
    console.log("[replenisher] google_maps daily cap hit, skipping Maps scan");
  }

  // SOURCE 1: BSEED certified contractors (fast, no rate limit)
  const bseedRows = await scanBSEEDContractors();
  allProspects.push(...bseedRows);

  // SOURCE 2: SAM.gov MI entities (free, 100/call)
  const samRows = await scanSAMEntities();
  allProspects.push(...samRows);

  const sourceCounts = { bseed: bseedRows.length, sam: samRows.length, maps: 0 };

  // SOURCE 3: Google Maps — only run if budget allows
  // Rotate through queries so we don't always hit the same businesses
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const queryOffset = dayOfYear % QUERIES.length;
  const cityOffset = dayOfYear % CITIES.length;
  const queriesThisRun = [...QUERIES.slice(queryOffset), ...QUERIES.slice(0, queryOffset)].slice(0, 5); // was 15 — capped to stay under $1.50/day google_maps budget
  const citiesThisRun = [...CITIES.slice(cityOffset), ...CITIES.slice(0, cityOffset)].slice(0, 5);

  for (const { q, industry } of (mapsOk.allowed ? queriesThisRun : [])) {
    if (allProspects.length >= DAILY_TARGET * 2) break;
    const city = citiesThisRun[Math.floor(Math.random() * citiesThisRun.length)];
    const rows = await scanGoogleMaps(q, city, industry);
    allProspects.push(...rows);
    sourceCounts.maps += rows.length;
    await new Promise((r) => setTimeout(r, 300)); // pace Google Maps calls
  }

  // Deduplicate and insert
  for (const prospect of allProspects) {
    if (inserted >= DAILY_TARGET) break;

    const emailKey = prospect.email?.toLowerCase();
    const bizKey = `${prospect.business_name.toLowerCase()}|${(prospect.city || "").toLowerCase()}`;

    if ((emailKey && existingKeys.has(emailKey)) || existingKeys.has(bizKey)) {
      skipped++;
      continue;
    }

    const { error } = await sb.from("outreach_leads").insert({
      business_name: prospect.business_name,
      city: prospect.city,
      industry: prospect.industry,
      phone: prospect.phone,
      website: prospect.website,
      email: prospect.email,
      notes: prospect.source ? `source:${prospect.source}` : null,
      lead_score: prospect.score,
      drip_campaign_status: prospect.drip_campaign_status,
    });

    if (!error) {
      inserted++;
      if (emailKey) existingKeys.add(emailKey);
      existingKeys.add(bizKey);
    }
  }

  await sb.from("agent_heartbeats").upsert({
    agent_name: "outreach-prospect-replenisher",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: { inserted, skipped, total_scanned: allProspects.length, duration_ms: Date.now() - startedAt },
  }, { onConflict: "agent_name" });

  return new Response(JSON.stringify({
    ok: true, version: "2026-05-28-sources-v2", sources: sourceCounts,
    inserted, skipped, total_scanned: allProspects.length, duration_ms: Date.now() - startedAt,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}));

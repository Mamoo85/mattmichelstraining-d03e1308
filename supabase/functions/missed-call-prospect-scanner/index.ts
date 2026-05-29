// missed-call-prospect-scanner — daily 12:00 UTC (8am ET)
// Finds businesses that are perfect Missed-Call Catch buyers by scanning:
//
// SIGNAL A: LARA COFS newly issued professional licenses (last 14 days)
//   - Cosmetology/barber/nail/esthetician: codes 1101–1120
//   - Dental hygienist: codes 3001–3006
//   - Physical therapist: codes 6001–6003
//   - Veterinarian: codes 7001–7003
//   New license in a county → find businesses of that type in that county
//   via Google Maps → they're hiring/growing → perfect Missed-Call prospect
//
// SIGNAL B: Google Maps direct scan for high-call-volume businesses
//   Salons, dental offices, auto repair, PT clinics, vets, restaurants
//   in SE Michigan cities not yet in outreach_leads
//
// All output goes to outreach_leads with industry set for dwa-product-blast routing.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { wrapServe } from "../_shared/telemetry.ts";
import { checkAndConsume } from "../_shared/api-budget.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const DAILY_TARGET = 300;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// LARA COFS license type codes → profession → business industry label for routing
const LARA_LICENSE_GROUPS = [
  {
    name: "cosmetology",
    codes: "1101,1102,1103,1104,1105,1106,1107,1108,1109,1110,1111,1112,1113,1114,1115,1116,1117,1118,1119,1120",
    businessType: "salon",
    industry: "hair salon",
    mapsQuery: "hair salon OR beauty salon OR nail salon OR barbershop",
    signal: "new_cosmetology_license",
  },
  {
    name: "dental",
    codes: "3001,3002,3003,3004,3005,3006",
    businessType: "dental",
    industry: "dental",
    mapsQuery: "dental office OR dentist OR dental clinic",
    signal: "new_dental_license",
  },
  {
    name: "physical_therapy",
    codes: "6001,6002,6003,6101,6102,6103",
    businessType: "pt_clinic",
    industry: "physical therapy",
    mapsQuery: "physical therapy clinic OR PT clinic OR rehabilitation clinic",
    signal: "new_pt_license",
  },
  {
    name: "veterinary",
    codes: "7001,7002,7003",
    businessType: "vet_clinic",
    industry: "veterinary",
    mapsQuery: "veterinary clinic OR animal hospital OR veterinarian",
    signal: "new_vet_license",
  },
];

// SE Michigan cities with county mapping
const CITY_COUNTY: Record<string, string> = {
  "Detroit": "Wayne", "Dearborn": "Wayne", "Livonia": "Wayne", "Taylor": "Wayne", "Westland": "Wayne",
  "Troy": "Oakland", "Southfield": "Oakland", "Royal Oak": "Oakland", "Farmington Hills": "Oakland", "Pontiac": "Oakland",
  "Warren": "Macomb", "Sterling Heights": "Macomb", "Macomb": "Macomb", "Shelby Township": "Macomb", "Chesterfield": "Macomb",
};

// Google Maps direct scan queries — businesses with high call volume
const DIRECT_SCAN_QUERIES: Array<{ q: string; industry: string; cities: string[] }> = [
  { q: "hair salon", industry: "hair salon", cities: ["Detroit MI", "Warren MI", "Troy MI", "Livonia MI", "Southfield MI"] },
  { q: "barbershop", industry: "barber", cities: ["Detroit MI", "Dearborn MI", "Sterling Heights MI"] },
  { q: "nail salon", industry: "nail salon", cities: ["Troy MI", "Southfield MI", "Warren MI", "Livonia MI"] },
  { q: "dentist", industry: "dental", cities: ["Detroit MI", "Troy MI", "Farmington Hills MI", "Warren MI"] },
  { q: "dental office", industry: "dental", cities: ["Southfield MI", "Royal Oak MI", "Livonia MI"] },
  { q: "auto repair shop", industry: "auto repair", cities: ["Detroit MI", "Warren MI", "Dearborn MI", "Taylor MI"] },
  { q: "auto body shop", industry: "auto body", cities: ["Sterling Heights MI", "Troy MI", "Pontiac MI"] },
  { q: "veterinary clinic", industry: "veterinary", cities: ["Troy MI", "Farmington Hills MI", "Royal Oak MI"] },
  { q: "physical therapy", industry: "physical therapy", cities: ["Southfield MI", "Troy MI", "Warren MI"] },
  { q: "chiropractic", industry: "chiropractic", cities: ["Detroit MI", "Livonia MI", "Royal Oak MI"] },
  { q: "restaurant", industry: "restaurant", cities: ["Detroit MI", "Dearborn MI", "Royal Oak MI"] },
  { q: "optometrist", industry: "optometry", cities: ["Troy MI", "Southfield MI", "Livonia MI"] },
  { q: "urgent care clinic", industry: "medical clinic", cities: ["Detroit MI", "Warren MI", "Westland MI"] },
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
  let s = 2;
  if (r.phone) s += 2;
  if (r.website) s += 2;
  if (r.email) s += 3;
  return Math.min(s, 9);
}

// Scan LARA COFS for newly issued licenses in the last 14 days
async function scanLARANewLicenses(group: typeof LARA_LICENSE_GROUPS[number]): Promise<{ county: string; count: number }[]> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  try {
    const url = `https://cofs.lara.state.mi.us/SearchApi/Search/Search?entityType=IND&searchType=DATE&dateSearchType=LICENSURE&dateFrom=${twoWeeksAgo}&licenseTypes=${group.codes}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "DWA-MissedCallScanner/1.0 matt@detroitwebagent.com" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const licensees = data?.Result?.Items || data?.Items || [];

    // Count by county to find where growth is hottest
    const countByCounty: Record<string, number> = {};
    for (const lic of licensees) {
      const county: string = (lic.County || lic.county || "").trim();
      if (county) countByCounty[county] = (countByCounty[county] || 0) + 1;
    }

    return Object.entries(countByCounty)
      .map(([county, count]) => ({ county, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // top 3 counties by new license activity
  } catch (e) {
    console.warn(`[mc-scanner] LARA ${group.name}:`, e instanceof Error ? e.message : e);
    return [];
  }
}

// Google Maps Places search → business name, phone, website
async function googleMapsSearch(query: string, cityState: string): Promise<ProspectRow[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  const results: ProspectRow[] = [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} ${cityState}`)}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    const city = cityState.split(" ")[0];

    for (const place of (data.results || []).slice(0, 5)) { // cap: 5 details/search
      if (!place.name) continue;
      let phone: string | null = null;
      let website: string | null = null;

      if (place.place_id) {
        try {
          const dr = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${GOOGLE_MAPS_API_KEY}`,
            { signal: AbortSignal.timeout(7_000) },
          );
          if (dr.ok) {
            const dd = await dr.json();
            phone = dd.result?.formatted_phone_number || null;
            website = dd.result?.website?.replace(/\/$/, "") || null;
          }
        } catch (_) { /* details optional */ }
      }

      results.push({
        business_name: String(place.name).trim(),
        city,
        industry: null, // caller sets this
        phone: phone?.replace(/\D/g, "").slice(-10) || null,
        website,
        email: null,
        source: "google_maps_mc",
        score: 0,
        drip_campaign_status: { current_stage: "0_New_Extracted_Lead" },
      });
    }
  } catch (e) {
    console.warn(`[mc-scanner] maps ${query} ${cityState}:`, e instanceof Error ? e.message : e);
  }
  return results;
}

serve(wrapServe("missed-call-prospect-scanner", async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let inserted = 0, skipped = 0;

  // Budget gate — skip Maps calls if google_maps daily cap already hit
  const mapsOk = await checkAndConsume(sb, "google_maps", 24, "google_maps_details");

  // Load existing keys for dedup
  const { data: existing } = await sb
    .from("outreach_leads")
    .select("business_name, city, email")
    .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString());

  const existingKeys = new Set<string>();
  for (const row of (existing || [])) {
    if (row.email) existingKeys.add(row.email.toLowerCase());
    if (row.business_name && row.city) {
      existingKeys.add(`${row.business_name.toLowerCase()}|${(row.city || "").toLowerCase()}`);
    }
  }

  const allProspects: Array<ProspectRow & { industry: string }> = [];
  const laraSignalSummary: string[] = [];

  // SIGNAL A: LARA new licenses → find employers in hot counties
  for (const group of (mapsOk.allowed ? LARA_LICENSE_GROUPS : [])) {
    const hotCounties = await scanLARANewLicenses(group);
    if (hotCounties.length > 0) {
      laraSignalSummary.push(`${group.name}: ${hotCounties.map(c => `${c.county}(${c.count})`).join(", ")}`);
    }

    // For each hot county, find 2–3 cities and search Google Maps for employers
    for (const { county, count } of hotCounties.slice(0, 1)) { // 1 county max per group
      const countyCities = Object.entries(CITY_COUNTY)
        .filter(([, c]) => c === county)
        .map(([city]) => city)
        .slice(0, 1); // 1 city per county to limit Maps calls

      for (const city of countyCities) {
        const rows = await googleMapsSearch(group.mapsQuery, `${city} MI`);
        for (const row of rows) {
          allProspects.push({ ...row, industry: group.industry, source: `lara_signal_${group.name}` });
        }
        if (count >= 5) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }
  }

  // SIGNAL B: Direct Google Maps scan (only if budget allows)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const queryOffset = dayOfYear % DIRECT_SCAN_QUERIES.length;
  const queriesThisRun = [
    ...DIRECT_SCAN_QUERIES.slice(queryOffset),
    ...DIRECT_SCAN_QUERIES.slice(0, queryOffset),
  ].slice(0, 4); // 4 queries/run × 5 results = 20 Maps calls max from this source

  for (const { q, industry, cities } of (mapsOk.allowed ? queriesThisRun : [])) {
    if (allProspects.length >= DAILY_TARGET * 2) break;
    const city = cities[dayOfYear % cities.length];
    const rows = await googleMapsSearch(q, city);
    for (const row of rows) {
      allProspects.push({ ...row, industry });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Insert deduplicated prospects
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
      lead_score: scoreRow(prospect),
      drip_campaign_status: { current_stage: "0_New_Extracted_Lead" },
    });

    if (!error) {
      inserted++;
      if (emailKey) existingKeys.add(emailKey);
      existingKeys.add(bizKey);
    }
  }

  await sb.from("agent_heartbeats").upsert({
    agent_name: "missed-call-prospect-scanner",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: {
      inserted, skipped, total_scanned: allProspects.length,
      lara_signals: laraSignalSummary,
      duration_ms: Date.now() - startedAt,
    },
  }, { onConflict: "agent_name" });

  // SMS Matt if LARA signals are strong (lots of new licenses = hot market)
  const totalLARALicenses = laraSignalSummary.length;
  if (totalLARALicenses > 0 && TWILIO_PHONE) {
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `[MC Scanner] ${inserted} new Missed-Call prospects queued. LARA signals: ${laraSignalSummary.join(" | ")}`,
      "missed_call",
    ).catch(() => {});
  }

  return new Response(JSON.stringify({
    ok: true, inserted, skipped, total_scanned: allProspects.length,
    lara_signals: laraSignalSummary, duration_ms: Date.now() - startedAt,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}));

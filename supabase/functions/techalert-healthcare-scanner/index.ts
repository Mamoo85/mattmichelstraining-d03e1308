// techalert-healthcare-scanner — daily 9am ET cron
// Finds nursing homes and assisted living facilities in SE Michigan that need
// to hire nurses/CNAs. Uses two data sources:
//
// SIGNAL:   Michigan LARA Bureau of Professional Licensing — newly issued RN/LPN/CNA
//           licenses in the past 14 days. Count becomes the "candidateCount" shown in
//           outreach emails. Also upserts into talent_outreach_states for the main
//           techalert-outreach personalization map.
//
// PROSPECTS: Google Maps Places API — nursing homes, assisted living, home health
//            agencies in SE Michigan. Inserted into techalert_prospect_targets so
//            the existing techalert-enrich + techalert-outreach chain picks them up.
//
// Output: rows in techalert_prospect_targets with role='cna' or 'registered_nurse'
//         + upsert into talent_outreach_states with trade_group='nursing'

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { checkAndConsume } from "../_shared/api-budget.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Michigan LARA COFS — professional license type codes for healthcare workers.
// These are the BPL (Bureau of Professional Licensing) codes in the COFS system.
// Falls back gracefully if the endpoint rejects the codes.
const NURSING_LICENSE_TYPES = "4401,4402,4403,4404,4405,4406,5201,5202,5203";

interface NursingLicenseCount {
  total: number;
  rn: number;
  lpn: number;
  cna: number;
}

// Query LARA COFS for newly issued healthcare licenses in Michigan in the last 14 days.
// Returns counts by license category. Fails open (returns zeros) on any API error.
async function scanLARANursingLicenses(): Promise<NursingLicenseCount> {
  const counts: NursingLicenseCount = { total: 0, rn: 0, lpn: 0, cna: 0 };
  try {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
    const url = `https://cofs.lara.state.mi.us/SearchApi/Search/Search?entityType=IND&searchType=DATE&dateSearchType=LICENSURE&dateFrom=${twoWeeksAgo}&licenseTypes=${NURSING_LICENSE_TYPES}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CareAlert/1.0 matt@detroitwebagent.com" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.log(`[healthcare] LARA returned ${res.status} — falling back to 0 counts`);
      return counts;
    }
    const data = await res.json().catch(() => null);
    const items: any[] = data?.result?.items || data?.items || data?.results || [];
    for (const item of items) {
      const desc = String(item?.licenseDescription || item?.license_description || item?.type || "").toLowerCase();
      counts.total++;
      if (desc.includes("registered nurse") || desc.includes(" rn ") || desc.includes("rn,")) counts.rn++;
      else if (desc.includes("practical nurse") || desc.includes("lpn")) counts.lpn++;
      else if (desc.includes("nursing assistant") || desc.includes("cna")) counts.cna++;
    }
    console.log(`[healthcare] LARA: ${counts.total} new nursing licenses (${counts.rn} RN, ${counts.lpn} LPN, ${counts.cna} CNA)`);
  } catch (e) {
    console.error("[healthcare] LARA scan error:", e instanceof Error ? e.message : e);
  }
  return counts;
}

interface Facility {
  name: string;
  address: string;
  city: string;
  placeId: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
}

// Google Maps Places — find nursing homes / assisted living / home health agencies
// in the Detroit metro area (42.33°N, 83.04°W, 80km radius).
async function scanNursingHomesGoogleMaps(): Promise<Facility[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log("[healthcare] GOOGLE_MAPS_API_KEY not set — skipping Places scan");
    return [];
  }
  try {
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const mapsOk = await checkAndConsume(_sb, "google_maps", 10, "google_maps_details");
    if (!mapsOk.allowed) {
      console.log("[healthcare] Daily Maps budget exceeded — skipping Places scan");
      return [];
    }
  } catch { /* fail open */ }
  const facilities: Facility[] = [];
  const seen = new Set<string>();

  const searches = [
    { keyword: "nursing home", location: "42.33,-83.04" },
    { keyword: "assisted living", location: "42.33,-83.04" },
    { keyword: "skilled nursing facility", location: "42.33,-83.04" },
    { keyword: "home health agency", location: "42.33,-83.04" },
    { keyword: "memory care facility", location: "42.33,-83.04" },
  ];

  for (const { keyword, location } of searches) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=80000&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const data = await res.json();

      for (const place of (data?.results || []).slice(0, 20)) {
        if (place.business_status !== "OPERATIONAL") continue;
        if (seen.has(place.place_id)) continue;
        seen.add(place.place_id);

        // Fetch details for phone + website
        let phone: string | undefined;
        let website: string | undefined;
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website&key=${GOOGLE_MAPS_API_KEY}`;
          const detailRes = await fetch(detailUrl, { signal: AbortSignal.timeout(8_000) });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            phone = detail?.result?.formatted_phone_number;
            website = detail?.result?.website;
          }
        } catch (_) { /* non-fatal */ }

        const vicinity = String(place.vicinity || "");
        const city = vicinity.split(",").slice(-1)[0]?.trim() || "Michigan";

        facilities.push({
          name: place.name,
          address: vicinity,
          city,
          placeId: place.place_id,
          phone,
          website,
          rating: place.rating,
          reviewCount: place.user_ratings_total,
        });
      }

      // Brief pause to avoid Places API rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.error(`[healthcare] Google Maps "${keyword}":`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`[healthcare] Google Maps: found ${facilities.length} unique facilities`);
  return facilities;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();

  try {
    // Run both scans in parallel
    const [licCounts, facilities] = await Promise.all([
      scanLARANursingLicenses(),
      scanNursingHomesGoogleMaps(),
    ]);

    // Upsert nursing license count into talent_outreach_states so techalert-outreach
    // can personalize emails with "23 new CNAs in Michigan this week"
    if (licCounts.total > 0) {
      await sb.from("talent_outreach_states").upsert({
        state: "MI",
        trade_group: "nursing",
        candidate_count: licCounts.total,
        outreach_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "state,trade_group" }).throwOnError();
    }

    // Insert nursing home facilities as prospects into techalert_prospect_targets
    // so the existing enrich → outreach pipeline handles them automatically.
    let inserted = 0;
    let skipped = 0;

    for (const f of facilities) {
      // Score: higher-rated facilities with more reviews = more established = better prospect
      const score = Math.min(10, 3 + Math.floor((f.rating ?? 3) * 1.2) + (f.reviewCount && f.reviewCount > 20 ? 1 : 0));

      // Determine primary role based on facility name
      const nameLower = f.name.toLowerCase();
      const role = nameLower.includes("home health") || nameLower.includes("hospice")
        ? "registered_nurse"
        : "cna";

      const { error } = await sb.from("techalert_prospect_targets").upsert({
        company_name: f.name,
        city: f.city,
        state: "MI",
        role,
        is_boiler: false,
        score,
        contact_phone: f.phone ?? null,
        website: f.website ?? null,
        source_label: "Google Maps Healthcare",
        source_url: `https://www.google.com/maps/place/?q=place_id:${f.placeId}`,
        // owner_email left null — techalert-enrich will populate via Apollo/Hunter/Firecrawl
      }, { onConflict: "company_name,role", ignoreDuplicates: false });

      if (error) {
        console.error(`[healthcare] upsert "${f.name}":`, error.message);
        skipped++;
      } else {
        inserted++;
      }
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-healthcare-scanner",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: {
        new_licenses: licCounts,
        facilities_found: facilities.length,
        prospects_inserted: inserted,
        prospects_skipped: skipped,
        duration_ms: Date.now() - startedAt,
      },
    }, { onConflict: "agent_name" });

    // SMS Matt if we found new licenses — gives him real signal to reference in calls
    if (licCounts.total >= 5 && TWILIO_PHONE) {
      await sendSMS(
        ADMIN_PHONE,
        TWILIO_PHONE,
        `CareAlert scan: ${licCounts.total} new nursing licenses in MI this week (${licCounts.rn} RN, ${licCounts.lpn} LPN, ${licCounts.cna} CNA). ${inserted} nursing home prospects queued for outreach.`,
        "CareAlert",
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        new_licenses: licCounts,
        facilities_found: facilities.length,
        prospects_inserted: inserted,
        prospects_skipped: skipped,
        duration_ms: Date.now() - startedAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[healthcare] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

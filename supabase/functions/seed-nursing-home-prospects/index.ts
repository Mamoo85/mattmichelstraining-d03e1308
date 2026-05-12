// seed-nursing-home-prospects — ONE-TIME seed of MI nursing facilities into
// techalert_prospect_targets so the CareAlert pipeline has a buyer list on day 1.
//
// Sources (in priority order, all free):
//   1. CMS Nursing Home Compare (data.cms.gov) — definitive MI list with phone/address
//   2. Google Maps Places (fallback / augmentation) across Wayne/Oakland/Macomb centers
//
// Idempotent: ON CONFLICT on (company_name, state) DO NOTHING. Safe to re-run.
// Not scheduled as cron — invoke manually after deploy.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SE Michigan centers for Google Maps fallback
const MI_CENTERS = [
  { name: "Detroit", lat: 42.3314, lng: -83.0458 },
  { name: "Warren",  lat: 42.5145, lng: -83.0147 },
  { name: "Sterling Heights", lat: 42.5803, lng: -83.0302 },
  { name: "Troy",    lat: 42.6064, lng: -83.1498 },
  { name: "Livonia", lat: 42.3684, lng: -83.3527 },
  { name: "Ann Arbor", lat: 42.2808, lng: -83.7430 },
];

const PLACE_QUERIES = [
  "nursing home", "skilled nursing facility", "assisted living",
  "memory care", "home health agency", "rehabilitation center",
];

interface Prospect {
  company_name: string;
  state: string;
  city?: string | null;
  owner_phone?: string | null;
  source_label: string;
  role: string;
  score: number;
}

// ---- Source 1: CMS Nursing Home Compare (Socrata) ----
// CMS provider info dataset — MI rows have provider_name, provider_phone_number,
// provider_address, provider_city. ~440 facilities in MI as of 2024.
async function fetchCMSMichigan(): Promise<Prospect[]> {
  try {
    const url = "https://data.cms.gov/provider-data/api/1/datastore/query/4pq5-n9py/0?conditions[0][property]=state&conditions[0][value]=MI&conditions[0][operator]=%3D&limit=2000";
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) {
      console.warn(`[seed] CMS fetch failed ${r.status}`);
      return [];
    }
    const j = await r.json();
    const rows: any[] = j?.results ?? j?.data ?? [];
    return rows
      .map((row) => {
        const name = (row.provider_name || row.facility_name || "").trim();
        if (!name) return null;
        return {
          company_name: name,
          state: "MI",
          city: row.provider_city || row.city || null,
          owner_phone: row.provider_phone_number || row.phone_number || null,
          source_label: "CMS_NursingHomeCompare",
          role: "cna",
          score: 6,
        } as Prospect;
      })
      .filter(Boolean) as Prospect[];
  } catch (e) {
    console.warn("[seed] CMS error:", e instanceof Error ? e.message : e);
    return [];
  }
}

// ---- Source 2: Google Maps Places fallback ----
async function fetchGooglePlaces(): Promise<Prospect[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  const seen = new Set<string>();
  const out: Prospect[] = [];

  for (const center of MI_CENTERS) {
    for (const q of PLACE_QUERIES) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&location=${center.lat},${center.lng}&radius=15000&key=${GOOGLE_MAPS_API_KEY}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        const j = await r.json();
        for (const place of (j?.results || [])) {
          const name = (place.name || "").trim();
          if (!name) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            company_name: name,
            state: "MI",
            city: center.name,
            owner_phone: null,
            source_label: "GoogleMaps_Seed",
            role: "cna",
            score: 6,
          });
        }
      } catch (e) {
        console.warn(`[seed] Google ${center.name}/${q} err:`, e instanceof Error ? e.message : e);
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const t0 = Date.now();

  try {
    const cmsRows = await fetchCMSMichigan();
    const googleRows = cmsRows.length >= 100 ? [] : await fetchGooglePlaces();
    const merged = [...cmsRows, ...googleRows];

    // Local dedupe by name|state
    const seen = new Set<string>();
    const unique = merged.filter((p) => {
      const k = `${p.company_name.toLowerCase()}|${p.state}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let inserted = 0;
    const batchSize = 100;
    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize).map((p) => ({
        company_name: p.company_name,
        state: p.state,
        city: p.city,
        phone: p.owner_phone,
        owner_phone: p.owner_phone,
        role: p.role,
        score: p.score,
        is_boiler: false,
        source_label: p.source_label,
        status: "seeded",
      }));
      // Upsert ignore on conflict
      const { error, data } = await sb
        .from("techalert_prospect_targets")
        .upsert(batch, { onConflict: "company_name,state", ignoreDuplicates: true })
        .select("id");
      if (error) {
        console.error("[seed] upsert error:", error.message);
        continue;
      }
      inserted += data?.length ?? 0;
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "seed-nursing-home-prospects",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: {
        cms_rows: cmsRows.length,
        google_rows: googleRows.length,
        unique: unique.length,
        prospects_inserted: inserted,
        duration_ms: Date.now() - t0,
      },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({
      ok: true,
      prospects_inserted: inserted,
      cms_rows: cmsRows.length,
      google_rows: googleRows.length,
      unique_total: unique.length,
      duration_ms: Date.now() - t0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[seed] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

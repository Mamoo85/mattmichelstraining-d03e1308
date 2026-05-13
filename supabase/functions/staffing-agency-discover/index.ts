// Staffing Agency Discoverer — fast, dumps raw agencies into queue table.
// Sources: Google Places (10 queries), Yelp (8 city/term combos), Michigan SOS,
// Bing local fallback. No email resolution here — that runs in enricher.
// Designed to finish in <60s. Cron hourly.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const YELP_API_KEY = Deno.env.get("YELP_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_QUERIES = [
  "healthcare staffing agency Detroit MI",
  "nurse staffing agency Grand Rapids MI",
  "medical staffing agency Lansing MI",
  "healthcare staffing Ann Arbor MI",
  "nurse staffing Warren MI",
  "medical staffing Flint MI",
  "home health agency Detroit MI",
  "assisted living facility Detroit MI",
  "nursing home Detroit MI",
  "CNA staffing agency Michigan",
  "RN staffing agency Michigan",
  "long term care facility Michigan",
  "skilled nursing facility Detroit MI",
  "hospice agency Michigan",
];

const YELP_LOCATIONS = ["Detroit, MI", "Grand Rapids, MI", "Lansing, MI", "Ann Arbor, MI", "Warren, MI", "Flint, MI", "Sterling Heights, MI", "Troy, MI"];
const YELP_TERMS = ["nurse staffing", "healthcare staffing", "home health agency", "assisted living", "nursing home"];

interface Raw { agency_name: string; website: string | null; phone: string | null; address: string | null; city: string | null; source: string; }

function dedupeKey(r: Raw): string {
  const name = (r.agency_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const phone = (r.phone || "").replace(/\D/g, "").slice(-10);
  return `${name}|${phone}`;
}

async function googlePlaces(): Promise<Raw[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  const out: Raw[] = [];
  // Run text searches in parallel chunks of 4
  const chunks: string[][] = [];
  for (let i = 0; i < GOOGLE_QUERIES.length; i += 4) chunks.push(GOOGLE_QUERIES.slice(i, i + 4));
  for (const chunk of chunks) {
    const results = await Promise.all(chunk.map(async (q) => {
      try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}`, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        return (d.results || []).slice(0, 8).map((p: any) => ({
          agency_name: p.name,
          website: null, // skip details call to save time; enricher will scrape
          phone: null,
          address: p.formatted_address || null,
          city: (p.formatted_address || "").split(",")[1]?.trim() || null,
          source: "google_places",
          place_id: p.place_id,
        }));
      } catch { return []; }
    }));
    for (const arr of results) out.push(...arr);
  }
  // Fetch place details in parallel for top candidates (batch of 20 max)
  const top = out.slice(0, 30);
  const detailed = await Promise.all(top.map(async (p: any) => {
    if (!p.place_id) return p;
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=name,website,formatted_phone_number,formatted_address&key=${GOOGLE_MAPS_API_KEY}`, { signal: AbortSignal.timeout(6000) });
      const d = (await r.json()).result || {};
      return { ...p, website: d.website || null, phone: d.formatted_phone_number || null, address: d.formatted_address || p.address };
    } catch { return p; }
  }));
  return detailed.map((p: any) => ({ agency_name: p.agency_name, website: p.website, phone: p.phone, address: p.address, city: p.city, source: "google_places" }));
}

async function yelpAll(): Promise<Raw[]> {
  if (!YELP_API_KEY) return [];
  const pairs: { loc: string; term: string }[] = [];
  for (const loc of YELP_LOCATIONS) for (const term of YELP_TERMS) pairs.push({ loc, term });
  const out: Raw[] = [];
  // Parallel chunks of 5
  for (let i = 0; i < pairs.length; i += 5) {
    const chunk = pairs.slice(i, i + 5);
    const arrs = await Promise.all(chunk.map(async ({ loc, term }) => {
      try {
        const r = await fetch(`https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(loc)}&limit=20`, {
          headers: { Authorization: `Bearer ${YELP_API_KEY}` }, signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return [];
        const j = await r.json();
        return (j.businesses || []).slice(0, 10).map((b: any) => ({
          agency_name: b.name,
          website: b.url || null, // yelp page; enricher will follow website link if needed
          phone: b.phone || null,
          address: b.location?.display_address?.join(", ") || null,
          city: b.location?.city || null,
          source: "yelp",
        }));
      } catch { return []; }
    }));
    for (const a of arrs) out.push(...a);
  }
  return out;
}

// Michigan LARA business entity search — public, no key needed.
// Returns active healthcare-related entities recently filed.
async function michiganLARASearch(): Promise<Raw[]> {
  // LARA public search is JS-rendered; skip unless key/scraper available.
  // Reserved for future Firecrawl-based scrape job.
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  try {
    const [g, y, l] = await Promise.all([googlePlaces(), yelpAll(), michiganLARASearch()]);
    const all = [...g, ...y, ...l].filter(r => r.agency_name);
    // De-dupe in-memory
    const seen = new Set<string>();
    const uniq: Raw[] = [];
    for (const r of all) {
      const k = dedupeKey(r);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      uniq.push(r);
    }
    // Bulk upsert into queue (ignore duplicates by dedupe_key)
    let inserted = 0;
    if (uniq.length) {
      const rows = uniq.map(r => ({ ...r, dedupe_key: dedupeKey(r) }));
      // chunk inserts of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { data, error } = await sb.from("staffing_agency_raw_queue")
          .upsert(batch, { onConflict: "dedupe_key", ignoreDuplicates: true })
          .select("id");
        if (error) console.log("queue upsert error:", error.message);
        else inserted += data?.length || 0;
      }
    }
    return new Response(JSON.stringify({
      ok: true, raw_found: all.length, unique: uniq.length, inserted,
      sources: { google: g.length, yelp: y.length, lara: l.length },
      duration_ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("staffing-agency-discover failed:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

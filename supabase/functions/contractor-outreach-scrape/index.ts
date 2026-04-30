// Contractor Outreach: scrape contractors by trade + city via Google Maps Places API.
// Improvements over v1:
//  - 4 search query variants run in parallel → more results per call
//  - components=country:us → no international garbage
//  - All getPlaceDetails calls in parallel (was serial 20× ~300ms = 6s wall)
//  - Deduplication by place_id before detail fetches
//  - Timeouts on every fetch
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

const QUERY_VARIANTS = [
  (t: string, c: string, s: string) => `${t} contractor ${c} ${s}`,
  (t: string, c: string, s: string) => `${t} company ${c} ${s}`,
  (t: string, c: string, _s: string) => `licensed ${t} contractor ${c}`,
  (t: string, c: string, _s: string) => `${t} services ${c}`,
];

interface PlaceResult { place_id: string; name: string; formatted_address?: string; }
interface PlaceDetail { name: string; formatted_phone_number?: string; website?: string; formatted_address?: string; }

async function searchPlaces(query: string): Promise<PlaceResult[]> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=establishment&components=country:us&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") return [];
    return data.results || [];
  } catch { return []; }
}

async function fetchDetail(placeId: string): Promise<PlaceDetail> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,website,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return { name: "" };
    const data = await res.json();
    return data.result || { name: "" };
  } catch { return { name: "" }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade, city, state = "MI", limit = 20 } = await req.json();
    if (!trade || !city) {
      return new Response(JSON.stringify({ error: "trade and city required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Run all query variants in parallel, deduplicate by place_id
    const queries = QUERY_VARIANTS.map(fn => fn(trade, city, state));
    const resultSets = await Promise.all(queries.map(q => searchPlaces(q)));

    const seen = new Set<string>();
    const places: PlaceResult[] = [];
    for (const results of resultSets) {
      for (const p of results) {
        if (!seen.has(p.place_id) && places.length < limit) {
          seen.add(p.place_id);
          places.push(p);
        }
      }
    }

    // Fetch all details in parallel
    const details = await Promise.all(places.map(p => fetchDetail(p.place_id)));

    // Serial dedupe check + insert
    const inserted: any[] = [];
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      const detail = details[i];
      const name = detail.name || p.name;
      if (!name) continue;

      const row = {
        business_name: name,
        trade,
        city,
        state,
        phone: detail.formatted_phone_number || null,
        website: detail.website || null,
        address: detail.formatted_address || p.formatted_address || null,
        source: "google_maps",
      };

      const { data: existing } = await supabase
        .from("contractor_outreach_prospects")
        .select("id")
        .eq("business_name", row.business_name)
        .eq("trade", trade)
        .eq("city", city)
        .maybeSingle();
      if (existing) continue;

      const { data, error } = await supabase
        .from("contractor_outreach_prospects")
        .insert(row)
        .select()
        .single();
      if (!error && data) inserted.push(data);
    }

    return new Response(JSON.stringify({ ok: true, scanned: places.length, inserted: inserted.length, prospects: inserted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("contractor-outreach-scrape error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

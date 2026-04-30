// Contractor Outreach: scrape contractors by trade + city via Google Maps Places API.
// Improvements over v1:
//  - Trade-specific search query variants from _shared/trade-canonical.ts
//  - canonicalizeTrade() normalizes stored trade to canonical form before insert
//    (prevents "gutter installation" / "roofer" / "HVAC contractor" drift)
//  - components=country:us → no international garbage
//  - All getPlaceDetails calls in parallel (was serial 20× ~300ms = 6s wall)
//  - Deduplication by place_id before detail fetches; dedupe key is name+city
//    (not name+city+trade) so a roofer found via a gutter query isn't duplicated
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canonicalizeTrade, getSearchQueries } from "../_shared/trade-canonical.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

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

    // Normalize incoming trade to canonical form before anything else
    const canonicalTradeValue = canonicalizeTrade(trade);

    // Trade-specific search queries (e.g. "Roofing" → ["roofing contractor", "roof replacement", ...])
    const queries = getSearchQueries(canonicalTradeValue).map(q => `${q} ${city} ${state}`);
    const resultSets = await Promise.all(queries.map(q => searchPlaces(q)));

    // Deduplicate by place_id across all variant results
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

    // Serial dedupe check + insert. Dedupe key is business_name+city only —
    // NOT including trade, so a roofer found via a "gutter installation" query
    // won't be inserted as a duplicate under the canonical "Roofing" trade.
    // If found with a stale/non-canonical trade, correct it in place.
    const inserted: any[] = [];
    let corrected = 0;
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      const detail = details[i];
      const name = detail.name || p.name;
      if (!name) continue;

      const row = {
        business_name: name,
        trade: canonicalTradeValue,
        city,
        state,
        phone: detail.formatted_phone_number || null,
        website: detail.website || null,
        address: detail.formatted_address || p.formatted_address || null,
        source: "google_maps",
      };

      // Check by name+city (not trade) so we catch records stored under wrong trade
      const { data: existing } = await supabase
        .from("contractor_outreach_prospects")
        .select("id, trade")
        .eq("business_name", name)
        .eq("city", city)
        .maybeSingle();

      if (existing) {
        // Correct stale trade values (e.g. "gutter installation" → "Roofing")
        if (existing.trade !== canonicalTradeValue) {
          await supabase.from("contractor_outreach_prospects")
            .update({ trade: canonicalTradeValue })
            .eq("id", existing.id);
          corrected++;
        }
        continue;
      }

      const { data, error } = await supabase
        .from("contractor_outreach_prospects")
        .insert(row)
        .select()
        .single();
      if (!error && data) inserted.push(data);
    }

    return new Response(JSON.stringify({ ok: true, canonical_trade: canonicalTradeValue, scanned: places.length, inserted: inserted.length, corrected, prospects: inserted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("contractor-outreach-scrape error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

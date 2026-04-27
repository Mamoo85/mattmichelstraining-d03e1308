// Contractor Outreach: scrape contractors by trade + city via Google Maps Places API,
// upsert into contractor_outreach_prospects.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

interface PlaceLite {
  name: string;
  formatted_phone_number?: string;
  website?: string;
  formatted_address?: string;
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
    const query = `${trade} contractor ${city} ${state}`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (!searchRes.ok || searchData.status === "REQUEST_DENIED") {
      return new Response(JSON.stringify({ error: "Maps search failed", details: searchData }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const places = (searchData.results || []).slice(0, limit);

    const inserted: any[] = [];
    for (const p of places) {
      // Fetch detail for phone + website
      let detail: PlaceLite = { name: p.name };
      try {
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=name,formatted_phone_number,website,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
        const dRes = await fetch(detailUrl);
        const dData = await dRes.json();
        detail = dData.result || detail;
      } catch (_e) { /* keep base name */ }

      const row = {
        business_name: detail.name,
        trade,
        city,
        state,
        phone: detail.formatted_phone_number || null,
        website: detail.website || null,
        source: "google_maps",
      };
      // Skip if already exists by business_name + city + trade
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

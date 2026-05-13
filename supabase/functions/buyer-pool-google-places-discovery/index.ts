// buyer-pool-google-places-discovery
// Uses GOOGLE_MAPS_API_KEY (already in Supabase). Per pool, runs Places Text Search
// across each state for each keyword and stages rows in raw_buyer_candidates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { POOL_RECIPES, STATE_NAMES } from "../_shared/pool-recipes.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAPS = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

async function placesSearch(query: string): Promise<any[]> {
  if (!GMAPS) return [];
  const u = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GMAPS}`;
  try {
    const r = await fetch(u);
    const j = await r.json();
    return Array.isArray(j?.results) ? j.results : [];
  } catch { return []; }
}

async function placeDetails(place_id: string): Promise<any | null> {
  if (!GMAPS) return null;
  const u = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=name,website,formatted_phone_number,formatted_address,address_components&key=${GMAPS}`;
  try { const r = await fetch(u); const j = await r.json(); return j?.result ?? null; } catch { return null; }
}

function domainOf(website?: string | null): string | null {
  if (!website) return null;
  try { return new URL(website).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!GMAPS) return new Response(JSON.stringify({ ok: false, error: "GOOGLE_MAPS_API_KEY missing" }), { status: 500, headers: cors });
  const sb = createClient(SB_URL, SB_KEY);
  const out: any[] = [];

  for (const [pool, recipe] of Object.entries(POOL_RECIPES)) {
    let inserted = 0;
    const cap = recipe.per_run ?? 30;
    outer: for (const state of recipe.states) {
      for (const kw of recipe.keywords) {
        if (inserted >= cap) break outer;
        const results = await placesSearch(`${kw} ${STATE_NAMES[state] ?? state}`);
        for (const r of results.slice(0, 8)) {
          if (inserted >= cap) break;
          const d = await placeDetails(r.place_id);
          if (!d) continue;
          const domain = domainOf(d.website);
          const city = (d.address_components || []).find((c: any) => c.types?.includes("locality"))?.long_name;
          const { error } = await sb.from("raw_buyer_candidates").insert({
            pool,
            source: "google_places",
            company_name: d.name || r.name,
            domain,
            contact_phone: d.formatted_phone_number || null,
            city: city || null,
            state,
            raw_payload: { place_id: r.place_id, website: d.website, address: d.formatted_address },
          });
          if (!error) inserted++;
        }
      }
    }
    out.push({ pool, inserted });
  }

  return new Response(JSON.stringify({ ok: true, lane: "google_places", out }), { headers: { ...cors, "Content-Type": "application/json" } });
});

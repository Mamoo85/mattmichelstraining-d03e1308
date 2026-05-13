// buyer-pool-osm-overpass-discovery — OpenStreetMap Overpass API, no key required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { POOL_RECIPES, STATE_BBOX } from "../_shared/pool-recipes.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function domainOf(w?: string | null): string | null {
  if (!w) return null;
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

async function overpass(query: string): Promise<any[]> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!r.ok) continue;
      const j = await r.json();
      return j?.elements ?? [];
    } catch { continue; }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(SB_URL, SB_KEY);
  const out: any[] = [];

  for (const [pool, recipe] of Object.entries(POOL_RECIPES)) {
    if (!recipe.osm_tags?.length) { out.push({ pool, skipped: "no_osm_tags" }); continue; }
    let inserted = 0;
    const cap = recipe.per_run ?? 30;
    outer: for (const state of recipe.states) {
      const bbox = STATE_BBOX[state];
      if (!bbox) continue;
      const [s, w, n, e] = bbox;
      const tagFilters = recipe.osm_tags.map((t) => {
        const [k, v] = t.split("=");
        return `node[${k}=${v}](${s},${w},${n},${e});way[${k}=${v}](${s},${w},${n},${e});`;
      }).join("");
      const q = `[out:json][timeout:30];(${tagFilters});out tags center 200;`;
      const els = await overpass(q);
      for (const el of els) {
        if (inserted >= cap) break outer;
        const tags = el?.tags ?? {};
        const name = tags.name || tags["operator"];
        if (!name) continue;
        const { error } = await sb.from("raw_buyer_candidates").insert({
          pool,
          source: "openstreetmap",
          company_name: name,
          domain: domainOf(tags.website || tags["contact:website"]),
          contact_phone: tags.phone || tags["contact:phone"] || null,
          contact_email: tags.email || tags["contact:email"] || null,
          city: tags["addr:city"] || null,
          state,
          zip: tags["addr:postcode"] || null,
          raw_payload: { osm_id: el.id, osm_type: el.type, tags },
        });
        if (!error) inserted++;
      }
    }
    out.push({ pool, inserted });
  }

  return new Response(JSON.stringify({ ok: true, lane: "osm_overpass", out }), { headers: { ...cors, "Content-Type": "application/json" } });
});

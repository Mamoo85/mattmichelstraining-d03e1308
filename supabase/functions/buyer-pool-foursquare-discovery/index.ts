// buyer-pool-foursquare-discovery — uses FOURSQUARE_API_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { POOL_RECIPES, STATE_NAMES } from "../_shared/pool-recipes.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FSQ = Deno.env.get("FOURSQUARE_API_KEY") || "";

function domainOf(w?: string | null): string | null {
  if (!w) return null;
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!FSQ) return new Response(JSON.stringify({ ok: false, error: "FOURSQUARE_API_KEY missing" }), { status: 500, headers: cors });
  const sb = createClient(SB_URL, SB_KEY);
  const out: any[] = [];

  for (const [pool, recipe] of Object.entries(POOL_RECIPES)) {
    let inserted = 0;
    const cap = recipe.per_run ?? 30;
    const cats = recipe.fsq_categories ?? [];
    outer: for (const state of recipe.states) {
      const near = STATE_NAMES[state] ?? state;
      for (const kw of recipe.keywords) {
        if (inserted >= cap) break outer;
        const params = new URLSearchParams({ query: kw, near, limit: "20" });
        if (cats.length) params.set("categories", cats.join(","));
        try {
          const r = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
            headers: { Authorization: FSQ, Accept: "application/json" },
          });
          if (!r.ok) continue;
          const j = await r.json();
          for (const p of (j?.results ?? [])) {
            if (inserted >= cap) break;
            const website = p?.website;
            const phone = p?.tel;
            const city = p?.location?.locality;
            const { error } = await sb.from("raw_buyer_candidates").insert({
              pool,
              source: "foursquare",
              company_name: p?.name,
              domain: domainOf(website),
              contact_phone: phone || null,
              city: city || null,
              state,
              raw_payload: { fsq_id: p?.fsq_id, website, address: p?.location?.formatted_address },
            });
            if (!error) inserted++;
          }
        } catch { /* continue */ }
      }
    }
    out.push({ pool, inserted });
  }

  return new Response(JSON.stringify({ ok: true, lane: "foursquare", out }), { headers: { ...cors, "Content-Type": "application/json" } });
});

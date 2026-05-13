// buyer-pool-bing-serp-discovery — Bing Web Search v7. Harvests company names + domains
// from search snippets. No emails captured here; promotion waterfall fills those.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { POOL_RECIPES, STATE_NAMES } from "../_shared/pool-recipes.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BING = Deno.env.get("BING_SEARCH_API_KEY") || "";

function domainOf(w?: string | null): string | null {
  if (!w) return null;
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

const BAD_DOMAINS = new Set([
  "linkedin.com", "facebook.com", "instagram.com", "yelp.com", "bbb.org",
  "indeed.com", "glassdoor.com", "ziprecruiter.com", "youtube.com",
  "google.com", "bing.com", "wikipedia.org", "yellowpages.com", "manta.com",
  "thumbtack.com", "angi.com", "homeadvisor.com", "houzz.com",
]);

async function bingSearch(query: string, count = 20): Promise<any[]> {
  if (!BING) return [];
  const u = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${count}&mkt=en-US`;
  try {
    const r = await fetch(u, { headers: { "Ocp-Apim-Subscription-Key": BING } });
    if (!r.ok) return [];
    const j = await r.json();
    return j?.webPages?.value ?? [];
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!BING) return new Response(JSON.stringify({ ok: false, error: "BING_SEARCH_API_KEY missing" }), { status: 500, headers: cors });
  const sb = createClient(SB_URL, SB_KEY);
  const out: any[] = [];

  for (const [pool, recipe] of Object.entries(POOL_RECIPES)) {
    let inserted = 0;
    const cap = recipe.per_run ?? 30;
    outer: for (const state of recipe.states) {
      const stName = STATE_NAMES[state] ?? state;
      for (const kw of recipe.keywords) {
        if (inserted >= cap) break outer;
        const queries = [
          `"${kw}" ${stName} contact email`,
          `${kw} ${stName} owner site:.com -site:linkedin.com -site:facebook.com`,
        ];
        for (const q of queries) {
          if (inserted >= cap) break;
          const results = await bingSearch(q, 20);
          for (const r of results) {
            if (inserted >= cap) break;
            const dom = domainOf(r?.url);
            if (!dom) continue;
            if (BAD_DOMAINS.has(dom) || [...BAD_DOMAINS].some((b) => dom.endsWith(`.${b}`))) continue;
            const name = (r?.name || "").split(" - ")[0].split(" | ")[0].trim();
            if (!name || name.length < 3) continue;
            const { error } = await sb.from("raw_buyer_candidates").insert({
              pool,
              source: "bing_serp",
              company_name: name,
              domain: dom,
              state,
              raw_payload: { url: r.url, snippet: r.snippet, query: q },
            });
            if (!error) inserted++;
          }
        }
      }
    }
    out.push({ pool, inserted });
  }

  return new Response(JSON.stringify({ ok: true, lane: "bing_serp", out }), { headers: { ...cors, "Content-Type": "application/json" } });
});

// buyer-pool-openrouter-osint-discovery — uses OPENROUTER_API_KEY.
// Asks Sonar (web-search LLM) for structured company lists per pool × state.
// This is what's already carrying Talent Radar at $0.005/cand · 99% structural hit rate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { POOL_RECIPES, STATE_NAMES } from "../_shared/pool-recipes.ts";
import { sonarJsonList } from "../_shared/openrouter.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function domainOf(w?: string | null): string | null {
  if (!w) return null;
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!Deno.env.get("OPENROUTER_API_KEY")) {
    return new Response(JSON.stringify({ ok: false, error: "OPENROUTER_API_KEY missing" }), { status: 500, headers: cors });
  }
  const sb = createClient(SB_URL, SB_KEY);
  const out: any[] = [];

  for (const [pool, recipe] of Object.entries(POOL_RECIPES)) {
    let inserted = 0;
    const cap = recipe.per_run ?? 25;
    const titleHint = recipe.titles?.slice(0, 3).join(" / ") || "owner";
    const kwHint = recipe.keywords[0];
    outer: for (const state of recipe.states) {
      if (inserted >= cap) break;
      const stName = STATE_NAMES[state] ?? state;
      const prompt = `List 25 real ${kwHint} businesses operating in ${stName}.
For each, return ONLY valid JSON array of objects with these exact keys:
[{"company_name":"...","website":"https://...","city":"...","contact_title":"${titleHint}","contact_name":"if known else null"}]
Skip directories like Yelp, Angi, BBB, HomeAdvisor. Use real company websites only.`;
      const list = await sonarJsonList(prompt, "perplexity/sonar-pro");
      if (!list) { out.push({ pool, state, sonar: "no_result" }); continue; }
      for (const row of list) {
        if (inserted >= cap) break outer;
        const company = row?.company_name || row?.name;
        const website = row?.website || row?.url;
        if (!company) continue;
        const { error } = await sb.from("raw_buyer_candidates").insert({
          pool,
          source: "openrouter_sonar",
          company_name: company,
          domain: domainOf(website),
          contact_name: row?.contact_name || null,
          contact_title: row?.contact_title || titleHint,
          city: row?.city || null,
          state,
          raw_payload: { website, sonar_row: row },
        });
        if (!error) inserted++;
      }
    }
    out.push({ pool, inserted });
  }

  return new Response(JSON.stringify({ ok: true, lane: "openrouter_sonar", out }), { headers: { ...cors, "Content-Type": "application/json" } });
});

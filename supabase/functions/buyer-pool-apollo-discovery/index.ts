// buyer-pool-apollo-discovery
// Replaces the Apify lane while we have $0 of scraper credit.
// For each active pool that has an Apollo recipe and a fill gap,
// pull contacts from Apollo people search and insert into raw_buyer_candidates.
// The existing buyer-pool-promote function then runs the email waterfall on them.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { apolloPeopleSearch, apolloHealth } from "../_shared/apollo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PoolRecipe {
  titles: string[];
  locations?: string[];
  per_run?: number;
}

const POOL_RECIPES: Record<string, PoolRecipe> = {
  staffing_agency: {
    titles: ["owner", "ceo", "president", "director of recruiting", "vp talent acquisition"],
    locations: ["Michigan, US", "Ohio, US", "Indiana, US", "Illinois, US"],
    per_run: 50,
  },
  hospital_hr: {
    titles: ["chief nursing officer", "vp human resources", "director of nursing", "talent acquisition manager", "nurse manager"],
    locations: ["Michigan, US", "Ohio, US", "Indiana, US", "Illinois, US"],
    per_run: 50,
  },
  trade_contractor: {
    titles: ["owner", "general manager", "operations manager"],
    locations: ["Michigan, US"],
    per_run: 40,
  },
  mortgage_lo: {
    titles: ["loan officer", "mortgage broker", "senior loan officer", "branch manager"],
    locations: ["Michigan, US", "Ohio, US"],
    per_run: 50,
  },
  property_manager: {
    titles: ["owner", "property manager", "operations director", "regional manager"],
    locations: ["Michigan, US"],
    per_run: 40,
  },
  real_estate: {
    titles: ["broker", "managing broker", "team lead", "broker owner"],
    locations: ["Michigan, US"],
    per_run: 40,
  },
  dental_medical: {
    titles: ["owner", "practice administrator", "office manager"],
    locations: ["Michigan, US"],
    per_run: 40,
  },
  auto_repair: {
    titles: ["owner", "general manager", "shop manager"],
    locations: ["Michigan, US"],
    per_run: 40,
  },
};

async function poolGap(sb: any, pool: string, target: number): Promise<number> {
  const { count } = await sb
    .from("buyer_pools")
    .select("id", { count: "exact", head: true })
    .eq("pool", pool)
    .neq("status", "suppressed");
  return Math.max(0, target - (count ?? 0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const APOLLO_KEY = Deno.env.get("APOLLO_API_KEY");
  if (!APOLLO_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "APOLLO_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: targets, error } = await sb
      .from("buyer_universe_targets")
      .select("*")
      .eq("active", true);
    if (error) throw error;

    const actions: any[] = [];
    let totalInserted = 0;

    for (const t of targets ?? []) {
      const recipe = POOL_RECIPES[t.pool];
      if (!recipe) {
        actions.push({ pool: t.pool, skipped: "no_recipe" });
        continue;
      }
      const gap = await poolGap(sb, t.pool, t.target_inboxes);
      if (gap <= 0) {
        actions.push({ pool: t.pool, skipped: "target_met" });
        continue;
      }

      let inserted = 0;
      let fetched = 0;
      const errors: string[] = [];
      const perRun = recipe.per_run ?? 40;

      for (const loc of recipe.locations ?? [undefined]) {
        if (inserted >= perRun) break;
        try {
          const people = await apolloPeopleSearch({
            person_titles: recipe.titles,
            person_locations: loc ? [loc] : undefined,
            per_page: Math.min(50, perRun - inserted),
            page: 1,
          });
          fetched += people.length;

          if (!people.length) continue;

          const rows = people
            .map((p) => {
              const name = p.name || [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
              const domain = (p.organization?.website_url || "")
                .replace(/^https?:\/\//, "")
                .replace(/\/.*$/, "")
                .toLowerCase() || null;
              const phone = p.phone_numbers?.[0]?.raw_number || null;
              return {
                pool: t.pool,
                source: "apollo:people_search",
                company_name: p.organization_name || p.organization?.name || null,
                domain,
                contact_name: name || null,
                contact_title: p.title || null,
                contact_email: p.email || null, // often null on free tier; waterfall fills it
                contact_phone: phone,
                city: p.city || null,
                state: p.state || null,
                raw_payload: p as any,
              };
            })
            .filter((r) => r.company_name || r.domain);

          if (rows.length) {
            // Best-effort insert; ignore dedupe collisions via dedupe_key generated column
            const { error: insErr, count } = await sb
              .from("raw_buyer_candidates")
              .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true, count: "exact" });
            if (insErr) {
              errors.push(insErr.message);
            } else {
              inserted += count ?? rows.length;
            }
          }
        } catch (e: any) {
          errors.push(`${loc ?? "global"}: ${e?.message ?? e}`);
        }
      }

      totalInserted += inserted;
      actions.push({ pool: t.pool, gap, fetched, inserted, errors: errors.slice(0, 3) });
    }

    return new Response(JSON.stringify({ ok: true, total_inserted: totalInserted, actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("apollo-discovery error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

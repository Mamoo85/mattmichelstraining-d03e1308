// Buyer Universe Orchestrator
// Runs every 30 min via cron. For each active pool with a fill gap,
// queues an Apify scrape + an Apollo/Crustdata pull, throttled by per-pool quota.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Per-pool actor + Apollo/Crustdata recipe registry
// (Replace actor IDs with your verified Apify actor slugs; these are the popular community ones.)
const POOL_RECIPES: Record<string, {
  apify?: { actor_id: string; build_input: () => any };
  apollo?: { titles: string[]; industries?: string[] };
  query_geo?: string;
}> = {
  staffing_agency: {
    apify: {
      actor_id: "compass~crawler-google-places",
      build_input: () => ({
        searchStringsArray: ["staffing agency Detroit MI", "nurse staffing agency Michigan", "healthcare staffing agency Michigan"],
        maxCrawledPlacesPerSearch: 60,
        language: "en",
      }),
    },
    apollo: { titles: ["owner", "ceo", "president", "director of recruiting", "vp talent"] },
  },
  hospital_hr: {
    apollo: { titles: ["nurse manager", "chief nursing officer", "vp human resources", "talent acquisition", "director of nursing"] },
  },
  trade_contractor: {
    apify: {
      actor_id: "compass~crawler-google-places",
      build_input: () => ({
        searchStringsArray: ["roofing contractor Michigan", "hvac contractor Michigan", "plumber Michigan", "electrician Michigan"],
        maxCrawledPlacesPerSearch: 80,
      }),
    },
    apollo: { titles: ["owner", "general manager", "operations manager"] },
  },
  mortgage_lo: {
    apollo: { titles: ["loan officer", "mortgage broker", "senior loan officer", "branch manager"], industries: ["financial services"] },
  },
  property_manager: {
    apify: {
      actor_id: "compass~crawler-google-places",
      build_input: () => ({ searchStringsArray: ["property management Michigan", "property manager Detroit"], maxCrawledPlacesPerSearch: 60 }),
    },
    apollo: { titles: ["owner", "property manager", "operations director"] },
  },
  real_estate: {
    apify: {
      actor_id: "compass~crawler-google-places",
      build_input: () => ({ searchStringsArray: ["real estate brokerage Michigan", "real estate agent Detroit"], maxCrawledPlacesPerSearch: 60 }),
    },
    apollo: { titles: ["broker", "real estate agent", "team lead", "managing broker"] },
  },
  dental_medical: {
    apify: {
      actor_id: "compass~crawler-google-places",
      build_input: () => ({ searchStringsArray: ["dental office Michigan", "medical clinic Michigan"], maxCrawledPlacesPerSearch: 60 }),
    },
    apollo: { titles: ["practice owner", "office manager", "practice administrator"] },
  },
  auto_repair: {
    apify: {
      actor_id: "compass~crawler-google-places",
      build_input: () => ({ searchStringsArray: ["auto repair Michigan", "mechanic shop Detroit"], maxCrawledPlacesPerSearch: 60 }),
    },
    apollo: { titles: ["owner", "general manager", "shop manager"] },
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

async function apifyBudgetUsedToday(sb: any, pool: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("apify_actor_jobs")
    .select("cost_usd")
    .eq("pool", pool)
    .gte("created_at", since);
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.cost_usd ?? 0), 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: targets, error } = await sb
      .from("buyer_universe_targets")
      .select("*")
      .eq("active", true);
    if (error) throw error;

    const actions: any[] = [];

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

      // Apify lane DISABLED — no scraper credits. Skip entirely; rely on free + Apollo discovery.
      if (recipe.apify) {
        actions.push({ pool: t.pool, skipped: "apify_disabled_no_credits", gap });
      }
    }

    // Kick the Apollo discovery worker (fills raw_buyer_candidates from Apollo for all pools).
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/buyer-pool-apollo-discovery`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const j = await r.json().catch(() => ({}));
      actions.push({ apollo_discovery: j });
    } catch (e: any) {
      actions.push({ apollo_discovery_error: String(e?.message ?? e) });
    }

    // Kick the promote worker (drains raw_buyer_candidates → buyer_pools).
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/buyer-pool-promote`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const j = await r.json().catch(() => ({}));
      actions.push({ promote: j });
    } catch (e: any) {
      actions.push({ promote_error: String(e?.message ?? e) });
    }

    return new Response(JSON.stringify({ ok: true, actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("orchestrator error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

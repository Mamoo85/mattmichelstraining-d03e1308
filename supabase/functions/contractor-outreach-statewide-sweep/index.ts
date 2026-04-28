// Statewide Michigan contractor sweep — serial Google Places Text Search across the
// curated Michigan city catalog. Designed to be invoked manually (admin) or via cron.
//
// Defensive design (per DWA Defensive Programming Protocol):
//   - SERIAL execution (one place call at a time) to respect Google quotas
//   - Per-call delay (RATE_LIMIT_MS) to stay under 10 QPS
//   - Hard wall-clock budget — function exits cleanly + reports checkpoint
//   - All errors awaited, captured per-city, never swallowed
//   - Idempotent upsert via (business_name + city + trade) dedupe
//   - Writes a sweep log row for observability + resumability
//
// Invoke:
//   POST /contractor-outreach-statewide-sweep
//   { "trades": ["plumber","HVAC"], "tiers": ["primary"], "limit_per_query": 20,
//     "max_seconds": 90, "start_index": 0 }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MICHIGAN_CITIES, tierToPriority, type MichiganTier } from "../_shared/michigan-cities.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

const RATE_LIMIT_MS = 150;        // ~6 QPS, well under Google's 10 QPS cap
const DEFAULT_MAX_SECONDS = 90;   // edge-function wall-clock budget
const DEFAULT_LIMIT_PER_QUERY = 20;

const DEFAULT_TRADES = [
  "plumber",
  "HVAC contractor",
  "electrician",
  "roofer",
  "boiler service",
  "gutter installation",
  "siding contractor",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SweepInput {
  trades?: string[];
  tiers?: MichiganTier[];
  limit_per_query?: number;
  max_seconds?: number;
  start_index?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!GOOGLE_MAPS_API_KEY) {
    return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: SweepInput = {};
  try {
    body = req.method === "POST" ? await req.json() : {};
  } catch {
    body = {};
  }

  const trades = body.trades?.length ? body.trades : DEFAULT_TRADES;
  const tiers: MichiganTier[] = body.tiers?.length ? body.tiers : ["primary", "secondary"];
  const limitPerQuery = Math.min(body.limit_per_query ?? DEFAULT_LIMIT_PER_QUERY, 60);
  const maxSeconds = Math.min(body.max_seconds ?? DEFAULT_MAX_SECONDS, 110);
  const startIndex = Math.max(body.start_index ?? 0, 0);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  const deadline = startedAt + maxSeconds * 1000;

  // Build the (city × trade) job matrix in deterministic order
  const cities = MICHIGAN_CITIES.filter((c) => tiers.includes(c.tier));
  const jobs: Array<{ city: typeof cities[number]; trade: string }> = [];
  for (const c of cities) {
    for (const t of trades) jobs.push({ city: c, trade: t });
  }

  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  let lastIndex = startIndex;
  const errors: Array<{ city: string; trade: string; error: string }> = [];

  for (let i = startIndex; i < jobs.length; i++) {
    if (Date.now() > deadline) break; // graceful checkpoint exit
    lastIndex = i;
    const { city, trade } = jobs[i];

    try {
      const query = `${trade} ${city.city} MI`;
      const searchUrl =
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      if (!searchRes.ok || searchData.status === "REQUEST_DENIED" || searchData.status === "OVER_QUERY_LIMIT") {
        errors.push({ city: city.city, trade, error: `places_search:${searchData.status}` });
        if (searchData.status === "OVER_QUERY_LIMIT") break; // stop hitting quota
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      const places = (searchData.results || []).slice(0, limitPerQuery);
      scanned += places.length;

      for (const p of places) {
        if (Date.now() > deadline) break;

        // Dedupe before any detail fetch — saves quota
        const { data: existing, error: dupeErr } = await supabase
          .from("contractor_outreach_prospects")
          .select("id")
          .eq("business_name", p.name)
          .eq("trade", trade)
          .eq("city", city.city)
          .maybeSingle();
        if (dupeErr) {
          errors.push({ city: city.city, trade, error: `dedupe:${dupeErr.message}` });
          continue;
        }
        if (existing) { skipped++; continue; }

        // Detail fetch for phone + website
        let phone: string | null = null;
        let website: string | null = null;
        let address: string | null = null;
        try {
          await sleep(RATE_LIMIT_MS);
          const detailUrl =
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=formatted_phone_number,website,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;
          const dRes = await fetch(detailUrl);
          const dData = await dRes.json();
          phone = dData.result?.formatted_phone_number ?? null;
          website = dData.result?.website ?? null;
          address = dData.result?.formatted_address ?? null;
        } catch (e) {
          errors.push({ city: city.city, trade, error: `details:${(e as Error).message}` });
        }

        const row = {
          business_name: p.name,
          trade,
          city: city.city,
          state: "MI",
          phone,
          website,
          address,
          source: "google_maps_statewide",
          territory_priority: tierToPriority(city.tier),
        };

        const { error: insErr } = await supabase
          .from("contractor_outreach_prospects")
          .insert(row);
        if (insErr) {
          // territory_priority column may not exist on older schemas — retry without it
          if (insErr.message?.includes("territory_priority") || insErr.message?.includes("address")) {
            const { error: retryErr } = await supabase
              .from("contractor_outreach_prospects")
              .insert({
                business_name: row.business_name,
                trade: row.trade,
                city: row.city,
                state: row.state,
                phone: row.phone,
                website: row.website,
                source: row.source,
              });
            if (retryErr) {
              errors.push({ city: city.city, trade, error: `insert:${retryErr.message}` });
              continue;
            }
          } else {
            errors.push({ city: city.city, trade, error: `insert:${insErr.message}` });
            continue;
          }
        }
        inserted++;
      }

      await sleep(RATE_LIMIT_MS);
    } catch (e) {
      errors.push({ city: city.city, trade, error: (e as Error).message });
    }
  }

  const completedAll = lastIndex >= jobs.length - 1;
  const result = {
    ok: true,
    started_at: new Date(startedAt).toISOString(),
    elapsed_ms: Date.now() - startedAt,
    total_jobs: jobs.length,
    processed_through_index: lastIndex,
    next_start_index: completedAll ? null : lastIndex + 1,
    completed_all: completedAll,
    scanned,
    inserted,
    skipped_duplicates: skipped,
    error_count: errors.length,
    errors: errors.slice(0, 25),
  };

  // Best-effort sweep audit log (table may not exist yet)
  try {
    await supabase.from("contractor_outreach_audit_log").insert({
      event: "statewide_sweep",
      meta: result,
    });
  } catch (_) { /* non-fatal */ }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

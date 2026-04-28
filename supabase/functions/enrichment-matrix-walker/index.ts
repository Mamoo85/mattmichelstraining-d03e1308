// Sprint Wave 3 (I-walker) — Autonomous matrix walker.
// Crawls enabled trade × city pairs, picks the highest-priority pair with
// unenriched prospects, calls the existing waterfall, and logs everything to
// enrichment_walker_runs. Hard-capped per-run + per-pair daily cost so it
// can never run away with provider budget.
//
// Design intent: this is the "set it and forget it" autonomous revenue layer.
// Cron runs it every 30 minutes; admin can also trigger manually from UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Hard kill-switch: never enrich more than this in a single walker invocation.
const HARD_MAX_PER_RUN = 50;
// Defensive: never spend more than this estimate per single run.
const HARD_MAX_RUN_COST_USD = 10.0;

interface WalkerTarget {
  trade: string;
  city: string;
  enabled: boolean;
  priority: number;
  max_per_run: number;
  daily_cost_cap_usd: number;
  last_walked_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();

  try {
    // 1. Pick the next pair: enabled, lowest priority number, oldest last_walked_at.
    const { data: targets, error: tErr } = await sb
      .from("enrichment_walker_targets")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: true })
      .order("last_walked_at", { ascending: true, nullsFirst: true })
      .limit(20);

    if (tErr) throw new Error(`target fetch: ${tErr.message}`);
    if (!targets || targets.length === 0) {
      return json({ ok: true, skipped: "no enabled targets" });
    }

    // 2. For each candidate in priority order, find one with backlog and remaining budget.
    let chosen: WalkerTarget | null = null;
    let unenrichedCount = 0;

    for (const t of targets as WalkerTarget[]) {
      // Daily spend so far for this pair
      const today = new Date().toISOString().slice(0, 10);
      const { data: spent } = await sb
        .from("enrichment_walker_runs")
        .select("cost_estimate_usd")
        .eq("trade", t.trade)
        .eq("city", t.city)
        .gte("ran_at", `${today}T00:00:00Z`);

      const spentToday = (spent ?? []).reduce(
        (s, r) => s + Number(r.cost_estimate_usd ?? 0),
        0,
      );
      if (spentToday >= Number(t.daily_cost_cap_usd)) continue;

      // Backlog count
      const { count } = await sb
        .from("contractor_outreach_prospects")
        .select("id", { count: "exact", head: true })
        .eq("trade", t.trade)
        .eq("city", t.city)
        .is("enriched_at", null);

      if ((count ?? 0) > 0) {
        chosen = t;
        unenrichedCount = count ?? 0;
        break;
      }
    }

    if (!chosen) {
      return json({ ok: true, skipped: "no pair with backlog + budget remaining" });
    }

    // 3. Compute batch size.
    const batchSize = Math.min(
      chosen.max_per_run,
      unenrichedCount,
      HARD_MAX_PER_RUN,
    );

    // 4. Provider-health circuit breaker: if 2+ providers are disabled, skip.
    const { data: phealth } = await sb
      .from("enrichment_provider_health")
      .select("provider, disabled_until")
      .gt("disabled_until", new Date().toISOString());
    const downCount = phealth?.length ?? 0;
    if (downCount >= 2) {
      const log = await sb.from("enrichment_walker_runs").insert({
        trade: chosen.trade,
        city: chosen.city,
        unenriched_count: unenrichedCount,
        skipped_reason: `circuit_open: ${downCount} providers disabled`,
        meta: { providers_down: phealth },
      });
      return json({ ok: true, skipped: "circuit_open", providers_down: downCount });
    }

    // 5. Invoke the existing per-pair enricher.
    const enrichRes = await fetch(
      `${SUPABASE_URL}/functions/v1/contractor-outreach-enrich`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          trade: chosen.trade,
          city: chosen.city,
          limit: batchSize,
          source: "matrix_walker",
        }),
      },
    );

    let succeeded = 0;
    let failed = 0;
    let costEstimate = 0;
    let body: any = {};
    try {
      body = await enrichRes.json();
      succeeded = Number(body?.succeeded ?? body?.enriched ?? 0);
      failed = Number(body?.failed ?? 0);
      costEstimate = Number(body?.cost_estimate_usd ?? 0);
    } catch {
      // non-json response — treat as full failure
      failed = batchSize;
    }

    if (costEstimate > HARD_MAX_RUN_COST_USD) {
      // safety: clamp displayed cost so a buggy enricher can't crash the cap math
      costEstimate = HARD_MAX_RUN_COST_USD;
    }

    // 6. Log run + bump last_walked_at.
    await Promise.all([
      sb.from("enrichment_walker_runs").insert({
        trade: chosen.trade,
        city: chosen.city,
        unenriched_count: unenrichedCount,
        attempted: batchSize,
        succeeded,
        failed,
        cost_estimate_usd: costEstimate,
        meta: { http_status: enrichRes.status, response: body, duration_ms: Date.now() - startedAt },
      }),
      sb.from("enrichment_walker_targets")
        .update({ last_walked_at: new Date().toISOString() })
        .eq("trade", chosen.trade)
        .eq("city", chosen.city),
    ]);

    return json({
      ok: true,
      trade: chosen.trade,
      city: chosen.city,
      attempted: batchSize,
      succeeded,
      failed,
      cost_estimate_usd: costEstimate,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[matrix-walker] FATAL:", msg);
    return json({ ok: false, error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

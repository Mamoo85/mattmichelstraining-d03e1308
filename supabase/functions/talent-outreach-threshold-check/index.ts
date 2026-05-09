// talent-outreach-threshold-check
// Counts hire_alert_candidates per (state, trade_group). When a state crosses
// the threshold (default 50), marks it active in talent_outreach_states and
// fires talent-state-prospect-hunter to populate cold email targets.
// Called at end of talent-seed-bulk and as a standalone nightly cron.
// POST {} — no body required (reads everything from DB)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CANDIDATE_THRESHOLD = Number(Deno.env.get("OUTREACH_CANDIDATE_THRESHOLD") || "50");
// How long to wait before re-hunting a state that already crossed threshold (hours)
const REHUNT_INTERVAL_HOURS = Number(Deno.env.get("OUTREACH_REHUNT_HOURS") || "168"); // 7 days

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map individual trade values to the two outreach trade groups
const TRADE_TO_GROUP: Record<string, string> = {
  nursing: "nursing",
  home_health: "nursing",
  cdl_trucking: "cdl_trucking",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SUPABASE_SERVICE_KEY}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Count candidates grouped by state + trade
  const { data: counts, error: countErr } = await sb.rpc("count_candidates_by_state_trade");

  // Fallback: if the RPC doesn't exist yet, use a direct query (no group_by in PostgREST)
  let stateTradeCounts: Array<{ state: string; trade: string; cnt: number }> = [];
  if (countErr || !counts) {
    // Query all candidates and aggregate in JS — safe for up to ~50k rows
    const { data: rows } = await sb
      .from("hire_alert_candidates")
      .select("state, trade")
      .not("state", "is", null)
      .not("trade", "is", null)
      .limit(100000);

    if (rows) {
      const agg: Record<string, number> = {};
      for (const r of rows) {
        const key = `${r.state}|${r.trade}`;
        agg[key] = (agg[key] || 0) + 1;
      }
      stateTradeCounts = Object.entries(agg).map(([key, cnt]) => {
        const [state, trade] = key.split("|");
        return { state, trade, cnt };
      });
    }
  } else {
    stateTradeCounts = counts;
  }

  // Roll individual trades up to trade_groups
  const groupedByStateTradeGroup: Record<string, number> = {};
  for (const { state, trade, cnt } of stateTradeCounts) {
    const group = TRADE_TO_GROUP[trade];
    if (!group || !state) continue;
    const key = `${state}|${group}`;
    groupedByStateTradeGroup[key] = (groupedByStateTradeGroup[key] || 0) + cnt;
  }

  // Load current talent_outreach_states to find what's already tracked
  const { data: existing } = await sb
    .from("talent_outreach_states")
    .select("state, trade_group, outreach_active, last_hunt_at, threshold");
  const existingMap = new Map<string, { active: boolean; last_hunt_at: string | null; threshold: number }>();
  for (const row of existing || []) {
    existingMap.set(`${row.state}|${row.trade_group}`, {
      active: row.outreach_active,
      last_hunt_at: row.last_hunt_at,
      threshold: row.threshold,
    });
  }

  const now = new Date();
  const huntsTriggered: string[] = [];
  const activated: string[] = [];
  const updated: string[] = [];

  for (const [key, count] of Object.entries(groupedByStateTradeGroup)) {
    const [state, tradeGroup] = key.split("|");
    const current = existingMap.get(key);
    const threshold = current?.threshold ?? CANDIDATE_THRESHOLD;
    const crossedThreshold = count >= threshold;

    // Upsert the count record regardless
    await sb.from("talent_outreach_states").upsert({
      state,
      trade_group: tradeGroup,
      candidate_count: count,
      last_count_at: now.toISOString(),
      outreach_active: crossedThreshold,
      threshold_met_at: crossedThreshold && !current?.active ? now.toISOString() : (current?.active ? undefined : null),
    }, { onConflict: "state,trade_group" });

    if (crossedThreshold) {
      if (!current?.active) activated.push(key);
      updated.push(key);

      // Trigger prospect hunt if: newly activated OR last hunt was > REHUNT_INTERVAL_HOURS ago
      const lastHunt = current?.last_hunt_at ? new Date(current.last_hunt_at) : null;
      const hoursSinceHunt = lastHunt ? (now.getTime() - lastHunt.getTime()) / 3600000 : Infinity;

      if (!current?.active || hoursSinceHunt >= REHUNT_INTERVAL_HOURS) {
        // Fire-and-forget — don't await (edge function has limited time budget)
        fetch(`${SUPABASE_URL}/functions/v1/talent-state-prospect-hunter`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ state, trade_group: tradeGroup, limit: 40 }),
        }).catch(() => {});
        huntsTriggered.push(`${state}/${tradeGroup}`);
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    states_counted: Object.keys(groupedByStateTradeGroup).length,
    threshold: CANDIDATE_THRESHOLD,
    activated,
    updated,
    hunts_triggered: huntsTriggered,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

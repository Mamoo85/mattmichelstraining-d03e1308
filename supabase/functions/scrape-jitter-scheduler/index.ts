// D38: Defensive anti-bot evasion — randomizes scrape dispatch timing.
// Cron runs this every hour; it picks a random offset (0-2700s ≈ 0-45min)
// and uses pg_net inside enrichment_jitter_log to schedule the actual scrape.
// Rotates proxy_pool selection across runs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jitterSeconds } from "../_shared/enrichment-router.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROXY_POOLS = ["stealth", "residential", "datacenter"] as const;

interface ScrapeTarget {
  source: string;            // function name to invoke
  maxJitterSec: number;      // window size
  weightProxy: Record<string, number>; // weighted random pool selection
}

const TARGETS: ScrapeTarget[] = [
  { source: "miosha-license-scraper",  maxJitterSec: 2700, weightProxy: { stealth: 6, residential: 3, datacenter: 1 } },
  { source: "permit-watch-scanner",    maxJitterSec: 1800, weightProxy: { stealth: 7, residential: 2, datacenter: 1 } },
  { source: "industrial-growth-intel", maxJitterSec: 2400, weightProxy: { stealth: 5, residential: 4, datacenter: 1 } },
  { source: "industry-pulse-scan",     maxJitterSec: 2400, weightProxy: { stealth: 5, residential: 4, datacenter: 1 } },
];

function pickProxy(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [pool, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return pool;
  }
  return PROXY_POOLS[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const scheduledAt = new Date();
  const dispatched: Array<{ source: string; jitter_seconds: number; proxy_pool: string }> = [];

  for (const target of TARGETS) {
    const jitter = jitterSeconds(target.maxJitterSec);
    const proxy_pool = pickProxy(target.weightProxy);
    const jitteredAt = new Date(scheduledAt.getTime() + jitter * 1000);

    // Log the plan
    await sb.from("enrichment_jitter_log").insert({
      source: target.source,
      scheduled_at: scheduledAt.toISOString(),
      jittered_at: jitteredAt.toISOString(),
      jitter_seconds: jitter,
      proxy_pool,
    });

    // Schedule the actual call via pg_net at the jittered time using simple setTimeout
    // (Edge function lifetime is too short for >150s sleeps; use background dispatch.)
    if (jitter < 60) {
      // Short — just await
      setTimeout(() => {
        fetch(`${SUPABASE_URL}/functions/v1/${target.source}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ proxy_pool, jittered: true }),
        }).catch((e) => console.warn(`[jitter] dispatch ${target.source} failed:`, e));
      }, jitter * 1000);
    } else {
      // Long jitter — schedule via pg_cron one-shot (fire-and-forget through pg_net)
      const cronExpr = `${jitteredAt.getUTCMinutes()} ${jitteredAt.getUTCHours()} ${jitteredAt.getUTCDate()} ${jitteredAt.getUTCMonth() + 1} *`;
      try {
        await sb.rpc("schedule_one_shot_dispatch", {
          p_cron: cronExpr,
          p_function_name: target.source,
          p_payload: JSON.stringify({ proxy_pool, jittered: true }),
        });
      } catch {
        // RPC may not exist yet; fallback to immediate dispatch (fewer hops, slightly less jitter benefit)
        setTimeout(() => {
          fetch(`${SUPABASE_URL}/functions/v1/${target.source}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ proxy_pool, jittered: true }),
          }).catch(() => {});
        }, Math.min(jitter, 30) * 1000);
      }
    }

    dispatched.push({ source: target.source, jitter_seconds: jitter, proxy_pool });
  }

  return new Response(
    JSON.stringify({ ok: true, scheduled: dispatched.length, dispatched }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

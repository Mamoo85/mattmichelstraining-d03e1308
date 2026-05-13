// Pipeline Autoscaler — runs every 15 min via pg_cron.
// For each tracked pipeline, if its table row count is below threshold,
// fire its filler function extra times. The lower the count, the more times we fire.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

// pipeline -> { table, healthy, critical, fns: edge functions to call when low }
const PIPELINES: Record<string, { table: string; healthy: number; critical: number; fns: string[] }> = {
  buyer_pools:           { table: "buyer_pools",           healthy: 500,   critical: 100,   fns: ["buyer-universe-orchestrator", "cold-email-pool-router", "buyer-pool-promote"] },
  raw_buyer_candidates:  { table: "raw_buyer_candidates",  healthy: 10000, critical: 2000,  fns: ["buyer-universe-orchestrator"] },
  trade_radar_leads:     { table: "trade_radar_leads",     healthy: 5000,  critical: 1000,  fns: ["trade-radar-scanner"] },
  mortgage_radar_leads:  { table: "mortgage_radar_leads",  healthy: 1000,  critical: 200,   fns: ["mortgage-radar-scanner"] },
  hire_alert_candidates: { table: "hire_alert_candidates", healthy: 1000,  critical: 200,   fns: ["techalert-prospect-hunter", "techalert-enrich"] },
  outreach_leads:        { table: "outreach_leads",        healthy: 5000,  critical: 1000,  fns: ["channel-prospector", "outreach-leads-enrich"] },
  dead_lead_contacts:    { table: "dead_lead_contacts",    healthy: 500,   critical: 50,    fns: ["dead-lead-pool-refresh"] },
  cold_call_queue:       { table: "cold_call_queue",       healthy: 1000,  critical: 200,   fns: ["cold-email-pool-router"] },
};

function multiplier(count: number, healthy: number, critical: number): number {
  if (count >= healthy) return 0;       // skip — pipeline is healthy
  if (count <= critical) return 3;      // critical — fire 3x
  if (count < healthy / 2) return 2;    // low — fire 2x
  return 1;                             // below healthy — fire 1x
}

async function fireFn(name: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}` },
      body: "{}",
      signal: AbortSignal.timeout(4000),
    }).catch(() => {});
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const report: any[] = [];
  const fired: Record<string, number> = {};

  for (const [key, cfg] of Object.entries(PIPELINES)) {
    const { count, error } = await sb.from(cfg.table).select("*", { count: "exact", head: true });
    if (error) {
      report.push({ pipeline: key, error: error.message });
      continue;
    }
    const c = count ?? 0;
    const m = multiplier(c, cfg.healthy, cfg.critical);
    const status = c >= cfg.healthy ? "healthy" : c <= cfg.critical ? "critical" : "low";
    report.push({ pipeline: key, count: c, status, multiplier: m, fns: cfg.fns });
    if (m === 0) continue;

    for (const fn of cfg.fns) {
      for (let i = 0; i < m; i++) {
        fireFn(fn); // fire-and-forget
        fired[fn] = (fired[fn] ?? 0) + 1;
      }
    }
  }

  // Log run
  await sb.from("error_logs").insert({
    function_name: "pipeline-autoscaler",
    severity: "info",
    message: `Autoscaler fired ${Object.values(fired).reduce((a, b) => a + b, 0)} invocations`,
    context: { report, fired },
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true, report, fired }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

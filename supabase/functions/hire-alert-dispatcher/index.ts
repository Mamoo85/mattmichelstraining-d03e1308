// hire-alert-dispatcher — 3-second producer.
// Replaces the old monolithic 45-90s hire-alert-scanner cron pattern.
// Pushes one message per data source onto pgmq.scrape_jobs and exits.
// queue-worker-scrape consumes them on its own cron.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Only sources with a real worker mapped in queue-worker-scrape get enqueued.
// bpl / indeed / ziprecruiter / florida_dbpr / openrouter_jobseekers /
// detroit_bseed_permits already run in-process inside hire-alert-scanner's
// own 4h cron, so we don't double-dispatch them here.
const SOURCES = [
  "miosha",
  "lara_val",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();
  const dispatched: string[] = [];
  const skipped: { source: string; reason: string }[] = [];

  // Read existing checkpoints
  const { data: cps } = await sb
    .from("hire_alert_scanner_checkpoints")
    .select("source,status,last_dispatched_at");
  const cpMap = new Map((cps || []).map((c: any) => [c.source, c]));

  const now = Date.now();
  const STALE_MS = 30 * 60 * 1000; // re-dispatch a "processing" job after 30 min of silence

  for (const source of SOURCES) {
    const cp = cpMap.get(source);
    if (cp && (cp.status === "queued" || cp.status === "processing")) {
      const lastTs = cp.last_dispatched_at ? new Date(cp.last_dispatched_at).getTime() : 0;
      if (now - lastTs < STALE_MS) {
        skipped.push({ source, reason: `still ${cp.status}` });
        continue;
      }
    }

    // Enqueue
    const { error: enqErr } = await sb.rpc("enqueue_job", {
      queue_name: "scrape_jobs",
      payload: { source, dispatched_at: new Date().toISOString() },
    });
    if (enqErr) {
      skipped.push({ source, reason: `enqueue failed: ${enqErr.message}` });
      continue;
    }

    // Mark checkpoint queued
    await sb
      .from("hire_alert_scanner_checkpoints")
      .upsert(
        { source, status: "queued", last_dispatched_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { onConflict: "source" }
      );

    dispatched.push(source);
  }

  const summary = {
    ok: true,
    dispatched,
    skipped,
    duration_ms: Date.now() - startedAt,
  };
  console.log(`[hire-alert-dispatcher] ${JSON.stringify(summary)}`);

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

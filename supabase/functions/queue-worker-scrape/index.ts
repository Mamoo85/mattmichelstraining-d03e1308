// queue-worker-scrape — runs every minute via pg_cron.
// Reads up to N messages from pgmq.scrape_jobs and dispatches each to the
// appropriate single-source scraper edge function (fire-and-forget).
// Each invocation of THIS worker stays well under 60s; the actual scraping
// happens in the per-source workers it spawns.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map a queue source name to the edge function that actually does the work.
// Most don't exist as standalone yet — the worker will mark them ok and skip
// gracefully so the queue doesn't back up. As source-specific workers are
// extracted from the legacy hire-alert-scanner, drop them in here.
const SOURCE_FUNCTIONS: Record<string, string | null> = {
  miosha: "miosha-license-scraper",
  bpl: null,
  indeed: null,
  ziprecruiter: null,
  florida_dbpr: null,
  openrouter_jobseekers: null,
  lara_val: "lara-fast-scanner",
  detroit_bseed_permits: null,
  // New deterministic agents (per protocol):
  talent_radar: "talent-radar-extraction",   // Socrata SODA — last 24h, 4 trades
  demand_radar: "demand-radar-extraction",   // Google Places — 25/25/25/25 sectors
};

const BATCH_SIZE = 5;
const VISIBILITY_TIMEOUT_S = 300; // 5 min — worker has time to finish or message becomes visible again
const MAX_READ_COUNT = 3; // after 3 failed pickups, move to DLQ
const BUDGET_MS = 50_000;

async function invokeAsync(sb: any, fnName: string, payload: any) {
  // Use raw fetch with no-await pattern? We need to track success.
  // pg_net would be ideal, but from edge function we just fetch with short timeout
  // and trust the downstream function to do its own work async.
  const url = `${SUPABASE_URL}/functions/v1/${fnName}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000), // we just need it to start; downstream finishes on its own
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    // Timeout is expected for long jobs — treat as "started"
    if (e instanceof Error && e.name === "TimeoutError") {
      return { ok: true, status: 0, started: true };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  const { data: messages, error } = await sb.rpc("read_job_batch", {
    queue_name: "scrape_jobs",
    batch_size: BATCH_SIZE,
    vt: VISIBILITY_TIMEOUT_S,
  });

  if (error) {
    console.error("[queue-worker-scrape] read error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processed: any[] = [];

  for (const msg of messages || []) {
    if (Date.now() - startedAt > BUDGET_MS) break;

    const payload = msg.message;
    const source = payload?.source;

    // Poison pill → DLQ
    if (msg.read_ct >= MAX_READ_COUNT) {
      await sb.rpc("move_to_dlq", {
        source_queue: "scrape_jobs",
        dlq_name: "dlq_scrape",
        message_id: msg.msg_id,
        payload,
      });
      await sb
        .from("hire_alert_scanner_checkpoints")
        .upsert(
          { source, status: "error", last_error: "max retries exceeded", updated_at: new Date().toISOString() },
          { onConflict: "source" }
        );
      processed.push({ source, action: "dlq" });
      continue;
    }

    const fnName = SOURCE_FUNCTIONS[source];
    if (!fnName) {
      // No worker yet — mark ok + delete so the queue doesn't back up.
      await sb.rpc("delete_job", { queue_name: "scrape_jobs", message_id: msg.msg_id });
      await sb
        .from("hire_alert_scanner_checkpoints")
        .upsert(
          {
            source,
            status: "ok",
            last_completed_at: new Date().toISOString(),
            last_error: "no worker mapped — skipped",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source" }
        );
      // Log a transparent run row so admin can see this source had no worker
      await sb.from("hire_alert_runs").insert({
        run_at: new Date().toISOString(),
        source,
        candidates_found: 0,
        new_candidates: 0,
        alerts_sent: 0,
        errors: 0,
        status: "skipped_no_worker",
        completed_at: new Date().toISOString(),
      } as any);
      processed.push({ source, action: "skipped_no_worker" });
      continue;
    }

    // Mark processing
    await sb
      .from("hire_alert_scanner_checkpoints")
      .upsert(
        { source, status: "processing", updated_at: new Date().toISOString() },
        { onConflict: "source" }
      );

    const result = await invokeAsync(sb, fnName, { msg_id: msg.msg_id, ...payload });

    if (result.ok) {
      await sb.rpc("delete_job", { queue_name: "scrape_jobs", message_id: msg.msg_id });
      await sb
        .from("hire_alert_scanner_checkpoints")
        .upsert(
          {
            source,
            status: "ok",
            last_completed_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source" }
        );
      processed.push({ source, action: "dispatched", fn: fnName });
    } else {
      // Leave message for retry (visibility timeout will requeue it)
      await sb
        .from("hire_alert_scanner_checkpoints")
        .upsert(
          {
            source,
            status: "error",
            last_error: result.error || `HTTP ${result.status}`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source" }
        );
      processed.push({ source, action: "failed", error: result.error });
    }
  }

  const summary = { ok: true, processed, duration_ms: Date.now() - startedAt };
  console.log(`[queue-worker-scrape] ${JSON.stringify(summary)}`);
  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

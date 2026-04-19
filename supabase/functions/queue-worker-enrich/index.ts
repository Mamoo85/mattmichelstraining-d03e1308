// queue-worker-enrich — runs every minute via pg_cron.
// Reads up to N messages from pgmq.enrich_jobs. Each message is one candidate
// at one waterfall stage. For now we proxy to the existing candidate-deep-enrich
// edge function (which still does all 8 stages) — but because we're calling it
// per-candidate from the queue, no single worker invocation runs longer than
// it takes one candidate to finish. The full waterfall split (one stage per
// message) lands in items C21-C30.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 3;
const VISIBILITY_TIMEOUT_S = 180;
const MAX_READ_COUNT = 3;
const BUDGET_MS = 55_000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  const { data: messages, error } = await sb.rpc("read_job_batch", {
    queue_name: "enrich_jobs",
    batch_size: BATCH_SIZE,
    vt: VISIBILITY_TIMEOUT_S,
  });

  if (error) {
    console.error("[queue-worker-enrich] read error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processed: any[] = [];

  for (const msg of messages || []) {
    if (Date.now() - startedAt > BUDGET_MS) break;

    const payload = msg.message;
    const candidateId = payload?.candidate_id;

    if (!candidateId) {
      await sb.rpc("delete_job", { queue_name: "enrich_jobs", message_id: msg.msg_id });
      processed.push({ action: "dropped_invalid" });
      continue;
    }

    if (msg.read_ct >= MAX_READ_COUNT) {
      await sb.rpc("move_to_dlq", {
        source_queue: "enrich_jobs",
        dlq_name: "dlq_enrich",
        message_id: msg.msg_id,
        payload,
      });
      processed.push({ candidate_id: candidateId, action: "dlq" });
      continue;
    }

    // Invoke deep-enrich for this single candidate.
    // The fn is idempotent and writes its own enrichment results.
    const url = `${SUPABASE_URL}/functions/v1/candidate-deep-enrich?ids=${encodeURIComponent(
      candidateId
    )}&force=1`;
    let ok = false;
    let errMsg = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ msg_id: msg.msg_id, ...payload }),
        signal: AbortSignal.timeout(15_000),
      });
      ok = res.ok;
      if (!ok) errMsg = `HTTP ${res.status}`;
    } catch (e) {
      // Timeout is acceptable — downstream may still be running. Treat as started.
      if (e instanceof Error && e.name === "TimeoutError") {
        ok = true;
      } else {
        errMsg = e instanceof Error ? e.message : String(e);
      }
    }

    if (ok) {
      await sb.rpc("delete_job", { queue_name: "enrich_jobs", message_id: msg.msg_id });
      processed.push({ candidate_id: candidateId, action: "enriched" });
    } else {
      // Leave for retry
      processed.push({ candidate_id: candidateId, action: "failed", error: errMsg });
    }
  }

  const summary = { ok: true, processed, duration_ms: Date.now() - startedAt };
  console.log(`[queue-worker-enrich] ${JSON.stringify(summary)}`);
  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

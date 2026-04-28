// Statewide enrichment worker — drains the unenriched-prospect backlog produced by
// the statewide sweep, in tier order (territory_priority 1 → 2 → 3).
//
// Defensive design (per DWA Defensive Programming Protocol):
//   - Wall-clock budget so cron invocations don't time out
//   - Serial batches with rate-limit pause between batches
//   - Calls existing `contractor-outreach-enrich` (single-prospect waterfall)
//   - All errors awaited, captured per-prospect, never swallowed
//   - Audit row written to contractor_outreach_audit_log (best-effort)
//
// Invoke (admin or cron):
//   POST /contractor-outreach-statewide-enrich
//   { "max_seconds": 90, "batch_size": 5, "limit": 60, "tiers": [1,2,3] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DEFAULT_MAX_SECONDS = 90;
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_LIMIT = 60;
const PAUSE_BETWEEN_BATCHES_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Body {
  max_seconds?: number;
  batch_size?: number;
  limit?: number;
  tiers?: number[];
}

async function invokeEnrich(prospectId: string): Promise<{ ok: boolean; email?: string; reason?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/contractor-outreach-enrich`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ prospect_id: prospectId }),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      return { ok: false, reason: data?.error || data?.reason || `http_${res.status}` };
    }
    const email = data?.prospect?.email || null;
    return { ok: !!email, email: email || undefined, reason: email ? undefined : "no_email" };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: Body = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch { body = {}; }

  const maxSeconds = Math.min(Math.max(body.max_seconds ?? DEFAULT_MAX_SECONDS, 10), 110);
  const batchSize = Math.min(Math.max(body.batch_size ?? DEFAULT_BATCH_SIZE, 1), 10);
  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), 200);
  const tiers = body.tiers?.length ? body.tiers : [1, 2, 3];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  const deadline = startedAt + maxSeconds * 1000;

  // Pull statewide-sweep rows that are still unenriched, in tier priority order.
  const { data: rows, error: queryErr } = await supabase
    .from("contractor_outreach_prospects")
    .select("id, business_name, city, trade, territory_priority")
    .eq("source", "google_maps_statewide")
    .is("email", null)
    .is("unsubscribed_at", null)
    .in("territory_priority", tiers)
    .order("territory_priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (queryErr) {
    return new Response(JSON.stringify({ ok: false, error: `query:${queryErr.message}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const candidates = rows || [];
  let attempted = 0;
  let enriched = 0;
  const failures: Array<{ id: string; name: string; reason: string }> = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    if (Date.now() > deadline) break;
    const batch = candidates.slice(i, i + batchSize);

    const results = await Promise.all(batch.map((p: any) => invokeEnrich(p.id)));
    for (let j = 0; j < batch.length; j++) {
      attempted++;
      const r = results[j];
      if (r.ok) {
        enriched++;
      } else {
        failures.push({ id: batch[j].id, name: batch[j].business_name, reason: r.reason || "unknown" });
      }
    }

    if (i + batchSize < candidates.length && Date.now() < deadline) {
      await sleep(PAUSE_BETWEEN_BATCHES_MS);
    }
  }

  const result = {
    ok: true,
    started_at: new Date(startedAt).toISOString(),
    elapsed_ms: Date.now() - startedAt,
    backlog_pulled: candidates.length,
    attempted,
    enriched,
    failed: attempted - enriched,
    completed_all: attempted === candidates.length,
    failure_sample: failures.slice(0, 15),
  };

  // Best-effort audit log
  try {
    await supabase.from("contractor_outreach_audit_log").insert({
      event: "statewide_enrich",
      meta: result,
    });
  } catch (_) { /* non-fatal */ }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

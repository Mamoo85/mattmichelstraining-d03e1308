// Sprint G — Backfill: replay prospects that ended up missing/partial fields
// (e.g. created with earlier un-hardened parsing) through the current waterfall.
//
// Safety:
//   - MAX_PER_RUN cap (default 50, hard ceiling 250)
//   - Dry-run mode returns candidate IDs without invoking enrich
//   - Per-prospect attempt cap via enrichment_replay_log (skip if >3 prior replays)
//   - Refuses to run if circuit breakers are open on >=2 providers
//   - Writes audit trail to enrichment_replay_log
//
// Selection criteria (in priority order):
//   1. enrichment_status='no_data' AND enriched_at < now()-14d (stale failures)
//   2. enrichment_status='enriched' but missing email AND missing phone (partial)
//   3. dead_letter rows with attempts<5 AND last_attempt_at < now()-1d
//
// Invocation:
//   POST { mode: "dry_run" | "execute", limit?: number, source?: "no_data"|"partial"|"dlq"|"all" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HARD_MAX = 250;
const DEFAULT_LIMIT = 50;
const MAX_REPLAYS_PER_PROSPECT = 3;

type Source = "no_data" | "partial" | "dlq" | "all";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  let body: Record<string, unknown> = {};
  try { body = await req.json().catch(() => ({})); } catch { body = {}; }

  const mode = (body.mode === "execute") ? "execute" : "dry_run";
  const requestedLimit = Number(body.limit ?? DEFAULT_LIMIT);
  const limit = Math.max(1, Math.min(HARD_MAX, isFinite(requestedLimit) ? requestedLimit : DEFAULT_LIMIT));
  const source: Source = ["no_data", "partial", "dlq", "all"].includes(body.source as string)
    ? body.source as Source : "all";

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── Wave 5: DLQ aging — prospects in DLQ > 7 days get marked unenrichable ──
  let aged_count = 0;
  if (mode === "execute") {
    try {
      const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data: aged } = await sb
        .from("enrichment_dead_letter")
        .select("id, prospect_id")
        .lt("created_at", cutoff)
        .eq("permanent_failure", false)
        .limit(500);
      for (const row of aged ?? []) {
        if (row.prospect_id) {
          await sb.from("contractor_outreach_prospects")
            .update({
              suppressed_at: new Date().toISOString(),
              suppression_reason: "dlq_aged_unenrichable",
            })
            .eq("id", row.prospect_id)
            .is("suppressed_at", null);
        }
        await sb.from("enrichment_dead_letter")
          .update({ permanent_failure: true, last_error: "aged_to_suppression after 7d" })
          .eq("id", row.id);
        aged_count++;
      }
    } catch (e) {
      console.warn("[backfill] dlq aging step failed:", e);
    }
  }

  // Safety check: refuse if too many providers are unhealthy
  try {
    const { data: unhealthy } = await sb
      .from("enrichment_provider_health")
      .select("provider")
      .lt("success_rate", 0.3)
      .gte("call_count_24h", 10);
    if ((unhealthy?.length ?? 0) >= 2) {
      return json({
        ok: false,
        skipped: "providers_unhealthy",
        unhealthy_providers: unhealthy?.map((r) => r.provider) ?? [],
      }, 200);
    }
  } catch (_) { /* table may not exist; non-fatal */ }

  // Build candidate set
  const candidates: { id: string; reason: string; source_table: string }[] = [];

  if (source === "no_data" || source === "all") {
    const { data } = await sb
      .from("contractor_outreach_prospects")
      .select("id")
      .eq("enrichment_status", "no_data")
      .is("suppressed_at", null) // Wave 5: skip aged-out prospects
      .lt("enriched_at", new Date(Date.now() - 14 * 86400_000).toISOString())
      .order("enrichment_confidence", { ascending: false }) // Wave 5: high-confidence first
      .limit(limit);
    for (const r of data ?? []) {
      candidates.push({ id: r.id, reason: "stale_no_data", source_table: "contractor_outreach_prospects" });
    }
  }

  if ((source === "partial" || source === "all") && candidates.length < limit) {
    const remaining = limit - candidates.length;
    const { data } = await sb
      .from("contractor_outreach_prospects")
      .select("id")
      .eq("enrichment_status", "enriched")
      .is("suppressed_at", null) // Wave 5
      .is("email", null)
      .is("phone", null)
      .order("enrichment_confidence", { ascending: false }) // Wave 5
      .limit(remaining);
    for (const r of data ?? []) {
      candidates.push({ id: r.id, reason: "partial_enrichment", source_table: "contractor_outreach_prospects" });
    }
  }

  if ((source === "dlq" || source === "all") && candidates.length < limit) {
    const remaining = limit - candidates.length;
    const { data } = await sb
      .from("enrichment_dead_letter")
      .select("prospect_id, attempt_count")
      .lt("attempt_count", 5)
      .lt("last_attempt_at", new Date(Date.now() - 86400_000).toISOString())
      .limit(remaining);
    for (const r of data ?? []) {
      if (r.prospect_id) {
        candidates.push({ id: r.prospect_id, reason: "dlq_retry", source_table: "enrichment_dead_letter" });
      }
    }
  }

  if (candidates.length === 0) {
    return json({ ok: true, mode, total_candidates: 0, processed: 0, duration_ms: Date.now() - startedAt }, 200);
  }

  // Filter out prospects already replayed too many times
  const ids = candidates.map((c) => c.id);
  const { data: replayCounts } = await sb
    .from("enrichment_replay_log")
    .select("prospect_id")
    .in("prospect_id", ids);
  const counts: Record<string, number> = {};
  for (const r of replayCounts ?? []) {
    counts[r.prospect_id] = (counts[r.prospect_id] ?? 0) + 1;
  }
  const eligible = candidates.filter((c) => (counts[c.id] ?? 0) < MAX_REPLAYS_PER_PROSPECT);
  const skipped_max_replays = candidates.length - eligible.length;

  if (mode === "dry_run") {
    return json({
      ok: true,
      mode,
      total_candidates: candidates.length,
      eligible: eligible.length,
      skipped_max_replays,
      preview: eligible.slice(0, 10),
      duration_ms: Date.now() - startedAt,
    }, 200);
  }

  // Execute: invoke statewide-enrich for each (sequentially, not parallel — respect rate limits)
  let succeeded = 0;
  let failed = 0;
  const errors: { id: string; error: string }[] = [];

  for (const c of eligible) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/contractor-outreach-statewide-enrich`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ prospect_id: c.id, force: true }),
        signal: AbortSignal.timeout(30_000),
      });
      const okFlag = res.ok;
      await res.body?.cancel();
      if (okFlag) succeeded++; else { failed++; errors.push({ id: c.id, error: `status ${res.status}` }); }

      // Audit log entry (fire-and-forget)
      await sb.from("enrichment_replay_log").insert({
        prospect_id: c.id,
        reason: c.reason,
        triggered_by: "backfill",
        success: okFlag,
        meta: { source_table: c.source_table, mode },
      });
    } catch (e) {
      failed++;
      errors.push({ id: c.id, error: String(e).slice(0, 200) });
    }
    // Tiny pacing delay to avoid spiking provider quotas
    await new Promise((r) => setTimeout(r, 250));
  }

  return json({
    ok: true,
    mode,
    total_candidates: candidates.length,
    eligible: eligible.length,
    processed: eligible.length,
    succeeded,
    failed,
    skipped_max_replays,
    errors: errors.slice(0, 20),
    duration_ms: Date.now() - startedAt,
  }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

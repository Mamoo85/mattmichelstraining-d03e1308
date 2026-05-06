// enrichment-rerun-batch: re-runs prospects ordered by enrichment_confidence ASC NULLS FIRST.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 100), 500);
    const minConfidence = body.minConfidence != null ? Number(body.minConfidence) : null;
    const maxConfidence = body.maxConfidence != null ? Number(body.maxConfidence) : null;
    const trade = body.trade as string | undefined;
    const city = body.city as string | undefined;

    const runId = crypto.randomUUID();

    let q = supabase
      .from("prospects")
      .select("id, enrichment_confidence, trade, city")
      .order("enrichment_confidence", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (minConfidence != null) q = q.gte("enrichment_confidence", minConfidence);
    if (maxConfidence != null) q = q.lte("enrichment_confidence", maxConfidence);
    if (trade) q = q.eq("trade", trade);
    if (city) q = q.eq("city", city);

    const { data: prospects, error } = await q;
    if (error) throw error;

    const total = prospects?.length ?? 0;
    await supabase.from("enrichment_run_progress").insert({
      progress_id: runId,
      kind: "rerun_batch",
      step: "starting",
      total,
      processed: 0,
      meta: { limit, minConfidence, maxConfidence, trade, city },
    });

    let updated = 0, skipped = 0, suppressed = 0, processed = 0;

    for (const p of prospects || []) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-enrichment-waterfall`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ prospect_id: p.id, force: true }),
        });
        const j = await res.json().catch(() => ({}));
        if (j?.suppressed) suppressed++;
        else if (j?.skipped || j?.budget_blocked) skipped++;
        else if (j?.updated || j?.ok) updated++;
        else skipped++;
      } catch {
        skipped++;
      }
      processed++;
      if (processed % 10 === 0 || processed === total) {
        await supabase
          .from("enrichment_run_progress")
          .update({
            processed,
            step: "running",
            meta: { updated, skipped, suppressed, limit, minConfidence, maxConfidence, trade, city },
            updated_at: new Date().toISOString(),
          })
          .eq("progress_id", runId);
      }
    }

    await supabase
      .from("enrichment_run_progress")
      .update({
        processed,
        step: "done",
        done: true,
        message: `Updated ${updated} / Skipped ${skipped} / Suppressed ${suppressed}`,
        meta: { updated, skipped, suppressed, total },
        updated_at: new Date().toISOString(),
      })
      .eq("progress_id", runId);

    return new Response(
      JSON.stringify({ ok: true, run_id: runId, total, updated, skipped, suppressed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

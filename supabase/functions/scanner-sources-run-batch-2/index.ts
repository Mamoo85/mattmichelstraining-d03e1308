// Dispatcher edge function — Batch 2 (property data: ATTOM + RentCast).
// Enforces a minimum-row floor per source so the DB never silently dries up;
// any source under floor triggers an INFO-level scanner_alerts row that the
// monitoring function escalates if it persists.
//
// curl -X POST $SUPABASE_URL/functions/v1/scanner-sources-run-batch-2

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runSources } from "../_shared/source-framework.ts";
import { BATCH_2_SOURCES, BATCH_2_MIN_ROWS } from "../_shared/scanner-sources-batch-2.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const started = Date.now();
  const results = await runSources(sb, BATCH_2_SOURCES, { concurrency: 2 });

  // Min-row floor alerts: open a scanner_alerts row if a successful run came
  // back light. The monitor function (scanner-monitor-alert) escalates to SMS
  // when the same alert key repeats over 24h.
  const underFloor: { source: string; rows: number; floor: number }[] = [];
  for (const r of results) {
    const floor = BATCH_2_MIN_ROWS[r.slug];
    if (floor != null && r.ok && r.rows < floor) {
      underFloor.push({ source: r.slug, rows: r.rows, floor });
      try {
        await sb.from("scanner_alerts").upsert({
          source: r.slug,
          severity: "WARN",
          reason: "min_rows_floor",
          message: `Returned ${r.rows} rows (floor ${floor}). DB may run thin.`,
          status: "open",
          last_seen_at: new Date().toISOString(),
        }, { onConflict: "source,reason" });
      } catch { /* table may be permissive; ignore */ }
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const totalRows = results.reduce((sum, r) => sum + (r.rows ?? 0), 0);

  return new Response(
    JSON.stringify({
      ok: true,
      ran: results.length,
      succeeded: ok,
      failed: results.length - ok,
      total_rows: totalRows,
      under_floor: underFloor,
      duration_ms: Date.now() - started,
      results,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

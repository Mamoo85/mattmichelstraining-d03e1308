// Dispatcher edge function — runs Batch 1 of framework-authored scanner sources.
// Schedule via pg_cron (every 30 min) or invoke manually for testing.
//
// curl -X POST $SUPABASE_URL/functions/v1/scanner-sources-run-batch-1

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runSources } from "../_shared/source-framework.ts";
import { BATCH_1_SOURCES } from "../_shared/scanner-sources-batch-1.ts";

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
  const results = await runSources(sb, BATCH_1_SOURCES, { concurrency: 3 });
  const ok = results.filter((r) => r.ok).length;
  const totalRows = results.reduce((sum, r) => sum + (r.rows ?? 0), 0);

  return new Response(
    JSON.stringify({
      ok: true,
      ran: results.length,
      succeeded: ok,
      failed: results.length - ok,
      total_rows: totalRows,
      duration_ms: Date.now() - started,
      results,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

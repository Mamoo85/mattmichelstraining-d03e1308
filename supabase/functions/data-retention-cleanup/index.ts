// data-retention-cleanup — Weekly cron on Sunday at 2am UTC.
// Prevents unbounded table growth that causes performance degradation and storage costs.
// Operations:
//   1. Delete crm_visitor_events older than 90 days
//   2. Delete error_logs older than 30 days
//   3. Nullify enrichment_trace on outreach_leads older than 60 days (keep email, drop trace JSON)
//   4. Delete stale agent_heartbeats entries (keep only the latest per agent)
//   5. Delete global_outreach_log entries older than 30 days

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results: Record<string, number | string> = {};

  const now = Date.now();
  const ago = (days: number) => new Date(now - days * 86400000).toISOString();

  // 1. crm_visitor_events older than 90 days
  try {
    const { count } = await sb
      .from("crm_visitor_events")
      .delete({ count: "exact" })
      .lt("created_at", ago(90));
    results.visitor_events_deleted = count ?? 0;
  } catch (e) {
    results.visitor_events_error = e instanceof Error ? e.message : String(e);
  }

  // 2. error_logs older than 30 days
  try {
    const { count } = await sb
      .from("error_logs")
      .delete({ count: "exact" })
      .lt("created_at", ago(30));
    results.error_logs_deleted = count ?? 0;
  } catch (e) {
    results.error_logs_error = e instanceof Error ? e.message : String(e);
  }

  // 3. Nullify enrichment_trace on outreach_leads older than 60 days
  try {
    const { count } = await sb
      .from("outreach_leads")
      .update({ enrichment_trace: null }, { count: "exact" })
      .lt("enriched_at", ago(60))
      .not("enrichment_trace", "is", null);
    results.enrichment_traces_cleared = count ?? 0;
  } catch (e) {
    results.enrichment_trace_error = e instanceof Error ? e.message : String(e);
  }

  // 4. Prune stale agent_heartbeats — keep only latest per agent (delete rows older than 7 days)
  try {
    const { count } = await sb
      .from("agent_heartbeats")
      .delete({ count: "exact" })
      .lt("last_beat", ago(7));
    results.heartbeats_pruned = count ?? 0;
  } catch (e) {
    results.heartbeats_error = e instanceof Error ? e.message : String(e);
  }

  // 5. global_outreach_log entries older than 30 days
  try {
    const { count } = await sb
      .from("global_outreach_log")
      .delete({ count: "exact" })
      .lt("contacted_at", ago(30));
    results.outreach_log_deleted = count ?? 0;
  } catch (e) {
    results.outreach_log_error = e instanceof Error ? e.message : String(e);
  }

  console.log("[data-retention-cleanup]", results);

  await sb.from("agent_heartbeats").upsert({
    agent_name: "data-retention-cleanup",
    last_beat: new Date().toISOString(),
    status: "ok",
    metadata: results,
  }, { onConflict: "agent_name" });

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Admin Database Matrix — live row counts for every key table + linked scanner cron status.
// One call → table for /dwa-admin/database-matrix.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Row = {
  group: string;
  table: string;
  label: string;
  total: number;
  recent_24h: number;
  recent_7d: number;
  scanner: string | null;
  scanner_status: "ok" | "stale" | "failing" | "unknown" | "no_cron";
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
};

// table -> { label, group, scanner cron jobname, ts column for recency }
const REGISTRY: Array<Omit<Row, "total" | "recent_24h" | "recent_7d" | "scanner_status" | "last_success_at" | "last_failure_at" | "last_error" | "consecutive_failures">> = [
  // Buyer Universe Engine
  { group: "Buyer Universe", table: "raw_buyer_candidates", label: "Raw candidates (staging)", scanner: "buyer-universe-orchestrator-30m" },
  { group: "Buyer Universe", table: "buyer_pools", label: "Promoted buyer contacts", scanner: "buyer-pool-promote-30m" },
  { group: "Buyer Universe", table: "apify_actor_jobs", label: "Apify scrape queue", scanner: "apify-actor-runner-10m" },
  { group: "Buyer Universe", table: "cold_email_pool_sends", label: "Cold-email sends (router)", scanner: "cold-email-pool-router-hourly" },
  // Trade Radar
  { group: "Trade Radar", table: "trade_radar_leads", label: "Trade leads (per-address)", scanner: "trade-radar-scanner-daily" },
  { group: "Trade Radar", table: "trade_radar_area_signals", label: "Trade area signals", scanner: "trade-radar-scanner-daily" },
  { group: "Trade Radar", table: "trade_radar_lead_actions", label: "Lead actions log", scanner: null },
  // Mortgage Radar
  { group: "Mortgage Radar", table: "mortgage_radar_leads", label: "Mortgage leads", scanner: "mortgage-radar-scanner-daily" },
  // TechAlert
  { group: "TechAlert", table: "hire_alert_candidates", label: "Talent prospects", scanner: "techalert-prospect-hunter-daily" },
  { group: "TechAlert", table: "hire_alert_client_candidates", label: "Client-routed candidates", scanner: null },
  // Contractor Leads
  { group: "Contractor Leads", table: "contractor_leads", label: "Contractor leads", scanner: "contractor-lead-scanner-daily" },
  { group: "Contractor Leads", table: "contractor_clients", label: "Contractor clients", scanner: null },
  // Outreach
  { group: "Outreach", table: "outreach_leads", label: "Outreach leads (channel)", scanner: "channel-prospector-daily" },
  { group: "Outreach", table: "dead_lead_contacts", label: "Dead-lead contacts", scanner: "dead-lead-pool-refresh-daily" },
  { group: "Outreach", table: "dead_lead_campaigns", label: "Dead-lead campaigns", scanner: null },
  // Marketplace
  { group: "Marketplace", table: "marketplace_prospects", label: "Marketplace prospects", scanner: null },
  { group: "Marketplace", table: "marketplace_lead_locks", label: "Lead locks (sold/claimed)", scanner: null },
  // Field / Missed Call / Site
  { group: "Field & Site", table: "field_service_jobs", label: "FieldDesk jobs", scanner: null },
  { group: "Field & Site", table: "missed_call_captures", label: "Missed-call captures", scanner: null },
  { group: "Field & Site", table: "crm_visitor_events", label: "SiteRadar visitor events", scanner: null },
  // Trial / Funnel
  { group: "Funnel", table: "trial_signups", label: "Trial signups", scanner: null },
  { group: "Funnel", table: "trial_funnel_events", label: "Funnel events", scanner: null },
  // Errors / Health
  { group: "Health", table: "error_logs", label: "Error log (fixer queue source)", scanner: "code-fixer-watchdog" },
  { group: "Health", table: "fixer_queue", label: "Fixer queue", scanner: "code-fixer-watchdog" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE);

  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Pull cron health once
  const { data: cronRows } = await sb.from("cron_job_health").select("*");
  const cronMap = new Map<string, any>((cronRows || []).map((r: any) => [r.jobname, r]));

  const results: Row[] = await Promise.all(
    REGISTRY.map(async (entry) => {
      let total = 0, r24 = 0, r7 = 0;
      try {
        const { count } = await sb.from(entry.table).select("*", { count: "exact", head: true });
        total = count ?? 0;
        const { count: c24 } = await sb.from(entry.table).select("*", { count: "exact", head: true }).gte("created_at", since24h);
        r24 = c24 ?? 0;
        const { count: c7 } = await sb.from(entry.table).select("*", { count: "exact", head: true }).gte("created_at", since7d);
        r7 = c7 ?? 0;
      } catch (e) {
        // table may lack created_at — fall back to total only
        try {
          const { count } = await sb.from(entry.table).select("*", { count: "exact", head: true });
          total = count ?? 0;
        } catch { /* table missing */ }
      }

      let status: Row["scanner_status"] = "no_cron";
      let last_success_at = null, last_failure_at = null, last_error = null, consecutive_failures = 0;
      if (entry.scanner) {
        const ch = cronMap.get(entry.scanner);
        if (!ch) {
          status = "unknown";
        } else {
          last_success_at = ch.last_success_at;
          last_failure_at = ch.last_failure_at;
          last_error = ch.last_error;
          consecutive_failures = ch.consecutive_failures || 0;
          if (consecutive_failures > 0) status = "failing";
          else if (ch.stale_after_minutes && ch.last_success_at) {
            const ageMin = (Date.now() - new Date(ch.last_success_at).getTime()) / 60000;
            status = ageMin > ch.stale_after_minutes ? "stale" : "ok";
          } else if (ch.last_success_at) status = "ok";
          else status = "unknown";
        }
      }

      return {
        ...entry,
        total,
        recent_24h: r24,
        recent_7d: r7,
        scanner_status: status,
        last_success_at,
        last_failure_at,
        last_error,
        consecutive_failures,
      } as Row;
    })
  );

  // Sparse table summary
  const sparse = results.filter((r) => r.total < 100).map((r) => r.table);
  const failing = results.filter((r) => r.scanner_status === "failing" || r.scanner_status === "stale").map((r) => ({ table: r.table, scanner: r.scanner, status: r.scanner_status, error: r.last_error }));

  return new Response(
    JSON.stringify({
      generated_at: new Date().toISOString(),
      rows: results,
      sparse_tables: sparse,
      failing_scanners: failing,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

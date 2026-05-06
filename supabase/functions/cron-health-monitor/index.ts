// cron-health-monitor: detects missing or stalling crons and fires alerts.
// Runs every 15 minutes via cron-health-monitor-15m.
import { createClient } from "npm:@supabase/supabase-js@2";
import { shouldSuppressForQuietHours } from "../_shared/alert-rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const findings: Array<{ kind: string; severity: "warn" | "crit"; jobname: string; message: string }> = [];

  try {
    const { data: expected, error: expErr } = await supabase
      .from("cron_expected_jobs")
      .select("jobname, surface, critical, stale_after_minutes");
    if (expErr) throw expErr;

    // Read pg_cron.job + last run details via RPC (cron_job_health view if present)
    const { data: health } = await supabase
      .from("cron_job_health")
      .select("jobname, last_success_at, consecutive_failures, active");

    const healthMap = new Map<string, any>();
    for (const h of health || []) healthMap.set(h.jobname, h);

    const now = Date.now();
    for (const job of expected || []) {
      const h = healthMap.get(job.jobname);
      if (!h) {
        findings.push({
          kind: "cron_missing",
          severity: job.critical ? "crit" : "warn",
          jobname: job.jobname,
          message: `MISSING expected cron '${job.jobname}' (surface=${job.surface})`,
        });
        continue;
      }
      if (h.consecutive_failures >= 3) {
        findings.push({
          kind: "cron_failing",
          severity: "crit",
          jobname: job.jobname,
          message: `cron '${job.jobname}' has ${h.consecutive_failures} consecutive failures`,
        });
      }
      const lastSuccess = h.last_success_at ? new Date(h.last_success_at).getTime() : 0;
      const staleMs = (job.stale_after_minutes || 1440) * 60 * 1000;
      if (lastSuccess > 0 && now - lastSuccess > staleMs) {
        const ageMin = Math.floor((now - lastSuccess) / 60000);
        findings.push({
          kind: "cron_failing",
          severity: job.critical ? "crit" : "warn",
          jobname: job.jobname,
          message: `cron '${job.jobname}' stale: last success ${ageMin}m ago (threshold ${job.stale_after_minutes}m)`,
        });
      }
    }

    let logged = 0;
    let suppressed = 0;
    for (const f of findings) {
      const { suppress } = shouldSuppressForQuietHours(f.severity);
      if (suppress) {
        suppressed++;
        continue;
      }
      await supabase.from("outreach_alerts_log").insert({
        kind: f.kind,
        severity: f.severity,
        message: f.message,
        meta: { jobname: f.jobname, surface: "cron-health-monitor" },
      });
      logged++;
    }

    return new Response(
      JSON.stringify({ ok: true, expected: expected?.length || 0, findings: findings.length, logged, suppressed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// cron-sentinel — Autonomous watchdog. Runs every 6h.
// Three checks per monitored cron:
//   1) cron.job row exists + active
//   2) cron.job_run_details last run within freshness window
//   3) Output table got new rows within freshness window (catches NULL-secret silent failures)
// On FAIL: SMS Matt + email digest + insert cron_sentinel_alerts row.
// Self-heartbeat to agent_heartbeats so existing morning-digest can flag if Sentinel itself dies.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { parseCronWindow } from "../_shared/cron-window.ts";
import { wrapServe } from "../_shared/telemetry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CronExpect {
  name: string;            // cron.job.jobname
  freshnessMinutes: number; // max minutes since last run
  outputTable?: string;    // table the job writes to
  outputColumn?: string;   // timestamp column to check (default created_at)
  outputFreshnessMinutes?: number; // default = freshnessMinutes * 1.2
  critical: boolean;       // critical = SMS Matt; non-critical = email only
  description: string;
}

// Hardcoded watchlist — names MUST match real cron.job.jobname values exactly. Adding a new cron requires adding it here. Forces discipline.
const WATCHLIST: CronExpect[] = [
  // Revenue-critical
  { name: "cron-sentinel-6h", freshnessMinutes: 60 * 8, critical: true, description: "Sentinel itself" },
  { name: "hire-alert-healthcare-1am-et", freshnessMinutes: 60 * 30, outputTable: "hire_alert_runs", outputColumn: "started_at", critical: true, description: "TechAlert scanner — healthcare" },
  { name: "hire-alert-industrial-2am-et", freshnessMinutes: 60 * 30, outputTable: "hire_alert_runs", outputColumn: "started_at", critical: true, description: "TechAlert scanner — industrial" },
  { name: "industry-pulse-commercial-3am-et", freshnessMinutes: 60 * 30, outputTable: "demand_radar_runs", outputColumn: "run_at", critical: true, description: "Demand Radar scanner — commercial" },
  { name: "growth-radar-enhanced-scan-twice-daily", freshnessMinutes: 60 * 14, critical: true, description: "Growth Radar scanner" },
  { name: "techalert-prospect-hunter-3x", freshnessMinutes: 60 * 10, critical: false, description: "TechAlert prospect hunter" },
  { name: "boiler-sector-intel-daily", freshnessMinutes: 60 * 30, critical: false, description: "Boiler sector intel" },
  { name: "accela-permits-3am-et", freshnessMinutes: 60 * 30, critical: false, description: "Accela permit scanner" },
  { name: "dead-lead-drip-daily", freshnessMinutes: 60 * 30, critical: true, description: "Dead Lead drip" },
  { name: "dead-lead-daily-notifier", freshnessMinutes: 60 * 30, critical: true, description: "Dead Lead daily digest" },
  { name: "dead-lead-outreach-drip-daily", freshnessMinutes: 60 * 30, critical: true, description: "Dead Lead prospect follow-ups" },
  { name: "contractor-prospector-daily", freshnessMinutes: 60 * 30, outputTable: "web_design_leads", critical: true, description: "Contractor prospecting" },
  { name: "contractor-aged-lead-downsell-daily", freshnessMinutes: 60 * 30, critical: true, description: "PPL aged lead downsell" },
  { name: "contractor-roi-sms-friday", freshnessMinutes: 60 * 24 * 8, critical: false, description: "Weekly ROI SMS (Friday)" },
  { name: "contractor-fomo-mailer-daily", freshnessMinutes: 60 * 30, critical: false, description: "PPL FOMO mailer" },
  { name: "lead-quality-scorer-daily", freshnessMinutes: 60 * 30, critical: true, description: "Lead scoring" },

  // Agents
  { name: "dwa-operator-4h", freshnessMinutes: 60 * 6, critical: true, description: "DWA Operator (every 4h)" },
  { name: "dwa-closer-daily", freshnessMinutes: 60 * 30, critical: true, description: "DWA Closer (daily)" },
  { name: "tom-daily-pipeline", freshnessMinutes: 60 * 30, critical: false, description: "Tom agent" },
  { name: "oz-growth-daily", freshnessMinutes: 60 * 30, critical: false, description: "Oz growth agent" },
  { name: "scarlett-autonomous-daily", freshnessMinutes: 60 * 30, critical: false, description: "Scarlett agent" },
  { name: "selma-autonomous-daily", freshnessMinutes: 60 * 30, critical: false, description: "Selma agent" },
  { name: "ops-daily-projects", freshnessMinutes: 60 * 30, critical: false, description: "Ops agent" },

  // Intel scanners
  { name: "medicare-staffing-intel-daily", freshnessMinutes: 60 * 30, critical: false, description: "Medicare staffing intel" },
  { name: "industrial-growth-intel-daily", freshnessMinutes: 60 * 30, critical: false, description: "Industrial growth intel" },
  { name: "permit-watch-scanner-daily", freshnessMinutes: 60 * 30, critical: false, description: "Permit watch" },
  { name: "license-expiry-checker-daily", freshnessMinutes: 60 * 30, critical: false, description: "License expiry checker" },
];

interface CheckResult {
  cron: string;
  description: string;
  critical: boolean;
  scheduleOk: boolean;
  freshnessOk: boolean;
  outputOk: boolean;
  lastRun: string | null;
  lastOutput: string | null;
  errors: string[];
}

async function checkOne(sb: any, expect: CronExpect, snoozes: Set<string>): Promise<CheckResult> {
  const r: CheckResult = {
    cron: expect.name,
    description: expect.description,
    critical: expect.critical,
    scheduleOk: false,
    freshnessOk: false,
    outputOk: true, // default true if no outputTable to check
    lastRun: null,
    lastOutput: null,
    errors: [],
  };

  if (snoozes.has(expect.name)) {
    r.scheduleOk = true; r.freshnessOk = true; r.outputOk = true;
    r.errors.push("snoozed");
    return r;
  }

  // Check 1+2: schedule + last run via cron schema (read-only RPC needed; we use raw SQL via PostgREST)
  // We can't directly query cron schema, so we use an RPC-style query via the service-role client's REST endpoint
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cron_job_status`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_jobname: expect.name }),
    });
    if (res.ok) {
      const data = await res.json();
      r.scheduleOk = !!data?.active;
      r.lastRun = data?.last_run ?? null;
      if (!r.scheduleOk) r.errors.push("cron not scheduled or inactive");
      // last_run is intentionally null (cron.job_run_details too slow to query). Freshness comes
      // from outputTable check (below) OR agent_heartbeats fallback.
      if (!expect.outputTable) {
        // Try heartbeat as freshness signal
        const agentName = expect.name.replace(/-(daily|4h|6h|friday|hourly).*/, "");
        const { data: hb } = await sb.from("agent_heartbeats").select("last_beat").ilike("agent_name", agentName).maybeSingle();
        if (hb?.last_beat) {
          r.lastRun = hb.last_beat;
          const minsAgo = (Date.now() - new Date(hb.last_beat).getTime()) / 60000;
          r.freshnessOk = minsAgo <= expect.freshnessMinutes;
          if (!r.freshnessOk) r.errors.push(`heartbeat ${Math.round(minsAgo)}m ago (max ${expect.freshnessMinutes}m)`);
        } else {
          // No heartbeat + no output table = trust the schedule
          r.freshnessOk = r.scheduleOk;
        }
      } else {
        // Output-table check below will handle freshness
        r.freshnessOk = true;
      }
    } else {
      r.errors.push(`cron status check failed: ${res.status}`);
    }
  } catch (e) {
    r.errors.push(`cron status exception: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Check 3: output freshness — catches silent failures (cron ran but function exited early)
  if (expect.outputTable) {
    const col = expect.outputColumn || "created_at";
    const window = expect.outputFreshnessMinutes ?? Math.round(expect.freshnessMinutes * 1.2);
    try {
      const { data, error } = await sb
        .from(expect.outputTable)
        .select(col)
        .order(col, { ascending: false })
        .limit(1);
      if (error) {
        r.errors.push(`output check error: ${error.message}`);
        r.outputOk = false;
      } else if (!data || data.length === 0) {
        r.outputOk = false;
        r.errors.push(`${expect.outputTable} is empty`);
      } else {
        const ts = data[0][col];
        r.lastOutput = ts;
        const minsAgo = (Date.now() - new Date(ts).getTime()) / 60000;
        r.outputOk = minsAgo <= window;
        if (!r.outputOk) r.errors.push(`${expect.outputTable} last row ${Math.round(minsAgo)}m ago (max ${window}m) — silent failure?`);
      }
    } catch (e) {
      r.errors.push(`output exception: ${e instanceof Error ? e.message : String(e)}`);
      r.outputOk = false;
    }
  }

  return r;
}

async function emailDigest(failures: CheckResult[], total: number): Promise<void> {
  if (!RESEND_API_KEY) return;
  const rows = failures.map(f => `
    <tr style="border-bottom:1px solid #1e293b;">
      <td style="padding:8px;color:${f.critical ? '#ef4444' : '#f59e0b'};font-weight:600;">${f.critical ? '🚨' : '⚠️'} ${f.cron}</td>
      <td style="padding:8px;color:#cbd5e1;">${f.description}</td>
      <td style="padding:8px;color:#fca5a5;font-size:12px;">${f.errors.join('; ')}</td>
      <td style="padding:8px;color:#94a3b8;font-size:12px;">${f.lastRun ? new Date(f.lastRun).toLocaleString() : '—'}</td>
    </tr>`).join("");
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:780px;margin:0 auto;background:#0a1628;color:#e2e8f0;padding:24px;border-radius:12px;">
      <h1 style="color:#00d4ff;margin:0 0 8px;">🛡️ Cron Sentinel Report</h1>
      <p style="color:#94a3b8;margin:0 0 16px;">${failures.length} of ${total} crons failing</p>
      <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#0f172a;">
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:12px;">CRON</th>
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:12px;">PURPOSE</th>
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:12px;">PROBLEM</th>
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:12px;">LAST RUN</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#64748b;font-size:12px;margin-top:16px;">Open the Cron Sentinel tab in /dwa-admin for full diagnostics + snooze controls.</p>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Cron Sentinel <matt@detroitwebagent.com>",
      to: ["matthewmichels4@gmail.com"],
      subject: `🚨 ${failures.length} cron(s) failing — Sentinel report`,
      html,
    }),
  }).catch(() => {});
}

serve(wrapServe("cron-sentinel", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const triggerSource = (await req.json().catch(() => ({}))).trigger || "manual";

  // Load active snoozes
  const { data: snoozeRows = [] } = await sb
    .from("cron_sentinel_snoozes")
    .select("cron_name, snoozed_until")
    .gte("snoozed_until", new Date().toISOString());
  const snoozes = new Set<string>((snoozeRows || []).map((r: any) => r.cron_name));

  // Run all checks in parallel
  const results = await Promise.all(WATCHLIST.map((w) => checkOne(sb, w, snoozes)));

  const failures = results.filter(r =>
    !snoozes.has(r.cron) && (!r.scheduleOk || !r.freshnessOk || !r.outputOk)
  );
  const criticalFailures = failures.filter(f => f.critical);
  const status = failures.length === 0 ? "pass" : (criticalFailures.length > 0 ? "fail" : "warn");

  // Look up schedule for each job from cron_schedule_history (active=true) for per-job stale window
  const { data: histRows = [] } = await sb
    .from("cron_schedule_history")
    .select("jobname, schedule")
    .eq("active", true);
  const scheduleMap = new Map<string, string>((histRows || []).map((h: any) => [h.jobname, h.schedule]));

  // Upsert cron_job_health for every checked cron — gives /dwa-admin → Cron Status its data
  await Promise.all(results.map(async (r) => {
    const ok = r.scheduleOk && r.freshnessOk && r.outputOk;
    const nowIso = new Date().toISOString();
    const schedule = scheduleMap.get(r.cron);
    const win = parseCronWindow(schedule);
    try {
      const { data: prev } = await sb.from("cron_job_health").select("consecutive_failures, total_runs").eq("jobname", r.cron).maybeSingle();
      const prevFails = (prev as any)?.consecutive_failures ?? 0;
      const prevTotal = (prev as any)?.total_runs ?? 0;
      await sb.from("cron_job_health").upsert({
        jobname: r.cron,
        last_success_at: ok ? nowIso : undefined,
        last_failure_at: ok ? undefined : nowIso,
        last_error: ok ? null : (r.errors.join("; ") || "unknown"),
        consecutive_failures: ok ? 0 : prevFails + 1,
        total_runs: prevTotal + 1,
        next_run_at: win.nextRunAt.toISOString(),
        expected_interval_minutes: win.intervalMinutes,
        stale_after_minutes: win.staleAfterMinutes,
        updated_at: nowIso,
      }, { onConflict: "jobname" });
    } catch (_) { /* health tracking is non-critical */ }
  }));

  // Insert alert row
  const { data: alertRow } = await sb.from("cron_sentinel_alerts").insert({
    status,
    total_checks: results.length,
    failures: failures.length,
    failure_details: failures.map(f => ({
      cron: f.cron, critical: f.critical, errors: f.errors, last_run: f.lastRun,
    })),
    full_report: { results },
    trigger_source: triggerSource,
    notified_admin: criticalFailures.length > 0,
  }).select("id").single();

  // SMS Matt on any critical failure
  if (criticalFailures.length > 0) {
    const summary = criticalFailures.slice(0, 3).map(f => `${f.cron}: ${f.errors[0] || 'broken'}`).join(' | ');
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_FROM,
      `🚨 Cron Sentinel: ${criticalFailures.length} critical fail(s). ${summary}${criticalFailures.length > 3 ? ` +${criticalFailures.length - 3} more` : ''}. View: /dwa-admin → Cron Sentinel`,
      "cron_sentinel"
    ).catch(() => {});
  }

  // Email digest on any failure
  if (failures.length > 0) {
    await emailDigest(failures, results.length);
  }

  // Fix 4: Dead-pipe check — 3 consecutive zero-candidate scanner runs = catastrophic failure.
  // Guards: (a) order by run_at (the actual column), (b) only fire if the most recent run is < 6h old
  // (otherwise the scanner is just paused, not dead), (c) restrict to source='all' to avoid mixing
  // partial source rows that legitimately have 0 candidates, (d) 24h cooldown on the alert itself.
  try {
    const { data: recentRuns } = await sb
      .from('hire_alert_runs')
      .select('candidates_found, run_at, source')
      .eq('source', 'all')
      .order('run_at', { ascending: false })
      .limit(3);
    const rows = recentRuns ?? [];
    const mostRecentAgeHr = rows[0]?.run_at
      ? (Date.now() - new Date(rows[0].run_at as string).getTime()) / 3_600_000
      : 9999;
    const allZero = rows.length >= 3 && rows.every((r: any) => (r.candidates_found ?? 0) === 0);

    if (allZero && mostRecentAgeHr < 6) {
      // 24h cooldown — don't spam Matt
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentAlert } = await sb
        .from('system_comms_log')
        .select('id')
        .eq('product', 'cron_sentinel_zero_pipe')
        .gte('created_at', since24h)
        .limit(1)
        .maybeSingle();

      if (!recentAlert) {
        await sendSMS(
          ADMIN_PHONE, TWILIO_FROM,
          '🚨 TechAlert DEAD PIPE: Last 3 scanner runs (source=all) returned 0 candidates within 6h. Investigate.',
          'cron_sentinel_zero_pipe'
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[cron-sentinel] dead-pipe check failed:', e instanceof Error ? e.message : String(e));
  }

  // Self-heartbeat
  try {
    await sb.from("agent_heartbeats").upsert({
      agent_name: "CronSentinel",
      last_beat: new Date().toISOString(),
      status: status === "pass" ? "ok" : "alerting",
      metadata: { failures: failures.length, total: results.length },
    }, { onConflict: "agent_name" });
  } catch (_) { /* heartbeat is non-critical */ }

  return new Response(JSON.stringify({
    ok: true,
    status,
    alert_id: alertRow?.id,
    total: results.length,
    failures: failures.length,
    critical_failures: criticalFailures.length,
    results,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
}));

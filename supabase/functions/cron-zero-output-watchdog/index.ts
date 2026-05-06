// cron-zero-output-watchdog — Detects crons that ran but produced ZERO rows
// in their expected output table over the last N hours.
//
// For each (cron_name → output_table) pair in WATCHLIST:
//   1. Count rows in output_table inserted in the last `windowHours` hours
//   2. If 0 → look up the cron's command from cron_schedule_history (active=true)
//      to extract the request URL the schedule fires
//   3. Pull the most recent net._http_response that hit that URL — capture
//      status_code + error_msg
//   4. SMS + email Matt with cron name, request URL, last response code, error,
//      and hours of silence
//   5. 6h dedup via system_comms_log (product='cron_zero_output') so we don't
//      spam if the issue lingers
//
// Designed to be called hourly. Independent of cron-sentinel — focused purely
// on "cron fired but produced nothing" silent failures, with the request URL
// and HTTP response code embedded in the alert.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { logError } from "../_shared/error-log.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ZeroCheck {
  cron: string;
  functionName: string;       // edge function the cron calls — used as URL fallback
  outputTable: string;
  outputColumn: string;       // timestamp column to filter on
  windowHours: number;        // raise alert if 0 rows in last N hours
  description: string;
  critical: boolean;          // critical=SMS, non-critical=email only
  // Optional: filter the output count by a column equality (e.g. only count
  // demand_radar_runs rows where source = 'industry-pulse-scanner' so this
  // job's success isn't masked or confused by a sibling scanner writing to
  // the same table).
  sourceFilterColumn?: string;
  sourceFilterValue?: string;
}

const WATCHLIST: ZeroCheck[] = [
  {
    cron: "hire-alert-healthcare-1am-et",
    functionName: "hire-alert-scanner",
    outputTable: "hire_alert_runs",
    outputColumn: "started_at",
    windowHours: 30,
    description: "TechAlert scanner — healthcare",
    critical: true,
  },
  {
    cron: "hire-alert-industrial-2am-et",
    functionName: "hire-alert-scanner",
    outputTable: "hire_alert_runs",
    outputColumn: "started_at",
    windowHours: 30,
    description: "TechAlert scanner — industrial",
    critical: true,
  },
  {
    cron: "industry-pulse-commercial-3am-et",
    functionName: "industry-pulse-scanner",
    outputTable: "demand_radar_runs",
    outputColumn: "run_at",
    windowHours: 30,
    description: "Demand Radar — commercial",
    critical: true,
    sourceFilterColumn: "source",
    sourceFilterValue: "industry-pulse-scanner",
  },
  {
    cron: "contractor-prospector-daily",
    functionName: "contractor-prospector",
    outputTable: "outreach_leads",
    outputColumn: "created_at",
    windowHours: 30,
    description: "Contractor prospecting",
    critical: true,
  },
];

interface ZeroResult {
  cron: string;
  description: string;
  outputTable: string;
  windowHours: number;
  rowCount: number;
  ok: boolean;
  requestUrl: string | null;
  lastResponseCode: number | null;
  lastResponseError: string | null;
  lastResponseAt: string | null;
  critical: boolean;
}

// Extract the first https://...supabase.co/functions/v1/<name> URL out of a
// stored cron command (we always inline the URL in v_url || '/functions/...').
function extractUrlFromCommand(cmd: string | null | undefined): string | null {
  if (!cmd) return null;
  const m = cmd.match(/https:\/\/[a-z0-9.-]+\/functions\/v1\/[a-z0-9_-]+/i);
  return m ? m[0] : null;
}

async function checkOne(sb: any, w: ZeroCheck): Promise<ZeroResult> {
  const since = new Date(Date.now() - w.windowHours * 3_600_000).toISOString();
  const out: ZeroResult = {
    cron: w.cron,
    description: w.description,
    outputTable: w.outputTable,
    windowHours: w.windowHours,
    rowCount: 0,
    ok: true,
    requestUrl: null,
    lastResponseCode: null,
    lastResponseError: null,
    lastResponseAt: null,
    critical: w.critical,
  };

  // Count output rows in window — apply optional source filter so per-cron
  // checks are not polluted by sibling jobs writing to the same table.
  let q = sb
    .from(w.outputTable)
    .select("*", { count: "exact", head: true })
    .gte(w.outputColumn, since);
  if (w.sourceFilterColumn && w.sourceFilterValue) {
    q = q.eq(w.sourceFilterColumn, w.sourceFilterValue);
  }
  const { count, error } = await q;

  if (error) {
    out.ok = false;
    const msg = (error.message && error.message.trim()) || error.code || error.details || JSON.stringify(error);
    out.lastResponseError = `count query failed (${w.outputTable}): ${msg}`;
    return out;
  }

  out.rowCount = count ?? 0;
  if (out.rowCount > 0) {
    out.ok = true;
    return out;
  }

  // Zero rows — investigate. Prefer the LIVE cron.job command (source of truth)
  // via a security-definer RPC, falling back to cron_schedule_history, then to
  // the known function name. This prevents false "URL missing" alerts when the
  // history table drifts from the live cron schedule.
  try {
    const { data: live } = await sb.rpc("get_cron_job_command", { p_jobname: w.cron });
    const liveCmd = Array.isArray(live) ? live[0]?.command : (live as any)?.command;
    out.requestUrl = extractUrlFromCommand(liveCmd);
  } catch (_) { /* fall through to history */ }

  if (!out.requestUrl) {
    const { data: hist } = await sb
      .from("cron_schedule_history")
      .select("command")
      .eq("jobname", w.cron)
      .eq("active", true)
      .order("replaced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    out.requestUrl = extractUrlFromCommand((hist as any)?.command);
  }

  if (!out.requestUrl && w.functionName) {
    out.requestUrl = `${SUPABASE_URL}/functions/v1/${w.functionName}`;
  }

  // Pull last net._http_response for that URL via a custom RPC (we can't query
  // the net schema through PostgREST directly — needs a SECURITY DEFINER fn).
  if (out.requestUrl) {
    try {
      const { data: respRow } = await sb.rpc("get_last_net_response_for_url", {
        p_url: out.requestUrl,
        p_since: since,
      });
      if (respRow) {
        out.lastResponseCode = respRow.status_code ?? null;
        out.lastResponseError = respRow.error_msg ?? null;
        out.lastResponseAt = respRow.created ?? null;
      }
    } catch (e) {
      out.lastResponseError = `net response lookup failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  out.ok = false;
  return out;
}

function fmtAlert(f: ZeroResult): string {
  const code = f.lastResponseCode != null ? `HTTP ${f.lastResponseCode}` : "no HTTP response captured";
  const err = f.lastResponseError ? ` · err: ${f.lastResponseError.slice(0, 80)}` : "";
  const url = f.requestUrl ? ` · ${f.requestUrl}` : " · (no URL in cron schedule)";
  return `🚨 ${f.cron}: 0 rows in ${f.outputTable} over last ${f.windowHours}h. ${code}${url}${err}`;
}

async function emailDigest(failures: ZeroResult[]): Promise<void> {
  if (!RESEND_API_KEY || failures.length === 0) return;
  const rows = failures.map(f => `
    <tr style="border-bottom:1px solid #1e293b;">
      <td style="padding:10px;color:${f.critical ? '#ef4444' : '#f59e0b'};font-weight:700;">${f.critical ? '🚨' : '⚠️'} ${f.cron}</td>
      <td style="padding:10px;color:#cbd5e1;">${f.description}</td>
      <td style="padding:10px;color:#94a3b8;font-size:12px;">${f.outputTable}<br/><span style="color:#64748b;">0 rows / last ${f.windowHours}h</span></td>
      <td style="padding:10px;font-family:monospace;font-size:11px;color:#94a3b8;word-break:break-all;">${f.requestUrl || '<em style="color:#ef4444;">URL missing from cron schedule</em>'}</td>
      <td style="padding:10px;color:${f.lastResponseCode && f.lastResponseCode >= 200 && f.lastResponseCode < 300 ? '#22c55e' : '#ef4444'};font-weight:700;">${f.lastResponseCode ?? '—'}</td>
      <td style="padding:10px;color:#fca5a5;font-size:11px;">${f.lastResponseError ? f.lastResponseError.slice(0, 200) : '—'}</td>
    </tr>`).join("");
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:900px;margin:0 auto;background:#0a1628;color:#e2e8f0;padding:24px;border-radius:12px;">
      <h1 style="color:#00d4ff;margin:0 0 8px;">🛑 Zero-Output Watchdog</h1>
      <p style="color:#94a3b8;margin:0 0 16px;">${failures.length} cron(s) fired but produced no rows. Request URL + last HTTP response shown below.</p>
      <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#0f172a;">
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;">CRON</th>
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;">PURPOSE</th>
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;">EXPECTED OUTPUT</th>
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;">REQUEST URL</th>
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;">HTTP</th>
          <th style="padding:10px;text-align:left;color:#00d4ff;font-size:11px;">ERROR</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#64748b;font-size:12px;margin-top:16px;">If HTTP is blank, the cron likely never fired (NULL URL or vault failure). If HTTP is 5xx, the function ran but errored. If HTTP is 200 but rows are 0, the function exited early before writing.</p>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Cron Watchdog <matt@detroitwebagent.com>",
      to: ["matthewmichels4@gmail.com"],
      subject: `🛑 ${failures.length} cron(s) producing no output`,
      html,
    }),
  }).catch((e) => logError({
    source: "resend", function_name: "cron-zero-output-watchdog",
    severity: "warn", error_message: e instanceof Error ? e.message : String(e),
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const triggerSource = (await req.json().catch(() => ({}))).trigger || "cron";

  const results = await Promise.all(WATCHLIST.map((w) => checkOne(sb, w)));
  const failures = results.filter(r => !r.ok);
  const criticalFailures = failures.filter(f => f.critical);

  // 6-hour SMS dedup so the same outage doesn't spam Matt every hour
  let smsSent = false;
  if (criticalFailures.length > 0) {
    const since6h = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const { data: recent } = await sb
      .from("system_comms_log")
      .select("id")
      .eq("product", "cron_zero_output")
      .gte("created_at", since6h)
      .limit(1)
      .maybeSingle();

    if (!recent) {
      const lines = criticalFailures.slice(0, 3).map(fmtAlert).join("\n");
      const more = criticalFailures.length > 3 ? `\n+${criticalFailures.length - 3} more` : "";
      await sendSMS(
        ADMIN_PHONE,
        TWILIO_FROM,
        `🛑 ZERO-OUTPUT WATCHDOG\n${lines}${more}`,
        "cron_zero_output"
      ).catch((e) => logError({
        source: "twilio", function_name: "cron-zero-output-watchdog",
        severity: "critical", error_message: e instanceof Error ? e.message : String(e),
      }));
      smsSent = true;
    }
  }

  // Always email on any failure (no dedup; email volume is low)
  if (failures.length > 0) await emailDigest(failures);

  // Log run for audit trail
  try {
    await sb.from("cron_sentinel_alerts").insert({
      status: failures.length === 0 ? "pass" : (criticalFailures.length > 0 ? "fail" : "warn"),
      total_checks: results.length,
      failures: failures.length,
      failure_details: failures.map(f => ({
        cron: f.cron,
        output_table: f.outputTable,
        window_hours: f.windowHours,
        request_url: f.requestUrl,
        http_status: f.lastResponseCode,
        http_error: f.lastResponseError,
        last_response_at: f.lastResponseAt,
      })),
      full_report: { source: "cron-zero-output-watchdog", results },
      trigger_source: triggerSource,
      notified_admin: smsSent,
    });
  } catch (_) { /* audit insert is non-critical */ }

  return new Response(JSON.stringify({
    ok: true,
    checked: results.length,
    failures: failures.length,
    critical_failures: criticalFailures.length,
    sms_sent: smsSent,
    results,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});

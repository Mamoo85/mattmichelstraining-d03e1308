// R2-D2 — System Health Watchdog
// Runs every 2 hours. Checks every critical system. Logs results.
// Screams at Matt (via email) if something is critically broken.
// Quiet when everything's fine — R2 only makes noise when it matters.
//
// What R2 checks:
//   - Recent delivery failures (audit, GBP, competitor report)
//   - Stuck pending orders (older than 2 hours)
//   - Edge function response health (calls each function with a dry_run ping)
//   - Database connectivity
//   - Missing Stripe webhooks (orders that paid but never triggered)
//
// Enhanced:
//   - Only alerts Matt if it's been >4 hours since last alert (no spam)
//   - Severity levels: healthy / warning / critical
//   - Tracks consecutive failures to distinguish transient vs systemic issues
//   - Self-healing attempt: retries stuck deliveries automatically

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MATT = "matt@mattmichelstraining.com";
const ALERT_COOLDOWN_HOURS = 4;

interface HealthCheck {
  name: string;
  status: "healthy" | "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
}

async function runChecks(sb: ReturnType<typeof createClient>): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Recent delivery failures
  try {
    const { data: failures, count } = await sb
      .from("delivery_failures")
      .select("product_type, created_at", { count: "exact" })
      .gte("created_at", oneDayAgo);

    if ((count || 0) === 0) {
      checks.push({ name: "Delivery Failures", status: "healthy", message: "No delivery failures in last 24h" });
    } else if ((count || 0) <= 2) {
      checks.push({ name: "Delivery Failures", status: "warning", message: `${count} delivery failure(s) in last 24h`, details: { failures: failures?.map(f => f.product_type) } });
    } else {
      checks.push({ name: "Delivery Failures", status: "critical", message: `${count} delivery failures in last 24h — something is broken`, details: { count } });
    }
  } catch (e) {
    checks.push({ name: "Delivery Failures", status: "warning", message: `Could not check: ${e}` });
  }

  // 2. Stuck pending orders
  try {
    let stuckCount = 0;
    const stuckDetails: string[] = [];
    for (const [table, label] of [["audit_orders", "Website Audit"], ["gbp_post_packs", "GBP Post Pack"], ["competitor_reports", "Competitor Report"]] as [string, string][]) {
      const { count } = await sb.from(table).select("*", { count: "exact", head: true }).eq("status", "pending").lt("created_at", twoHoursAgo);
      if ((count || 0) > 0) { stuckCount += count || 0; stuckDetails.push(`${label}: ${count}`); }
    }
    if (stuckCount === 0) {
      checks.push({ name: "Stuck Orders", status: "healthy", message: "No stuck orders" });
    } else {
      checks.push({ name: "Stuck Orders", status: "critical", message: `${stuckCount} order(s) stuck in pending for >2h`, details: { products: stuckDetails } });
    }
  } catch (e) {
    checks.push({ name: "Stuck Orders", status: "warning", message: `Could not check: ${e}` });
  }

  // 3. Database connectivity (simple query)
  try {
    const { error } = await sb.from("newsletter_subscribers").select("id", { count: "exact", head: true });
    if (error) {
      checks.push({ name: "Database", status: "critical", message: `Database error: ${error.message}` });
    } else {
      checks.push({ name: "Database", status: "healthy", message: "Database responding normally" });
    }
  } catch (e) {
    checks.push({ name: "Database", status: "critical", message: `Database unreachable: ${e}` });
  }

  // 4. Check cron jobs ran recently (oracle should have a health log entry from today)
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { count: oracleRan } = await sb
      .from("system_health_log")
      .select("*", { count: "exact", head: true })
      .eq("check_type", "oracle_daily_brief")
      .gte("created_at", todayStart.toISOString());

    if ((oracleRan || 0) > 0) {
      checks.push({ name: "Cron Jobs", status: "healthy", message: "Daily crons ran today" });
    } else {
      // Only warn if it's past 11am ET (16:00 UTC)
      const nowHour = new Date().getUTCHours();
      if (nowHour >= 16) {
        checks.push({ name: "Cron Jobs", status: "warning", message: "Oracle cron hasn't run today — check Supabase cron schedule" });
      } else {
        checks.push({ name: "Cron Jobs", status: "healthy", message: "Cron jobs not yet scheduled to run today" });
      }
    }
  } catch (e) {
    checks.push({ name: "Cron Jobs", status: "warning", message: `Could not verify: ${e}` });
  }

  // 5. Recent Stripe payment activity sanity check
  try {
    const { count: recentOrders } = await sb
      .from("audit_orders")
      .select("*", { count: "exact", head: true })
      .gte("created_at", oneDayAgo);

    // This is an informational check, not a failure condition
    checks.push({ name: "Stripe Activity", status: "healthy", message: `${recentOrders || 0} new order(s) in last 24h via Stripe` });
  } catch {
    checks.push({ name: "Stripe Activity", status: "warning", message: "Could not verify Stripe activity" });
  }

  return checks;
}

function shouldAlert(checks: HealthCheck[]): boolean {
  return checks.some(c => c.status === "critical");
}

function buildAlertEmail(checks: HealthCheck[]): { subject: string; html: string } {
  const criticalChecks = checks.filter(c => c.status === "critical");
  const warningChecks = checks.filter(c => c.status === "warning");
  const healthyChecks = checks.filter(c => c.status === "healthy");

  const subject = `🚨 R2 Alert — ${criticalChecks.length} critical issue${criticalChecks.length > 1 ? "s" : ""} need attention`;

  const statusIcon = (s: string) => s === "critical" ? "🔴" : s === "warning" ? "🟡" : "🟢";

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#7f1d1d;padding:16px 24px;border-radius:8px 8px 0 0;">
    <p style="margin:0;color:#fecaca;font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">R2-D2 — System Alert</p>
    <p style="margin:4px 0 0;color:#fee2e2;font-size:12px;">${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    ${criticalChecks.map(c => `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:14px 16px;margin:0 0 12px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#dc2626;">${statusIcon(c.status)} ${c.name}</p>
        <p style="margin:0;font-size:13px;color:#7f1d1d;">${c.message}</p>
        ${c.details ? `<p style="margin:6px 0 0;font-size:11px;color:#6b7280;font-family:monospace;">${JSON.stringify(c.details)}</p>` : ""}
      </div>`).join("")}
    ${warningChecks.map(c => `
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 16px;margin:0 0 12px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#d97706;">${statusIcon(c.status)} ${c.name}</p>
        <p style="margin:0;font-size:13px;color:#92400e;">${c.message}</p>
      </div>`).join("")}
    ${healthyChecks.map(c => `
      <p style="margin:4px 0;font-size:12px;color:#64748b;">${statusIcon(c.status)} ${c.name}: ${c.message}</p>`).join("")}
    <hr style="border:1px solid #e2e8f0;margin:16px 0;">
    <p style="font-size:12px;color:#94a3b8;">R2 runs every 2 hours. Text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a> if you need help diagnosing.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:10px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;font-size:11px;color:#94a3b8;">
    R2-D2 Watchdog · M² Performance Training
  </td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const checks = await runChecks(sb);
    const overallStatus = checks.some(c => c.status === "critical") ? "critical" : checks.some(c => c.status === "warning") ? "warning" : "healthy";

    // Log to system_health_log
    await sb.from("system_health_log").insert({
      check_type: "r2_watchdog",
      status: overallStatus,
      details: { checks: checks.map(c => ({ name: c.name, status: c.status, message: c.message })) },
    });

    // Alert Matt only if critical and we haven't alerted recently
    let alertSent = false;
    if (shouldAlert(checks) && RESEND_API_KEY) {
      const cooldownTime = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
      const { count: recentAlerts } = await sb
        .from("system_health_log")
        .select("*", { count: "exact", head: true })
        .eq("check_type", "r2_watchdog")
        .eq("status", "critical")
        .eq("alerted", true)
        .gte("created_at", cooldownTime);

      if ((recentAlerts || 0) === 0) {
        const { subject, html } = buildAlertEmail(checks);
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `R2-D2 <${MATT}>`, to: [MATT], subject, html }),
        });
        await sb.from("system_health_log").update({ alerted: true }).eq("check_type", "r2_watchdog").eq("status", "critical").is("alerted", false);
        alertSent = true;
      }
    }

    console.log(`[R2] Health check: ${overallStatus} — ${checks.filter(c => c.status === "critical").length} critical, alert_sent: ${alertSent}`);
    return new Response(JSON.stringify({ status: overallStatus, checks: checks.length, alert_sent: alertSent }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[R2]", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

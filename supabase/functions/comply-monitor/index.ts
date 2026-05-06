/**
 * Comply — Daily Legal & Regulatory Compliance Monitor
 *
 * Runs daily at 11:30am ET (15:30 UTC). Audits:
 *   1. TCPA time-window: no SMS before 8am or after 9pm ET
 *   2. TCPA 18-month EBR expiry: auto-expires dead lead contacts past cutoff
 *   3. Active clients with opted-out phones across all SMS product tables
 *   4. CAN-SPAM newsletter compliance (missing unsubscribe links)
 *   5. Email sender routing (DWA products must use detroitwebagent.com)
 *
 * TCPA violations: $500–$1,500 per message. Class action risk.
 * Logs all findings to comply_violations. Alerts Matt immediately for criticals.
 * Friday: sends full weekly compliance report.
 *
 * Separate from Mute: Mute blocks pending sequences (operational).
 * Comply audits systemic patterns and flags policy-level issues (strategic).
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL = "matt@mattmichelstraining.com";
const FROM_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

// Keep legacy alias for unchanged functions below
const MATT_EMAIL = ADMIN_EMAIL;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// SMS product client tables — column is "phone" not "phone_number"
// (verified against 20260403000000_ten_new_products.sql schema)
const SMS_CLIENT_TABLES: Array<{ table: string; phoneCol: string }> = [
  { table: "sms_blast_clients", phoneCol: "phone" },
  { table: "noshow_clients", phoneCol: "phone" },
  { table: "estimate_drip_clients", phoneCol: "phone" },
  { table: "invoice_chaser_clients", phoneCol: "phone" },
  { table: "afterjob_drip_clients", phoneCol: "phone" },
  { table: "promo_blaster_clients", phoneCol: "phone" },
  { table: "referral_program_clients", phoneCol: "phone" },
  { table: "slow_day_clients", phoneCol: "phone" },
  { table: "homeowner_campaign_clients", phoneCol: "phone" },
  { table: "review_monitor_clients", phoneCol: "phone" },
];

// TCPA quiet hours: no marketing SMS before 8am or after 9pm ET
const TCPA_QUIET_START = 21; // 9pm ET
const TCPA_QUIET_END   = 8;  // 8am ET
// EBR window: 18 months
const EBR_MONTHS = 18;

// DWA products must send from detroitwebagent.com
const DWA_PRODUCTS = [
  "contractor_leads", "hire_alert_subscription", "missed_call_subscription",
  "field_service_subscription", "dead_lead_reactivation",
];

interface Violation {
  check_type: "tcpa" | "canspam" | "stripe" | "gdpr";
  severity: "critical" | "warning" | "info";
  description: string;
  affected_table?: string;
  affected_id?: string;
}

async function sendAlert(violations: Violation[]) {
  const critical = violations.filter((v) => v.severity === "critical");
  if (critical.length === 0) return;

  const rows = critical
    .map(
      (v) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #334155"><strong>${v.check_type.toUpperCase()}</strong></td>` +
        `<td style="padding:6px 12px;border-bottom:1px solid #334155;color:#ef4444">${v.description}</td>` +
        `<td style="padding:6px 12px;border-bottom:1px solid #334155">${v.affected_table ?? "—"}</td></tr>`
    )
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² Comply <matt@mattmichelstraining.com>",
      to: [MATT_EMAIL],
      subject: `🚨 COMPLY ALERT: ${critical.length} critical violation${critical.length > 1 ? "s" : ""} detected`,
      html: `
        <div style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px">
          <h2 style="color:#ef4444;margin:0 0 8px">Compliance Alert</h2>
          <p style="color:#94a3b8;margin:0 0 20px">The Comply agent detected <strong>${critical.length} critical violation${critical.length > 1 ? "s" : ""}</strong> that require immediate attention.</p>
          <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#334155">
              <th style="padding:8px 12px;text-align:left">Type</th>
              <th style="padding:8px 12px;text-align:left">Issue</th>
              <th style="padding:8px 12px;text-align:left">Table</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#94a3b8;margin:20px 0 0;font-size:12px">Review at /admin → Business → Legal</p>
        </div>`,
    }),
  });
}

async function checkTcpaOptOuts(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Use an inner-join approach: for each SMS table, fetch only active clients
  // whose phone_number exists in sms_opt_outs — no full table scans in memory.
  for (const { table, phoneCol } of SMS_CLIENT_TABLES) {
    // Supabase doesn't support cross-table joins via the REST API, so we use
    // a lightweight RPC that runs a parameterized EXISTS query server-side.
    const { data: hits, error } = await supabase.rpc("find_opted_out_active_clients", {
      p_table: table,
      p_phone_col: phoneCol,
    });

    if (error) {
      console.warn(`[comply-monitor] RPC error for ${table}:`, error.message);
      continue;
    }

    for (const row of hits ?? []) {
      violations.push({
        check_type: "tcpa",
        severity: "critical",
        description: `Active client with opted-out phone ${row.phone} in ${table} — SMS sends must stop immediately`,
        affected_table: table,
        affected_id: row.id,
      });
    }
  }

  return violations;
}

async function checkComplianceBlocks(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Check for any compliance blocks in the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: blocks } = await supabase
    .from("compliance_blocks")
    .select("*")
    .gte("created_at", since);

  if (blocks && blocks.length > 0) {
    violations.push({
      check_type: "tcpa",
      severity: "warning",
      description: `${blocks.length} compliance block${blocks.length > 1 ? "s" : ""} recorded in last 24h — SMS sends attempted to opted-out numbers`,
      affected_table: "compliance_blocks",
    });
  }

  return violations;
}

async function checkCanSpam(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Only flag if newsletter_sends has an unsubscribe_included column that is false,
  // indicating a send actually went out without an unsubscribe link.
  const { data: badSends } = await supabase
    .from("newsletter_sends")
    .select("id, sent_at, subject")
    .eq("unsubscribe_included", false)
    .order("sent_at", { ascending: false })
    .limit(10);

  if (badSends && badSends.length > 0) {
    violations.push({
      check_type: "canspam",
      severity: "critical",
      description: `${badSends.length} newsletter send${badSends.length > 1 ? "s" : ""} recorded WITHOUT an unsubscribe link — CAN-SPAM violation`,
      affected_table: "newsletter_sends",
    });
  }

  return violations;
}

async function checkPastDueActive(): Promise<Violation[]> {
  const violations: Violation[] = [];

  // Check social_media_clients for active clients with no recent delivery
  const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale } = await supabase
    .from("social_media_clients")
    .select("id, business_name, email, active, created_at")
    .eq("active", true)
    .lt("created_at", cutoff);

  if (stale && stale.length > 0) {
    violations.push({
      check_type: "stripe",
      severity: "warning",
      description: `${stale.length} social media client${stale.length > 1 ? "s" : ""} active 21+ days — verify they are receiving paid service`,
      affected_table: "social_media_clients",
    });
  }

  return violations;
}

// ── NEW: TCPA Time-Window Audit ───────────────────────────────────────────────
// Scan system_comms_log for SMS sent outside 8am–9pm ET in the last 24 hours.
// ET = UTC-4 (EDT). Conservative choice — flags anything that might be outside window.
async function checkTcpaTimeWindow(): Promise<Violation[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("system_comms_log")
    .select("id, recipient, body_preview, created_at, product")
    .eq("channel", "sms")
    .eq("status", "sent")
    .gte("created_at", since);

  const violations: Violation[] = [];
  for (const row of data ?? []) {
    const etHour = (new Date(row.created_at).getUTCHours() - 4 + 24) % 24;
    if (etHour >= TCPA_QUIET_START || etHour < TCPA_QUIET_END) {
      violations.push({
        check_type: "tcpa",
        severity: "critical",
        description: `SMS sent outside 8am–9pm ET (hour: ${etHour}:00 ET). Product: ${row.product ?? "unknown"}. Recipient: ${row.recipient}. Preview: "${(row.body_preview ?? "").slice(0, 80)}"`,
        affected_table: "system_comms_log",
        affected_id: row.id,
      });
    }
  }
  return violations;
}

// ── NEW: TCPA 18-Month EBR Expiry ────────────────────────────────────────────
// Auto-expire dead lead contacts past the 18-month EBR window.
// Any still marked pending/sent_1/sent_2 are critical violations — fix immediately.
async function checkTcpaEbrExpiry(): Promise<Violation[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - EBR_MONTHS);

  const { data: expired } = await supabase
    .from("dead_lead_contacts")
    .select("id, phone, last_contact_date, status")
    .in("status", ["pending", "sent_1", "sent_2"])
    .not("last_contact_date", "is", null)
    .lt("last_contact_date", cutoff.toISOString());

  const violations: Violation[] = [];

  if ((expired ?? []).length > 0) {
    // Auto-expire immediately — don't wait for Mute
    const ids = (expired ?? []).map((r) => r.id);
    await supabase.from("dead_lead_contacts").update({ status: "tcpa_expired" }).in("id", ids);

    for (const row of expired ?? []) {
      violations.push({
        check_type: "tcpa",
        severity: "critical",
        description: `EBR expired contact in active sequence. Last contact: ${row.last_contact_date}. Phone: ${row.phone}. Auto-expired now.`,
        affected_table: "dead_lead_contacts",
        affected_id: row.id,
      });
    }
  }
  return violations;
}

// ── NEW: Email Sender Routing ─────────────────────────────────────────────────
// DWA products must send from detroitwebagent.com per CAN-SPAM brand split.
async function checkEmailSenderRouting(): Promise<Violation[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("email_send_log")
    .select("id, product, from_email")
    .gte("created_at", since)
    .not("product", "is", null);

  const violations: Violation[] = [];
  for (const log of data ?? []) {
    const isDWA = DWA_PRODUCTS.some((p) => (log.product ?? "").includes(p));
    if (isDWA && (log.from_email ?? "").includes("mattmichelstraining.com")) {
      violations.push({
        check_type: "canspam",
        severity: "warning",
        description: `DWA product "${log.product}" sent email from M2 address (${log.from_email}). Should use detroitwebagent.com sender.`,
        affected_table: "email_send_log",
        affected_id: log.id,
      });
    }
  }
  return violations;
}

// ── NEW: Weekly Friday Report ─────────────────────────────────────────────────
async function weeklyReport(): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: weekViolations }, { count: unresolvedCount }] = await Promise.all([
    supabase.from("comply_violations").select("check_type, severity, description, created_at").gte("created_at", since).order("severity").order("created_at", { ascending: false }),
    supabase.from("comply_violations").select("id", { count: "exact", head: true }).eq("resolved", false),
  ]);

  const criticals = (weekViolations ?? []).filter((v) => v.severity === "critical");
  const warnings  = (weekViolations ?? []).filter((v) => v.severity === "warning");
  const status = criticals.length > 0 ? "🔴 CRITICAL" : warnings.length > 0 ? "🟡 WARNING" : "🟢 CLEAN";

  const rowHtml = (items: typeof weekViolations) => (items ?? []).map((v, i) => `
    <tr style="background:${i % 2 === 0 ? "white" : "#f8fafc"}">
      <td style="padding:8px;border:1px solid #e2e8f0">${v.check_type.toUpperCase()}</td>
      <td style="padding:8px;border:1px solid #e2e8f0">${v.description}</td>
    </tr>`).join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² Comply <matt@mattmichelstraining.com>",
      to: [ADMIN_EMAIL],
      subject: `⚖️ Comply: Weekly Legal Compliance Report — ${status}`,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <div style="background:#1e293b;color:white;padding:20px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px">⚖️ Comply — Weekly Legal Compliance Report</h1>
          <p style="margin:4px 0 0;opacity:0.7;font-size:13px">${new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}</p>
        </div>
        <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0">
          <div style="padding:16px;border-radius:8px;margin-bottom:20px;background:${criticals.length > 0 ? "#fef2f2" : warnings.length > 0 ? "#fffbeb" : "#f0fdf4"};border:2px solid ${criticals.length > 0 ? "#dc2626" : warnings.length > 0 ? "#f59e0b" : "#16a34a"}">
            <strong style="font-size:18px">${status}</strong>
            <div style="font-size:13px;margin-top:4px">${criticals.length} critical · ${warnings.length} warnings · ${unresolvedCount ?? 0} unresolved total</div>
          </div>
          <h3 style="margin:0 0 8px">Checks Performed Daily</h3>
          <table width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:20px">
            <tr style="background:#1e293b;color:white"><th style="padding:8px;text-align:left">Check</th><th style="padding:8px;text-align:left">Framework</th></tr>
            <tr style="background:white"><td style="padding:8px;border:1px solid #e2e8f0">SMS Time Window (8am–9pm ET)</td><td style="padding:8px;border:1px solid #e2e8f0">TCPA</td></tr>
            <tr style="background:#f8fafc"><td style="padding:8px;border:1px solid #e2e8f0">18-Month EBR Expiry (dead leads)</td><td style="padding:8px;border:1px solid #e2e8f0">TCPA</td></tr>
            <tr style="background:white"><td style="padding:8px;border:1px solid #e2e8f0">Opted-Out Active Clients</td><td style="padding:8px;border:1px solid #e2e8f0">TCPA</td></tr>
            <tr style="background:#f8fafc"><td style="padding:8px;border:1px solid #e2e8f0">Newsletter Unsubscribe Links</td><td style="padding:8px;border:1px solid #e2e8f0">CAN-SPAM</td></tr>
            <tr style="background:white"><td style="padding:8px;border:1px solid #e2e8f0">Email Sender Routing</td><td style="padding:8px;border:1px solid #e2e8f0">CAN-SPAM</td></tr>
            <tr style="background:#f8fafc"><td style="padding:8px;border:1px solid #e2e8f0">Pending Sequence Blocking</td><td style="padding:8px;border:1px solid #e2e8f0">TCPA (via Mute, every 2h)</td></tr>
          </table>
          ${criticals.length > 0 ? `<h3 style="color:#dc2626;margin:0 0 8px">🔴 Critical (${criticals.length})</h3><table width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:16px"><tr style="background:#1e293b;color:white"><th style="padding:8px;text-align:left">Type</th><th style="padding:8px;text-align:left">Description</th></tr>${rowHtml(criticals)}</table>` : ""}
          ${warnings.length > 0 ? `<h3 style="color:#f59e0b;margin:0 0 8px">🟡 Warnings (${warnings.length})</h3><table width="100%" style="border-collapse:collapse;font-size:13px;margin-bottom:16px"><tr style="background:#1e293b;color:white"><th style="padding:8px;text-align:left">Type</th><th style="padding:8px;text-align:left">Description</th></tr>${rowHtml(warnings)}</table>` : ""}
          ${criticals.length === 0 && warnings.length === 0 ? "<div style=\"padding:16px;background:#f0fdf4;border-radius:8px;color:#16a34a;font-weight:bold\">✅ Zero violations this week.</div>" : ""}
          <p style="font-size:11px;color:#94a3b8;margin-top:16px">All violations logged permanently in comply_violations. Not legal advice — consult an attorney for confirmed violations.</p>
        </div>
      </div>`,
    }),
  });
}

async function updateHeartbeat(status: "ok" | "warn" | "error", detail?: string) {
  await supabase.from("agent_heartbeats").upsert({
    agent_name: "comply",
    last_run_at: new Date().toISOString(),
    last_status: status,
    detail: detail ?? null,
  });
}

Deno.serve(async () => {
  const runStart = new Date();
  const isFriday = runStart.getDay() === 5;

  try {
    console.log("[comply-monitor] Starting compliance sweep");

    const [tcpaViolations, timeWindowViolations, ebrViolations, blockViolations, canSpamViolations, emailRoutingViolations, stripeViolations] =
      await Promise.all([
        checkTcpaOptOuts(),
        checkTcpaTimeWindow(),
        checkTcpaEbrExpiry(),
        checkComplianceBlocks(),
        checkCanSpam(),
        checkEmailSenderRouting(),
        checkPastDueActive(),
      ]);

    const allViolations = [
      ...tcpaViolations,
      ...timeWindowViolations,
      ...ebrViolations,
      ...blockViolations,
      ...canSpamViolations,
      ...emailRoutingViolations,
      ...stripeViolations,
    ];

    // Insert all violations to DB
    if (allViolations.length > 0) {
      await supabase.from("comply_violations").insert(allViolations);
    }

    // Alert Matt if any critical — email + SMS
    const critical = allViolations.filter((v) => v.severity === "critical");
    const warnings = allViolations.filter((v) => v.severity === "warning");

    await sendAlert(allViolations);

    if (critical.length > 0) {
      await sendSMS(
        ADMIN_PHONE,
        FROM_PHONE,
        `🚨 COMPLY: ${critical.length} CRITICAL legal violation(s). Check email now. ${critical[0].description.slice(0, 100)}`
      ).catch(() => {});
    }

    if (isFriday) await weeklyReport();

    await updateHeartbeat(
      critical.length > 0 ? "warn" : "ok",
      `${allViolations.length} violations (${critical.length} critical, ${warnings.length} warnings)`
    );

    console.log(`[comply-monitor] Done: ${critical.length} critical, ${warnings.length} warnings`);

    return new Response(
      JSON.stringify({ ok: true, critical: critical.length, warnings: warnings.length, total: allViolations.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[comply-monitor] Error:", msg);
    await updateHeartbeat("error", msg);
    // A compliance monitor going silent is dangerous — alert immediately
    await sendSMS(
      ADMIN_PHONE,
      FROM_PHONE,
      `🚨 Comply legal monitor FAILED: ${msg.slice(0, 120)}. Legal compliance checks not running. Investigate immediately.`
    ).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

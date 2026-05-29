// admin-ops-daily-brief — daily 8:30 AM ET cron (12:30 UTC)
// Sends Matt a rich HTML ops email covering every product's last 24h:
//   1. Outreach scoreboard (emails sent, opens, clicks, bounces) by product
//   2. Site Radar rollup (total visits, companies ID'd, new companies, top visitor)
//   3. Queue health (pending drafts, outreach backlog)
//   4. Overnight errors (from system_comms_log status='error'/'alert')
//
// Data sources:
//   - system_comms_log: product-level email/SMS send counts
//   - email_send_log:   opened_at, clicked_at, bounced_at (set by resend-webhook)
//   - crm_visitor_events: Site Radar aggregate
//   - cold_email_drafts + reply_drafts: queue depths

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product display names mapped from system_comms_log `product` values
const PRODUCT_LABELS: Record<string, string> = {
  trade_radar:       "Trade Radar",
  mortgage_radar:    "Mortgage Radar",
  techalert:         "TechAlert",
  tech_alert:        "TechAlert",
  dead_lead_pool:    "Dead Lead Pool",
  dead_lead:         "Dead Lead Pool",
  site_radar:        "Site Radar",
  cold_email:        "Cold Email (B2B)",
  dossier:           "Dossier Cold Email",
  field_desk:        "FieldDesk CRM",
  field_crm:         "FieldDesk CRM",
  contractor_sms:    "Contractor SMS",
  missed_call:       "Missed Call",
  onboarding:        "Onboarding",
};

function productLabel(raw: string | null): string {
  if (!raw) return "Other";
  return PRODUCT_LABELS[raw.toLowerCase().replace(/-/g, "_")] ?? raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function escHtml(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

function scoreColor(rate: number): string {
  if (rate >= 0.25) return "#86efac"; // green
  if (rate >= 0.10) return "#fde68a"; // yellow
  return "#94a3b8";                   // grey
}

function buildOutreachTable(rows: Array<{ product: string; sent: number; opens: number; clicks: number; bounces: number }>): string {
  if (rows.length === 0) {
    return `<p style="color:#64748b;font-size:13px;margin:0;">No outreach logged in the last 24 hours.</p>`;
  }
  const trs = rows.map(r => {
    const openRate = r.sent ? r.opens / r.sent : 0;
    const clickRate = r.sent ? r.clicks / r.sent : 0;
    return `
      <tr style="border-bottom:1px solid #1e3a5f;">
        <td style="padding:10px 14px;color:#e2e8f0;font-weight:600;font-size:13px;">${escHtml(r.product)}</td>
        <td style="padding:10px 8px;text-align:center;color:#fff;font-size:13px;">${r.sent}</td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:${scoreColor(openRate)};">${r.opens} <span style="color:#475569;font-size:11px;">(${pct(r.opens, r.sent)})</span></td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:${scoreColor(clickRate)};">${r.clicks} <span style="color:#475569;font-size:11px;">(${pct(r.clicks, r.sent)})</span></td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:${r.bounces > 0 ? "#fca5a5" : "#475569"};">${r.bounces}</td>
      </tr>`;
  }).join("");

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#0f1f3d;">
          <th style="padding:10px 14px;text-align:left;color:#00d4ff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Product</th>
          <th style="padding:10px 8px;text-align:center;color:#00d4ff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Sent</th>
          <th style="padding:10px 8px;text-align:center;color:#00d4ff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Opens</th>
          <th style="padding:10px 8px;text-align:center;color:#00d4ff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Clicks</th>
          <th style="padding:10px 8px;text-align:center;color:#00d4ff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Bounces</th>
        </tr>
      </thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function sectionHeader(emoji: string, title: string): string {
  return `<p style="margin:28px 0 10px;color:#00d4ff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;">${emoji} ${escHtml(title)}</p>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "America/Detroit",
  });

  // ── 1. Outreach sends from system_comms_log ──────────────────────────────
  const { data: commRows } = await sb
    .from("system_comms_log")
    .select("product, channel, status")
    .gte("created_at", since24h)
    .in("channel", ["email", "sms"]);

  // Group by product + channel
  const sendMap: Record<string, { sent: number; errors: number; channel: string }> = {};
  for (const row of (commRows || []) as any[]) {
    const key = (row.product || "other") + "|" + row.channel;
    if (!sendMap[key]) sendMap[key] = { sent: 0, errors: 0, channel: row.channel };
    if (row.status === "error" || row.status === "failed") {
      sendMap[key].errors++;
    } else {
      sendMap[key].sent++;
    }
  }

  // ── 2. Opens/clicks from email_send_log ─────────────────────────────────
  // email_send_log has template_name (maps loosely to product) + opened_at/clicked_at/bounced_at
  const { data: emailRows } = await sb
    .from("email_send_log")
    .select("template_name, opened_at, clicked_at, bounced_at, status")
    .gte("created_at", since24h);

  // Map template_name → product bucket, count opens/clicks/bounces
  const emailEngagement: Record<string, { opens: number; clicks: number; bounces: number }> = {};
  for (const row of (emailRows || []) as any[]) {
    const tmpl = String(row.template_name || "other").toLowerCase();
    // Best-effort product bucketing from template name
    let prod = "other";
    if (/trade.radar|trade_radar/.test(tmpl)) prod = "trade_radar";
    else if (/mortgage.radar|mortgage_radar/.test(tmpl)) prod = "mortgage_radar";
    else if (/techalert|tech.alert/.test(tmpl)) prod = "techalert";
    else if (/dead.lead|deadlead/.test(tmpl)) prod = "dead_lead";
    else if (/site.radar|siteradar/.test(tmpl)) prod = "site_radar";
    else if (/cold.email|dossier|outreach/.test(tmpl)) prod = "cold_email";
    else if (/onboard/.test(tmpl)) prod = "onboarding";

    if (!emailEngagement[prod]) emailEngagement[prod] = { opens: 0, clicks: 0, bounces: 0 };
    if (row.opened_at) emailEngagement[prod].opens++;
    if (row.clicked_at) emailEngagement[prod].clicks++;
    if (row.bounced_at || row.status === "bounced") emailEngagement[prod].bounces++;
  }

  // Merge sends + engagement into one scoreboard row per product
  const productSet = new Set([
    ...Object.keys(sendMap).map(k => k.split("|")[0]),
    ...Object.keys(emailEngagement),
  ]);

  const scoreboardRows: Array<{ product: string; sent: number; opens: number; clicks: number; bounces: number }> = [];
  for (const prod of productSet) {
    const emailKey = prod + "|email";
    const sent = (sendMap[emailKey]?.sent ?? 0) + (emailRows || []).filter((r: any) => {
      const tmpl = String(r.template_name || "").toLowerCase();
      if (prod === "trade_radar") return /trade.radar|trade_radar/.test(tmpl);
      if (prod === "mortgage_radar") return /mortgage.radar/.test(tmpl);
      if (prod === "techalert") return /techalert|tech.alert/.test(tmpl);
      return false;
    }).length;
    const eng = emailEngagement[prod] ?? { opens: 0, clicks: 0, bounces: 0 };
    const totalSent = Math.max(sent, eng.opens); // opens can't exceed sent
    if (totalSent === 0 && eng.opens === 0) continue; // skip empty buckets
    scoreboardRows.push({
      product: productLabel(prod),
      sent: totalSent,
      opens: eng.opens,
      clicks: eng.clicks,
      bounces: eng.bounces,
    });
  }
  scoreboardRows.sort((a, b) => b.sent - a.sent);

  // ── 3. Site Radar rollup (across all clients) ────────────────────────────
  const { data: visitorRows } = await sb
    .from("crm_visitor_events")
    .select("company_name, visit_count, city, is_business")
    .gte("created_at", since24h);

  const allVisits = (visitorRows || []).length;
  const bizVisitors = (visitorRows || []).filter((r: any) => r.is_business && r.company_name) as any[];
  const topVisitor = bizVisitors.sort((a: any, b: any) => b.visit_count - a.visit_count)[0];

  // New companies: not seen in prior 30d
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const { data: priorRows } = await sb
    .from("crm_visitor_events")
    .select("company_name")
    .gte("created_at", since30d)
    .lt("created_at", since24h)
    .eq("is_business", true);
  const seenBefore = new Set((priorRows || []).map((r: any) => r.company_name).filter(Boolean));
  const newCompanies = bizVisitors.filter((r: any) => !seenBefore.has(r.company_name)).length;

  // ── 4. Queue health ──────────────────────────────────────────────────────
  const [
    { count: pendingColdEmail },
    { count: pendingReplyDrafts },
  ] = await Promise.all([
    sb.from("cold_email_drafts" as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("reply_drafts" as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  // ── 5. Overnight errors ──────────────────────────────────────────────────
  const { data: errorRows } = await sb
    .from("system_comms_log")
    .select("product, channel, error_message, created_at")
    .gte("created_at", since24h)
    .in("status", ["error", "alert", "failed"])
    .order("created_at", { ascending: false })
    .limit(20);

  const errorsByProduct: Record<string, number> = {};
  for (const row of (errorRows || []) as any[]) {
    const p = productLabel(row.product);
    errorsByProduct[p] = (errorsByProduct[p] ?? 0) + 1;
  }

  // ── Build HTML ───────────────────────────────────────────────────────────

  // Site Radar block
  const siteRadarHtml = `
    <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:16px 20px;margin-bottom:4px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #1e3a5f;">
            <div style="font-size:24px;font-weight:900;color:#fff;">${allVisits}</div>
            <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Page Visits</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #1e3a5f;">
            <div style="font-size:24px;font-weight:900;color:#00d4ff;">${bizVisitors.length}</div>
            <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Companies ID'd</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #1e3a5f;">
            <div style="font-size:24px;font-weight:900;color:#86efac;">${newCompanies}</div>
            <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">New Today</div>
          </td>
          <td style="padding:8px 12px;text-align:center;">
            <div style="font-size:14px;font-weight:700;color:#e2e8f0;">${topVisitor ? escHtml(topVisitor.company_name) : "—"}</div>
            <div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Top Visitor</div>
          </td>
        </tr>
      </table>
    </div>`;

  // Queue health block
  const queueHtml = `
    <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;padding:16px 20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;">
            <span style="color:#94a3b8;font-size:13px;">Pending cold email drafts</span>
          </td>
          <td style="text-align:right;">
            <span style="font-size:16px;font-weight:800;color:${(pendingColdEmail ?? 0) > 10 ? "#fbbf24" : "#fff"};">${pendingColdEmail ?? 0}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-top:1px solid #1e3a5f;">
            <span style="color:#94a3b8;font-size:13px;">Unworked reply drafts</span>
          </td>
          <td style="text-align:right;border-top:1px solid #1e3a5f;">
            <span style="font-size:16px;font-weight:800;color:${(pendingReplyDrafts ?? 0) > 5 ? "#fbbf24" : "#fff"};">${pendingReplyDrafts ?? 0}</span>
          </td>
        </tr>
      </table>
    </div>`;

  // Errors block
  const errCount = Object.values(errorsByProduct).reduce((a, b) => a + b, 0);
  const errorsHtml = errCount === 0
    ? `<div style="background:#052e16;border:1px solid #166534;border-radius:8px;padding:14px 20px;color:#86efac;font-size:13px;font-weight:700;">✅ No errors or alerts in the last 24 hours</div>`
    : `<div style="background:#450a0a;border:1px solid #dc2626;border-radius:8px;padding:16px 20px;">
        ${Object.entries(errorsByProduct).map(([p, n]) =>
          `<p style="margin:0 0 6px;color:#fca5a5;font-size:13px;">⚠️ <strong>${escHtml(p)}</strong> — ${n} error${n !== 1 ? "s" : ""}</p>`
        ).join("")}
        <p style="margin:8px 0 0;color:#ef4444;font-size:12px;">Check Supabase logs for details.</p>
      </div>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:660px;margin:0 auto;padding:28px 20px;">

    <!-- Header -->
    <p style="margin:0 0 4px;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">⚡ DAILY OPS BRIEF</p>
    <h1 style="color:#fff;font-size:24px;margin:8px 0 4px;">Good morning, Matt.</h1>
    <p style="color:#64748b;font-size:12px;margin:0 0 28px;">${today} · All metrics from the last 24 hours</p>

    <!-- 1. Outreach Scoreboard -->
    ${sectionHeader("📬", "Outreach Scoreboard")}
    <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;overflow:hidden;margin-bottom:4px;">
      ${buildOutreachTable(scoreboardRows)}
    </div>
    <p style="color:#475569;font-size:11px;margin:6px 0 0;">Opens and clicks tracked via Resend webhooks. Rates shown as % of sent.</p>

    <!-- 2. Site Radar -->
    ${sectionHeader("🔍", "Site Radar — All Clients")}
    ${siteRadarHtml}

    <!-- 3. Queue Health -->
    ${sectionHeader("📋", "Queue Health")}
    ${queueHtml}

    <!-- 4. Overnight Errors -->
    ${sectionHeader("🛡", "Overnight Errors")}
    ${errorsHtml}

    <!-- Footer -->
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #1e3a5f;text-align:center;">
      <a href="https://detroitwebagent.com/admin" style="display:inline-block;background:#00d4ff;color:#030711;font-weight:800;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;">Open admin dashboard →</a>
      <p style="color:#334155;font-size:10px;margin-top:16px;">Detroit Web Agency · Automated daily brief · Do not reply</p>
    </div>

  </div></body></html>`;

  // ── Send ─────────────────────────────────────────────────────────────────
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "DWA Ops <matt@detroitwebagent.com>",
      to: [ADMIN_EMAIL],
      subject: `⚡ Daily Ops Brief — ${scoreboardRows.reduce((a, r) => a + r.sent, 0)} emails, ${bizVisitors.length} site visitors${errCount > 0 ? ` ⚠️ ${errCount} errors` : ""}`,
      html,
    }),
  });

  const ok = sendRes.ok;
  await sb.from("agent_heartbeats").upsert({
    agent_name: "admin-ops-daily-brief",
    last_beat: new Date().toISOString(),
    status: ok ? "ok" : "error",
    metadata: { scoreboard_rows: scoreboardRows.length, errors: errCount, site_visitors: bizVisitors.length },
  }, { onConflict: "agent_name" }).catch(() => {});

  return new Response(JSON.stringify({ ok, scoreboard_rows: scoreboardRows.length, errors: errCount, site_visitors: bizVisitors.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

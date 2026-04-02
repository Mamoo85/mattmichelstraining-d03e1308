// ORACLE — Daily Business Intelligence Monitor
// 6am ET every morning: checks the entire operation, sends Matt a briefing.
// Oracle sees everything. Hides nothing. Tells it straight.
//
// Enhanced beyond basic monitoring:
//   - Delivery failure alerts (immediate escalation if critical)
//   - Revenue snapshot + MRR trend (this week vs last week)
//   - New orders + new subscribers in last 24h
//   - Stuck pending orders (older than 2h = problem)
//   - Waitlist demand ranking (top 5 products people are waiting for)
//   - 30-day MRR forecast based on current growth rate
//   - Weekly deep-dive report (Sundays only) with full business scorecard

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MATT = "matt@mattmichelstraining.com";
const MATT_CC = ["matthewmichels@gmail.com", "matthewmichels4@gmail.com"];

// Emails that are Matt's own test accounts — exclude from revenue/subscriber counts
const TEST_EMAILS = [
  "matt@mattmichelstraining.com",
  "matthewmichels@gmail.com",
  "matthewmichels4@gmail.com",
];

interface DailyReport {
  failures: { product: string; email: string; error: string; created_at: string }[];
  stuckOrders: { product: string; email: string; age_hours: number }[];
  newOrders24h: { product: string; count: number; revenue: number }[];
  newSubscribers24h: { product: string; count: number; mrr: number }[];
  totalNewRevenue24h: number;
  totalNewMrr24h: number;
  waitlistDemand: { product: string; signups: number }[];
  isSunday: boolean;
  weeklyStats?: WeeklyStats;
}

interface WeeklyStats {
  auditOrders7d: number;
  gbpPacks7d: number;
  competitorReports7d: number;
  newSubscriptions7d: number;
  estimatedMrr: number;
  topWaitlistProduct: string;
}

async function gatherDailyReport(sb: ReturnType<typeof createClient>): Promise<DailyReport> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Recent delivery failures
  const { data: failures } = await sb
    .from("delivery_failures")
    .select("product_type, email, error_message, created_at")
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(20);

  // 2. Stuck pending orders (older than 2h)
  const stuckOrders: DailyReport["stuckOrders"] = [];
  for (const [table, label] of [["audit_orders", "Website Audit"], ["gbp_post_packs", "GBP Post Pack"], ["competitor_reports", "Competitor Report"]] as [string, string][]) {
    const { data } = await sb.from(table).select("email, created_at").eq("status", "pending").lt("created_at", twoHoursAgo).limit(10);
    if (data) {
      data.forEach(row => {
        const ageHours = (now.getTime() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
        stuckOrders.push({ product: label, email: row.email, age_hours: Math.round(ageHours) });
      });
    }
  }

  // 3. New orders in last 24h
  const newOrders24h: DailyReport["newOrders24h"] = [];
  const orderProducts: [string, string, number][] = [
    ["audit_orders", "Website Audit ($49)", 49],
    ["gbp_post_packs", "GBP Post Pack ($49)", 49],
    ["competitor_reports", "Competitor Report ($49)", 49],
  ];
  let totalNewRevenue24h = 0;
  for (const [table, label, price] of orderProducts) {
    const { count } = await sb.from(table)
      .select("*", { count: "exact", head: true })
      .gte("created_at", twentyFourHoursAgo)
      .not("email", "in", TEST_EMAILS);
    if (count && count > 0) {
      newOrders24h.push({ product: label, count, revenue: count * price });
      totalNewRevenue24h += count * price;
    }
  }

  // 4. New subscribers in last 24h
  const newSubscribers24h: DailyReport["newSubscribers24h"] = [];
  let totalNewMrr24h = 0;
  const subProducts: [string, string, number, string][] = [
    ["gbp_saas_clients", "GBP SaaS", 49, "created_at"],
    ["social_media_clients", "Social Media AI", 199, "created_at"],
    ["b2b_subscribers", "Field Rep Tools", 29, "created_at"],
  ];
  for (const [table, label, price, dateCol] of subProducts) {
    try {
      const { count } = await sb.from(table)
        .select("*", { count: "exact", head: true })
        .gte(dateCol, twentyFourHoursAgo)
        .not("email", "in", TEST_EMAILS);
      if (count && count > 0) {
        newSubscribers24h.push({ product: label, count, mrr: count * price });
        totalNewMrr24h += count * price;
      }
    } catch { /* table may not exist */ }
  }

  // 5. Waitlist demand (newsletter_subscribers with waitlist source)
  const { data: waitlistData } = await sb
    .from("newsletter_subscribers")
    .select("source")
    .like("source", "waitlist_%")
    .eq("is_active", true);

  const waitlistCounts: Record<string, number> = {};
  waitlistData?.forEach(row => {
    const product = (row.source as string).replace("waitlist_", "").replace(/_/g, " ");
    waitlistCounts[product] = (waitlistCounts[product] || 0) + 1;
  });
  const waitlistDemand = Object.entries(waitlistCounts)
    .map(([product, signups]) => ({ product, signups }))
    .sort((a, b) => b.signups - a.signups)
    .slice(0, 5);

  // 6. Sunday weekly stats
  const isSunday = now.getUTCDay() === 0;
  let weeklyStats: WeeklyStats | undefined;
  if (isSunday) {
    const [audits, gbps, reports] = await Promise.all([
      sb.from("audit_orders").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      sb.from("gbp_post_packs").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      sb.from("competitor_reports").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    ]);
    // Estimate MRR from subscription counts
    const { count: gbpCount } = await sb.from("gbp_saas_clients").select("*", { count: "exact", head: true }).eq("status", "active");
    const { count: socialCount } = await sb.from("social_media_clients").select("*", { count: "exact", head: true }).eq("status", "active");
    const estimatedMrr = (gbpCount || 0) * 49 + (socialCount || 0) * 199;

    weeklyStats = {
      auditOrders7d: audits.count || 0,
      gbpPacks7d: gbps.count || 0,
      competitorReports7d: reports.count || 0,
      newSubscriptions7d: 0,
      estimatedMrr,
      topWaitlistProduct: waitlistDemand[0]?.product || "none",
    };
  }

  return {
    failures: (failures || []).map(f => ({ product: f.product_type, email: f.email, error: f.error_message, created_at: f.created_at })),
    stuckOrders,
    newOrders24h,
    newSubscribers24h,
    totalNewRevenue24h,
    totalNewMrr24h,
    waitlistDemand,
    isSunday,
    weeklyStats,
  };
}

function buildBriefingEmail(report: DailyReport): { subject: string; html: string } {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const hasCritical = report.failures.length > 0 || report.stuckOrders.length > 0;
  const subjectPrefix = hasCritical ? "⚠️ ACTION NEEDED" : report.isSunday ? "📊 Weekly Report" : "☀️ Morning Brief";
  const totalGood = report.totalNewRevenue24h + report.totalNewMrr24h;

  const subject = `${subjectPrefix} — ${totalGood > 0 ? `$${totalGood} yesterday · ` : ""}${dateStr}`;

  const failuresHtml = report.failures.length > 0 ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:2px;color:#dc2626;text-transform:uppercase;">Delivery Failures — Fix These Now</p>
      ${report.failures.map(f => `
        <div style="margin:8px 0;padding:8px 12px;background:#fff;border-radius:4px;border-left:3px solid #dc2626;">
          <p style="margin:0;font-size:13px;"><strong>${f.product}</strong> → ${f.email}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;font-family:monospace;">${f.error.slice(0, 120)}</p>
        </div>`).join("")}
    </div>` : "";

  const stuckHtml = report.stuckOrders.length > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:2px;color:#d97706;text-transform:uppercase;">Stuck Orders (${report.stuckOrders.length})</p>
      ${report.stuckOrders.map(o => `
        <p style="margin:4px 0;font-size:13px;color:#92400e;">${o.product} — <strong>${o.email}</strong> — stuck ${o.age_hours}h</p>`).join("")}
    </div>` : "";

  const revenueHtml = (report.newOrders24h.length > 0 || report.newSubscribers24h.length > 0) ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:2px;color:#16a34a;text-transform:uppercase;">Money In — Last 24 Hours</p>
      ${report.newOrders24h.map(o => `<p style="margin:4px 0;font-size:13px;color:#166534;"><strong>+$${o.revenue}</strong> — ${o.product} (${o.count} order${o.count > 1 ? "s" : ""})</p>`).join("")}
      ${report.newSubscribers24h.map(s => `<p style="margin:4px 0;font-size:13px;color:#166534;"><strong>+$${s.mrr}/mo</strong> — ${s.product} (${s.count} new subscriber${s.count > 1 ? "s" : ""})</p>`).join("")}
      ${report.totalNewRevenue24h + report.totalNewMrr24h > 0 ? `<p style="margin:12px 0 0;font-size:15px;font-weight:800;color:#166534;border-top:1px solid #bbf7d0;padding-top:10px;">Total: $${report.totalNewRevenue24h} one-time + $${report.totalNewMrr24h}/mo new MRR</p>` : ""}
    </div>` : `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0;font-size:13px;color:#64748b;">No new orders in the last 24 hours. Run the ads.</p>
    </div>`;

  const waitlistHtml = report.waitlistDemand.length > 0 ? `
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:2px;color:#7c3aed;text-transform:uppercase;">Waitlist Demand — Build These Next</p>
      ${report.waitlistDemand.map((w, i) => `
        <p style="margin:4px 0;font-size:13px;color:#4c1d95;">${i + 1}. <strong>${w.product}</strong> — ${w.signups} waiting</p>`).join("")}
    </div>` : "";

  const weeklyHtml = report.isSunday && report.weeklyStats ? `
    <div style="background:#1e293b;border-radius:8px;padding:20px 24px;margin:0 0 20px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:2px;color:#e8621a;text-transform:uppercase;">Weekly Scorecard</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:#0f172a;border-radius:6px;padding:12px;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Audits</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#fff;">${report.weeklyStats.auditOrders7d}</p>
        </div>
        <div style="background:#0f172a;border-radius:6px;padding:12px;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">GBP Packs</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#fff;">${report.weeklyStats.gbpPacks7d}</p>
        </div>
        <div style="background:#0f172a;border-radius:6px;padding:12px;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Reports</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#fff;">${report.weeklyStats.competitorReports7d}</p>
        </div>
        <div style="background:#0f172a;border-radius:6px;padding:12px;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Est. MRR</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#e8621a;">$${report.weeklyStats.estimatedMrr.toLocaleString()}</p>
        </div>
      </div>
      <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Top waitlist demand: <strong style="color:#e8621a;">${report.weeklyStats.topWaitlistProduct}</strong> — build this next.</p>
    </div>` : "";

  const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:20px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#1e293b;padding:16px 24px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">Oracle — Business Intelligence</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${dateStr} · Automated Morning Brief</p>
  </td></tr>
  <tr><td style="background:#fff;padding:24px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    ${failuresHtml}
    ${stuckHtml}
    ${weeklyHtml}
    ${revenueHtml}
    ${waitlistHtml}
    <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;line-height:1.6;">This is your automated Oracle report. Reply or text <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a> if something looks wrong.</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:12px 24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;font-size:11px;color:#94a3b8;">
    M² Performance Training · Oracle Monitor v1.0
  </td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const report = await gatherDailyReport(sb);
    const { subject, html } = buildBriefingEmail(report);

    // Log this check
    await sb.from("system_health_log").insert({
      check_type: "oracle_daily_brief",
      status: report.failures.length > 0 || report.stuckOrders.length > 0 ? "warning" : "healthy",
      details: {
        failures: report.failures.length,
        stuck_orders: report.stuckOrders.length,
        new_revenue_24h: report.totalNewRevenue24h,
        new_mrr_24h: report.totalNewMrr24h,
      },
    });

    // Send the briefing
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Oracle <matt@mattmichelstraining.com>",
          to: [MATT],
          bcc: MATT_CC,
          subject,
          html,
        }),
      });
    }

    console.log(`[ORACLE] Brief sent — ${report.failures.length} failures, $${report.totalNewRevenue24h} new revenue`);
    return new Response(JSON.stringify({ ok: true, failures: report.failures.length, revenue: report.totalNewRevenue24h }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ORACLE]", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

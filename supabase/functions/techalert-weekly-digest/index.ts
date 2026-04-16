// techalert-weekly-digest — Monday 7am ET
// Sends Hiring Health Score + ROI report to each active TechAlert client

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function healthScoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function healthLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: clients } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, email, dashboard_token, target_roles")
      .eq("active", true);

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const client of clients) {
      try {
        // 7-day pipeline stats
        const { data: weekCandidates } = await sb
          .from("hire_alert_client_candidates")
          .select("pipeline_stage, client_action, hired_revenue_estimate, alerted_at")
          .eq("client_id", client.id)
          .gte("alerted_at", sevenDaysAgo);

        const week = weekCandidates || [];
        const alerted = week.length;
        const viewed = week.filter((c) => ["viewed", "contacted", "interviewed", "hired"].includes(c.pipeline_stage)).length;
        const contacted = week.filter((c) => ["contacted", "interviewed", "hired"].includes(c.pipeline_stage)).length;
        const interviewed = week.filter((c) => ["interviewed", "hired"].includes(c.pipeline_stage)).length;
        const hired = week.filter((c) => c.pipeline_stage === "hired").length;

        // 90-day totals for ROI
        const { data: allCandidates } = await sb
          .from("hire_alert_client_candidates")
          .select("pipeline_stage, hired_revenue_estimate")
          .eq("client_id", client.id)
          .gte("alerted_at", ninetyDaysAgo);

        const all90 = allCandidates || [];
        const totalAlerted = all90.length;
        const totalHired = all90.filter((c) => c.pipeline_stage === "hired").length;
        const totalContacted = all90.filter((c) => ["contacted", "interviewed", "hired"].includes(c.pipeline_stage)).length;
        const totalRevenue = all90
          .filter((c) => c.pipeline_stage === "hired")
          .reduce((sum, c) => sum + (c.hired_revenue_estimate || 0), 0);

        // Calculate Hiring Health Score (0-100)
        const claimRate = totalAlerted > 0 ? (totalContacted / totalAlerted) * 100 : 0;
        const hireRate = totalContacted > 0 ? (totalHired / totalContacted) * 100 : 0;
        const engagementRate = totalAlerted > 0 ? (all90.filter((c) => c.pipeline_stage !== "alerted").length / totalAlerted) * 100 : 0;

        // Weighted score: engagement 30%, claim rate 30%, hire rate 40%
        const healthScore = Math.min(100, Math.round(
          (engagementRate * 0.3) + (claimRate * 0.3) + (hireRate * 0.4)
        ));

        const subscriptionCost = 149 * 3; // 3 months at $149/mo
        const roiMultiple = subscriptionCost > 0 && totalRevenue > 0
          ? Math.round(totalRevenue / subscriptionCost)
          : 0;

        const scoreColor = healthScoreColor(healthScore);
        const scoreLabel = healthLabel(healthScore);

        const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:#e2e8f0;padding:0;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0a1628,#0d1f2e);padding:32px 24px;border-bottom:1px solid rgba(255,255,255,0.05);">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;">⚡ TechAlert Weekly Digest</p>
    <h1 style="color:white;font-size:24px;font-weight:900;margin:0;">${client.company_name || "Your"} Hiring Report</h1>
    <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">Week of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </div>

  <!-- Hiring Health Score -->
  <div style="padding:24px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Hiring Health Score</p>
    <div style="display:inline-block;width:120px;height:120px;border-radius:50%;border:6px solid ${scoreColor};position:relative;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">
        <p style="font-size:36px;font-weight:900;color:${scoreColor};margin:0;line-height:1;">${healthScore}</p>
        <p style="font-size:11px;color:#94a3b8;margin:0;">/100</p>
      </div>
    </div>
    <p style="color:${scoreColor};font-size:14px;font-weight:700;margin:12px 0 0;">${scoreLabel}</p>
  </div>

  <!-- Pipeline Funnel -->
  <div style="padding:0 24px 24px;">
    <p style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">This Week's Pipeline</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 12px;background:rgba(0,212,255,0.05);border:1px solid rgba(255,255,255,0.05);border-radius:8px;">
          <p style="color:#00d4ff;font-size:24px;font-weight:900;margin:0;">${alerted}</p>
          <p style="color:#64748b;font-size:11px;margin:4px 0 0;">Alerted</p>
        </td>
        <td style="padding:10px 12px;background:rgba(96,165,250,0.05);border:1px solid rgba(255,255,255,0.05);border-radius:8px;">
          <p style="color:#60a5fa;font-size:24px;font-weight:900;margin:0;">${viewed}</p>
          <p style="color:#64748b;font-size:11px;margin:4px 0 0;">Viewed</p>
        </td>
        <td style="padding:10px 12px;background:rgba(251,191,36,0.05);border:1px solid rgba(255,255,255,0.05);border-radius:8px;">
          <p style="color:#fbbf24;font-size:24px;font-weight:900;margin:0;">${contacted}</p>
          <p style="color:#64748b;font-size:11px;margin:4px 0 0;">Contacted</p>
        </td>
        <td style="padding:10px 12px;background:rgba(16,185,129,0.05);border:1px solid rgba(255,255,255,0.05);border-radius:8px;">
          <p style="color:#10b981;font-size:24px;font-weight:900;margin:0;">${hired}</p>
          <p style="color:#64748b;font-size:11px;margin:4px 0 0;">Hired</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- ROI Section -->
  ${totalHired > 0 ? `
  <div style="padding:0 24px 24px;">
    <div style="background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.02));border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:20px;text-align:center;">
      <p style="color:#10b981;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">90-Day ROI</p>
      <p style="color:#10b981;font-size:32px;font-weight:900;margin:0;">$${totalRevenue.toLocaleString()}</p>
      <p style="color:#6ee7b7;font-size:13px;margin:8px 0 0;">estimated revenue from ${totalHired} hire${totalHired > 1 ? "s" : ""}</p>
      ${roiMultiple > 0 ? `<p style="color:#94a3b8;font-size:12px;margin:8px 0 0;">TechAlert cost: $${subscriptionCost.toLocaleString()} → <strong style="color:#10b981">${roiMultiple}x ROI</strong></p>` : ""}
    </div>
  </div>` : `
  <div style="padding:0 24px 24px;">
    <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.1);border-radius:12px;padding:20px;text-align:center;">
      <p style="color:#00d4ff;font-size:13px;margin:0;">📊 Mark candidates as "Hired" in your dashboard to start tracking ROI.</p>
      <a href="https://www.detroitwebagent.com/my-techalert?token=${client.dashboard_token}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;text-decoration:none;margin-top:12px;">Open Dashboard →</a>
    </div>
  </div>`}

  <!-- Key Metrics -->
  <div style="padding:0 24px 24px;">
    <p style="color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">90-Day Metrics</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">Engagement Rate</td><td style="padding:8px 0;text-align:right;color:white;font-weight:700;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${Math.round(engagementRate)}%</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">Contact Rate</td><td style="padding:8px 0;text-align:right;color:white;font-weight:700;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${Math.round(claimRate)}%</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">Hire Conversion</td><td style="padding:8px 0;text-align:right;color:white;font-weight:700;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.05);">${Math.round(hireRate)}%</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;">Total Candidates (90d)</td><td style="padding:8px 0;text-align:right;color:white;font-weight:700;font-size:13px;">${totalAlerted}</td></tr>
    </table>
  </div>

  <!-- CTA -->
  <div style="padding:0 24px 32px;text-align:center;">
    <a href="https://www.detroitwebagent.com/my-techalert?token=${client.dashboard_token}" style="display:inline-block;background:#00d4ff;color:#0a1628;font-weight:800;font-size:14px;padding:14px 32px;border-radius:10px;text-decoration:none;">Open Your Dashboard →</a>
  </div>

  <!-- Footer -->
  <div style="padding:20px 24px;border-top:1px solid rgba(255,255,255,0.05);">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" />
      <div>
        <p style="color:white;font-size:13px;font-weight:700;margin:0;">Matt Michels</p>
        <p style="color:#64748b;font-size:11px;margin:0;">Detroit Web Agency · (313) 992-1219</p>
      </div>
    </div>
    <p style="color:#475569;font-size:10px;margin:16px 0 0;">Reply to this email to adjust your target roles, zip codes, or alert preferences.</p>
  </div>
</div>`;

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "TechAlert <matt@detroitwebagent.com>",
              to: [client.email],
              bcc: ["matthewmichels@gmail.com"],
              subject: `Your Hiring Health Score: ${healthScore}/100 — ${scoreLabel}`,
              html,
            }),
          });
        }

        sent++;
      } catch (e) {
        console.error(`[weekly-digest] Error for ${client.email}:`, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[weekly-digest]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// Weekly digest email for Industry Pulse Intelligence clients
// Sends every Monday 7am ET via cron

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagent.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Get all active clients
    const { data: clients } = await sb.from("industry_pulse_clients")
      .select("*")
      .eq("active", true);

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no active clients" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Get signals from last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals } = await sb.from("industry_pulse_signals")
      .select("*")
      .gte("detected_at", weekAgo)
      .order("confidence", { ascending: false })
      .limit(100);

    if (!signals?.length) {
      console.log("[industry-pulse-digest] No signals this week, skipping digest");
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no signals" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const client of clients) {
      // Filter signals by client's target industries
      const targets = client.target_industries || [];
      let clientSignals = signals;
      if (targets.length > 0) {
        clientSignals = signals.filter((s: any) => {
          if (!s.industry) return true;
          return targets.some((t: string) =>
            s.industry.toLowerCase().includes(t.toLowerCase())
          );
        });
      }

      if (clientSignals.length === 0) continue;

      const highConf = clientSignals.filter((s: any) => s.confidence >= 7).length;
      const crossRef = clientSignals.filter((s: any) => s.cross_referenced).length;

      const signalRows = clientSignals.slice(0, 15).map((s: any) => {
        const confColor = s.confidence >= 8 ? "#22c55e" : s.confidence >= 5 ? "#00d4ff" : "#94a3b8";
        const badge = s.cross_referenced ? "⚡ Cross-Ref" : s.confidence >= 7 ? "🔥 High" : "📊 Signal";
        return `
          <tr style="border-bottom:1px solid #1e3a5f;">
            <td style="padding:10px 8px;color:#fff;font-weight:600;font-size:13px;">${s.company_name}</td>
            <td style="padding:10px 8px;color:#94a3b8;font-size:12px;">${s.location || "—"}</td>
            <td style="padding:10px 8px;color:#94a3b8;font-size:12px;">${s.industry || "—"}</td>
            <td style="padding:10px 8px;text-align:center;">
              <span style="background:${confColor}20;color:${confColor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">${badge} ${s.confidence}/10</span>
            </td>
            <td style="padding:10px 8px;color:#94a3b8;font-size:11px;max-width:200px;">${(s.predicted_needs || []).slice(0, 3).join(", ") || "—"}</td>
          </tr>`;
      }).join("");

      const dashboardUrl = `${SITE_URL}/my-industry-pulse?token=${client.dashboard_token}`;

      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:680px;margin:0 auto;padding:24px 16px;">

  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#00d4ff;font-size:20px;margin:0;">📡 Demand Radar Weekly</h1>
    <p style="color:#64748b;font-size:12px;margin:4px 0 0;">${client.company_name} — Week of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
  </div>

  <div style="display:flex;gap:12px;margin-bottom:24px;">
    <div style="flex:1;background:#0f1f35;border:1px solid #1e3a5f;border-radius:8px;padding:16px;text-align:center;">
      <p style="color:#00d4ff;font-size:28px;font-weight:900;margin:0;">${clientSignals.length}</p>
      <p style="color:#64748b;font-size:10px;margin:4px 0 0;text-transform:uppercase;">Signals</p>
    </div>
    <div style="flex:1;background:#0f1f35;border:1px solid #1e3a5f;border-radius:8px;padding:16px;text-align:center;">
      <p style="color:#22c55e;font-size:28px;font-weight:900;margin:0;">${highConf}</p>
      <p style="color:#64748b;font-size:10px;margin:4px 0 0;text-transform:uppercase;">High Confidence</p>
    </div>
    <div style="flex:1;background:#0f1f35;border:1px solid #1e3a5f;border-radius:8px;padding:16px;text-align:center;">
      <p style="color:#f59e0b;font-size:28px;font-weight:900;margin:0;">${crossRef}</p>
      <p style="color:#64748b;font-size:10px;margin:4px 0 0;text-transform:uppercase;">Cross-Referenced</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;">
    <thead>
      <tr style="border-bottom:2px solid #1e3a5f;">
        <th style="padding:10px 8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:left;">Company</th>
        <th style="padding:10px 8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:left;">Location</th>
        <th style="padding:10px 8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:left;">Industry</th>
        <th style="padding:10px 8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:center;">Score</th>
        <th style="padding:10px 8px;color:#64748b;font-size:10px;text-transform:uppercase;text-align:left;">Predicted Needs</th>
      </tr>
    </thead>
    <tbody>${signalRows}</tbody>
  </table>

  <div style="text-align:center;margin-top:24px;">
    <a href="${dashboardUrl}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;">
      📊 View Full Dashboard
    </a>
  </div>

  <p style="color:#475569;font-size:10px;text-align:center;margin-top:32px;">
    Detroit Web Agency — Demand Radar Intelligence<br>
    <a href="mailto:matt@detroitwebagent.com" style="color:#00d4ff;">matt@detroitwebagent.com</a>
  </p>
</div>
</body></html>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [client.email],
          subject: `📡 ${clientSignals.length} New Demand Radar Signals — Week of ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          html,
        }),
      });

      if (res.ok) {
        sent++;
        console.log(`[industry-pulse-digest] Sent to ${client.email}`);
      } else {
        console.error(`[industry-pulse-digest] Failed for ${client.email}:`, await res.text());
      }
    }

    // Log to comms
    await sb.from("system_comms_log").insert({
      channel: "email",
      product: "industry_pulse",
      recipient: `${sent} clients`,
      body_preview: `Weekly digest: ${signals.length} signals`,
      status: "sent",
    }).then(() => {});

    return new Response(JSON.stringify({ ok: true, sent, total_signals: signals.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industry-pulse-digest]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

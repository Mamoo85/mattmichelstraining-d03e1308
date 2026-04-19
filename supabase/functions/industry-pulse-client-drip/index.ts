// Demand Radar client onboarding drip
// Day 3: "How's it going?" adaptive check-in — adjusts based on whether client has taken any actions
// Day 14: ROI report — total signals, actions taken, revenue logged

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagent.com";
const DWA_FROM = "+13139921219";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Detroit Web Agency <matt@detroitwebagent.com>", to: [to], subject, html }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  let day3Sent = 0;
  let day14Sent = 0;

  try {
    const { data: clients } = await sb.from("industry_pulse_clients")
      .select("id, email, phone, company_name, dashboard_token, created_at")
      .eq("active", true);

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, day3: 0, day14: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    for (const client of clients) {
      const createdAt = new Date(client.created_at);
      const daysSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const dashLink = `${SITE_URL}/my-industry-pulse?token=${client.dashboard_token}`;

      // --- Day 3 drip ---
      if (daysSince >= 3 && daysSince < 4) {
        // Get signal + action counts
        const [{ data: actions }, { count: signalCount }] = await Promise.all([
          sb.from("industry_pulse_client_actions")
            .select("action, deal_value")
            .eq("client_id", client.id),
          sb.from("industry_pulse_signals")
            .select("id", { count: "exact", head: true })
            .gte("detected_at", client.created_at),
        ]);

        const totalActions = actions?.length || 0;
        const wonDeals = (actions || []).filter((a: any) => a.action === "won");
        const revenue = wonDeals.reduce((s: number, a: any) => s + (a.deal_value || 0), 0);

        const isEngaged = totalActions > 0;
        const subject = isEngaged
          ? `📡 Demand Radar: ${totalActions} signal${totalActions === 1 ? "" : "s"} tracked — great start`
          : `📡 Demand Radar: ${signalCount || 0} signals waiting for you`;

        const bodyIntro = isEngaged
          ? `You've already tracked <strong>${totalActions} signal${totalActions === 1 ? "" : "s"}</strong> — that's exactly how this works. ${wonDeals.length > 0 ? `<strong style="color:#22c55e;">$${revenue.toLocaleString()} revenue logged</strong> already.` : "Keep marking contacts as Won to track your ROI."}`
          : `You have <strong>${signalCount || 0} active signals</strong> waiting in your dashboard. Click a signal → hit <strong>Contacted</strong> when you reach out. That's it.`;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 16px;">📡 DEMAND RADAR</p>
    <h1 style="color:#fff;font-size:20px;margin:0 0 12px;">Day 3 Check-In</h1>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">${bodyIntro}</p>
    <a href="${dashLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;">📊 Open Dashboard</a>
    <p style="color:#64748b;font-size:12px;margin:20px 0 0;">Questions? Reply to this email or call (313) 992-1219.</p>
  </div>
</div></body></html>`;

        await sendEmail(client.email, subject, html);

        if (client.phone) {
          const smsBody = isEngaged
            ? `Demand Radar Day 3: Nice work tracking those signals. Keep it up — your dashboard: ${dashLink}`
            : `Demand Radar Day 3: You have ${signalCount || 0} signals ready. Open your dashboard and mark who you contact: ${dashLink}`;
          await sendSMS(client.phone, DWA_FROM, smsBody, "demand_radar_drip_day3");
        }

        day3Sent++;
      }

      // --- Day 14 drip ---
      if (daysSince >= 14 && daysSince < 15) {
        const [{ data: actions }, { count: totalSignals }] = await Promise.all([
          sb.from("industry_pulse_client_actions")
            .select("action, deal_value")
            .eq("client_id", client.id),
          sb.from("industry_pulse_signals")
            .select("id", { count: "exact", head: true })
            .gte("detected_at", client.created_at),
        ]);

        const wonDeals = (actions || []).filter((a: any) => a.action === "won");
        const contactedCount = (actions || []).filter((a: any) => a.action === "contacted").length;
        const revenue = wonDeals.reduce((s: number, a: any) => s + (a.deal_value || 0), 0);

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#030711;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">
  <div style="background:#0a1628;border:1px solid #1e3a5f;border-radius:16px;padding:32px;">
    <p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;margin:0 0 16px;">📡 DEMAND RADAR · 2-WEEK REPORT</p>
    <h1 style="color:#fff;font-size:20px;margin:0 0 20px;">${client.company_name} — 14-Day Intelligence Summary</h1>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
      <div style="background:#0f1f35;border:1px solid #1e3a5f;border-radius:8px;padding:16px;text-align:center;">
        <p style="color:#00d4ff;font-size:24px;font-weight:900;margin:0;">${totalSignals || 0}</p>
        <p style="color:#64748b;font-size:10px;margin:4px 0 0;text-transform:uppercase;">Signals</p>
      </div>
      <div style="background:#0f1f35;border:1px solid #1e3a5f;border-radius:8px;padding:16px;text-align:center;">
        <p style="color:#fff;font-size:24px;font-weight:900;margin:0;">${contactedCount}</p>
        <p style="color:#64748b;font-size:10px;margin:4px 0 0;text-transform:uppercase;">Contacted</p>
      </div>
      <div style="background:#0f1f35;border:1px solid #22c55e33;border-radius:8px;padding:16px;text-align:center;">
        <p style="color:#22c55e;font-size:24px;font-weight:900;margin:0;">$${revenue.toLocaleString()}</p>
        <p style="color:#64748b;font-size:10px;margin:4px 0 0;text-transform:uppercase;">Revenue Logged</p>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">
      ${revenue > 0
        ? `You've already logged <strong style="color:#22c55e;">$${revenue.toLocaleString()}</strong> in won deals from Demand Radar signals. That's real ROI from predictive intelligence — not cold calling.`
        : `You have ${totalSignals || 0} signals and ${contactedCount} contacts tracked. Every "Contacted" you mark is a pipeline touch that would've been missed. Start logging deal values when you close to see your ROI.`
      }
    </p>
    <a href="${dashLink}" style="display:inline-block;background:#00d4ff;color:#000;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:14px;">📊 View Full Dashboard</a>
    <p style="color:#64748b;font-size:12px;margin:20px 0 0;">Matt Michels · Detroit Web Agency · (313) 992-1219</p>
  </div>
</div></body></html>`;

        await sendEmail(
          client.email,
          `📡 Demand Radar 14-Day Report — ${totalSignals || 0} signals, ${wonDeals.length} won`,
          html
        );

        if (client.phone) {
          await sendSMS(
            client.phone,
            DWA_FROM,
            `Demand Radar 14-day report: ${totalSignals || 0} signals scanned, ${wonDeals.length} won${revenue > 0 ? `, $${revenue.toLocaleString()} logged` : ""}. Dashboard: ${dashLink}`,
            "demand_radar_drip_day14"
          );
        }

        day14Sent++;
      }
    }

    await sb.from("agent_heartbeats").upsert(
      { agent_name: "industry-pulse-client-drip", last_beat: new Date().toISOString(), metadata: { day3: day3Sent, day14: day14Sent } },
      { onConflict: "agent_name" }
    );

    return new Response(JSON.stringify({ ok: true, day3: day3Sent, day14: day14Sent }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industry-pulse-client-drip]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

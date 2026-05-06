/**
 * hire-alert-client-drip — Talent Radar onboarding follow-up sequence
 * Runs daily at noon ET via cron.
 *
 * Day 3:  "How's it going?" check-in SMS + email if client hasn't seen any alerts yet
 * Day 14: Success report email — candidates found, alerts fired, ROI context
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
      to: [to],
      subject,
      html,
    }),
  }).catch((e) => console.error("[hire-alert-client-drip] email error:", e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: clients, error } = await sb
      .from("hire_alert_clients")
      .select("id, owner_email, owner_phone, company_name, created_at, dashboard_token, target_roles")
      .or("active.eq.true,trial_status.eq.active");

    if (error) throw error;
    if (!clients?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let day3Sent = 0;
    let day14Sent = 0;

    for (const client of clients as any[]) {
      const days = daysSince(client.created_at);
      const name = client.company_name || "there";
      const dashUrl = client.dashboard_token
        ? `https://detroitwebagent.com/talent-radar/dashboard?token=${client.dashboard_token}`
        : "https://detroitwebagent.com";

      // ── Day 3 check-in ──────────────────────────────────────────────────
      if (days === 3) {
        // Check if they've received any alerts yet
        const { count: alertCount } = await sb
          .from("hire_alert_client_candidates")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id);

        const hasAlerts = (alertCount ?? 0) > 0;

        if (client.owner_phone) {
          const msg = hasAlerts
            ? `Hey ${name} — Matt from Detroit Web Agency. Talent Radar found some candidates for you this week. Any questions about the dashboard? Text me back. (313) 992-1219`
            : `Hey ${name} — Matt from Detroit Web Agency. Talent Radar is running every morning. It monitors ${(client.target_roles || []).length} role types for you. Most clients see their first candidate within 3-7 days. Questions? Text me back.`;
          await sendSMS(client.owner_phone, TWILIO_PHONE_NUMBER, msg, "hire_alert_drip_day3").catch(() => {});
          day3Sent++;
        }

        if (client.owner_email) {
          await sendEmail(
            client.owner_email,
            `Day 3 — Your Talent Radar is Running`,
            `<div style="background:#0a1628;padding:32px;font-family:sans-serif;color:#fff;max-width:600px;margin:0 auto;">
              <p style="color:#00d4ff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">TALENT RADAR — DAY 3</p>
              <h2 style="font-size:24px;font-weight:800;margin:0 0 16px;">Your monitor is live. Here's what to expect.</h2>
              <p style="color:#94a3b8;line-height:1.7;margin:0 0 20px;">
                ${hasAlerts
                  ? `We've already found candidates matching your target trades. Check your dashboard to see who's available and claim the ones you want before another company does.`
                  : `Talent Radar scans Michigan's public license database every morning at 7am. Most clients see their first candidate within 3–7 days. When a match appears, you'll get a text and email immediately.`
                }
              </p>
              ${hasAlerts ? `<a href="${dashUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;font-weight:800;text-decoration:none;margin-bottom:20px;">View Your Candidates →</a>` : ""}
              <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 16px;">
                <strong style="color:#fff;">Your dashboard:</strong> <a href="${dashUrl}" style="color:#00d4ff;">${dashUrl}</a><br>
                Bookmark it — this is where all your candidates live.
              </p>
              <p style="color:#94a3b8;font-size:14px;margin:0;">— Matt Michels, Detroit Web Agency<br>
              <a href="sms:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
            </div>`
          );
        }
      }

      // ── Day 14 success report ────────────────────────────────────────────
      if (days === 14) {
        const { count: totalCandidates } = await sb
          .from("hire_alert_client_candidates")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id);

        const { count: hotCandidates } = await sb
          .from("hire_alert_client_candidates")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id)
          .gte("score", 7);

        const total = totalCandidates ?? 0;
        const hot = hotCandidates ?? 0;

        if (client.owner_email) {
          await sendEmail(
            client.owner_email,
            `Your Talent Radar — 14-Day Report`,
            `<div style="background:#0a1628;padding:32px;font-family:sans-serif;color:#fff;max-width:600px;margin:0 auto;">
              <p style="color:#00d4ff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">TALENT RADAR — 14-DAY REPORT</p>
              <h2 style="font-size:24px;font-weight:800;margin:0 0 8px;">Here's what we found in your first two weeks.</h2>
              <p style="color:#94a3b8;margin:0 0 28px;">For ${name}</p>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px;">
                <div style="background:#0d1f2e;border:1px solid #1e3a5f;border-radius:10px;padding:20px;text-align:center;">
                  <div style="font-size:36px;font-weight:800;color:#00d4ff;">${total}</div>
                  <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Candidates Found</div>
                </div>
                <div style="background:#0d1f2e;border:1px solid #1e3a5f;border-radius:10px;padding:20px;text-align:center;">
                  <div style="font-size:36px;font-weight:800;color:#22c55e;">${hot}</div>
                  <div style="color:#94a3b8;font-size:13px;margin-top:4px;">High-Score Alerts (7+)</div>
                </div>
              </div>

              ${total > 0
                ? `<p style="color:#94a3b8;line-height:1.7;margin:0 0 20px;">
                    Each of these candidates was sourced from Michigan's public license database — information your competitors don't have automated access to.
                    A single hire from Talent Radar saves <strong style="color:#fff;">$12,000–$18,000</strong> compared to a staffing agency.
                  </p>`
                : `<p style="color:#94a3b8;line-height:1.7;margin:0 0 20px;">
                    The monitor is running every day. Trade license activity in Michigan fluctuates — slower months (Jan/Feb) typically pick up in spring.
                    If you'd like to expand your target roles or geography, just reply to this email and I'll update your account.
                  </p>`
              }


              <a href="${dashUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;font-weight:800;text-decoration:none;margin-bottom:24px;">Open Your Dashboard →</a>

              <p style="color:#94a3b8;font-size:14px;margin:0;">Questions or feedback? Reply to this email or text me directly.<br>
              — Matt Michels, Detroit Web Agency<br>
              <a href="sms:+13139921219" style="color:#00d4ff;">(313) 992-1219</a></p>
            </div>`
          );
          day14Sent++;

          // Zero-alert flag — notify Matt so he can adjust roles/geo
          if (total === 0) {
            const roles = (client.target_roles || []).join(", ") || "none set";
            await sendSMS(
              ADMIN_PHONE,
              TWILIO_PHONE_NUMBER,
              `⚠️ TechAlert zero-alert: ${name} (${client.owner_email || "no email"}) — 14 days active, 0 candidates. Roles: ${roles}. Consider expanding trades or geo.`,
              "hire_alert_zero_alert"
            ).catch(() => {});
          }
        }
      }
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "hire-alert-client-drip",
      last_beat: new Date().toISOString(),
      metadata: { day3_sent: day3Sent, day14_sent: day14Sent, clients_checked: clients.length },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ success: true, day3_sent: day3Sent, day14_sent: day14Sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[hire-alert-client-drip] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// email-deliverability-check — Daily cron 10am ET (14:00 UTC).
// Monitors cold email deliverability health via Resend API stats.
// If bounce rate > 5% or spam complaints > 0.1%, SMS Matt immediately
// AND auto-pauses cold_email_ramp_state to protect domain reputation.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const BOUNCE_THRESHOLD = 0.05;   // 5%
const SPAM_THRESHOLD = 0.001;    // 0.1% — Gmail blacklists above 0.1%

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const issues: string[] = [];
  const stats: Record<string, unknown> = {};
  let pausedRampState = false;

  try {
    // Fetch Resend domain stats for the last 7 days
    if (RESEND_API_KEY) {
      const domainRes = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });

      if (domainRes.ok) {
        const domainData = await domainRes.json() as { data?: Array<{ id: string; name: string; status: string }> };
        const domains = domainData?.data ?? [];
        stats.domains = domains.map((d) => ({ name: d.name, status: d.status }));

        // Check for unverified SPF/DKIM (domain status != "verified")
        const unverified = domains.filter((d) => d.status !== "verified");
        if (unverified.length > 0) {
          issues.push(`SPF/DKIM unverified for: ${unverified.map((d) => d.name).join(", ")}`);
        }
      }

      // Fetch email stats — Resend /emails endpoint with date filter
      const since = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      const statsRes = await fetch(`https://api.resend.com/emails?limit=100&date_from=${since}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });

      if (statsRes.ok) {
        const emailData = await statsRes.json() as { data?: Array<{ last_event?: string }> };
        const emails = emailData?.data ?? [];
        const total = emails.length;
        const bounced = emails.filter((e) => e.last_event === "bounced").length;
        const complained = emails.filter((e) => e.last_event === "complained").length;

        const bounceRate = total > 0 ? bounced / total : 0;
        const spamRate = total > 0 ? complained / total : 0;

        stats.total_emails_7d = total;
        stats.bounced = bounced;
        stats.complained = complained;
        stats.bounce_rate_pct = Math.round(bounceRate * 1000) / 10;
        stats.spam_rate_pct = Math.round(spamRate * 10000) / 100;

        if (bounceRate > BOUNCE_THRESHOLD) {
          issues.push(`HIGH BOUNCE RATE: ${stats.bounce_rate_pct}% (threshold: ${BOUNCE_THRESHOLD * 100}%)`);
        }
        if (spamRate > SPAM_THRESHOLD) {
          issues.push(`HIGH SPAM COMPLAINTS: ${stats.spam_rate_pct}% (threshold: ${SPAM_THRESHOLD * 100}%)`);
          // Auto-pause cold email pipeline to protect domain reputation
          try {
            await sb.from("cold_email_ramp_state").update({
              paused: true,
              pause_reason: `Auto-paused ${new Date().toISOString().split("T")[0]}: complaint rate ${stats.spam_rate_pct}% exceeds ${SPAM_THRESHOLD * 100}% threshold`,
              updated_at: new Date().toISOString(),
            }).eq("id", 1);
            pausedRampState = true;
          } catch (e) {
            console.error("[email-deliverability-check] failed to pause ramp state:", e);
          }
        }
      }
    }

    // Alert Matt if any issues found
    if (issues.length > 0) {
      const pauseNote = pausedRampState ? "\n⛔ Cold email pipeline AUTO-PAUSED." : "";
      const msg = `🚨 EMAIL DELIVERABILITY ALERT\n${issues.join("\n")}${pauseNote}\nCheck Resend dashboard immediately — domain blacklist kills all cold email pipelines.`;
      await sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, msg, "deliverability_alert");
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "email-deliverability-check",
      last_beat: new Date().toISOString(),
      status: issues.length > 0 ? "warning" : "ok",
      metadata: { issues, paused_ramp_state: pausedRampState, ...stats },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, issues, paused_ramp_state: pausedRampState, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

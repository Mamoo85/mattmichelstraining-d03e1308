// hire-alert-trial-convert — cron: every hour
// Finds trial clients where trial_status='active' AND trial_ends_at <= now()
// Counts candidates found during their trial, sends conversion SMS + email, sets trial_status='expired'

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const SITE_URL = "https://detroitwebagent.com";
const FROM_EMAIL = "TechAlert <matt@detroitwebagent.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = new Date();

    // ── Mid-trial drip: Day 1 / Day 3 / Day 6 nurture emails ─────────────────
    // Runs alongside the expiry check every hour. Uses trial_started_at windows.
    const dripResults = { d1: 0, d3: 0, d6: 0 };
    if (RESEND_API_KEY) {
      const activeTrials = await sb
        .from("hire_alert_clients")
        .select("id, owner_email, owner_name, company_name, phone, trial_started_at, trial_drip_d1_sent_at, trial_drip_d3_sent_at, trial_drip_d6_sent_at")
        .eq("trial_status", "active")
        .not("trial_started_at", "is", null);

      for (const client of (activeTrials.data || [])) {
        if (!client.owner_email || !client.trial_started_at) continue;
        const started = new Date(client.trial_started_at);
        const hoursIn = (now.getTime() - started.getTime()) / 3600000;
        const firstName = client.owner_name?.split(" ")[0] || client.company_name || "there";
        const checkoutUrl = `${SITE_URL}/hire-alert?prefilled_email=${encodeURIComponent(client.owner_email)}`;

        // Count candidates found so far
        const { count: candidateSoFar } = await sb
          .from("hire_alert_candidates")
          .select("id", { count: "exact", head: true })
          .gte("created_at", client.trial_started_at);
        const found = candidateSoFar || 0;

        // Day 1 (20-28h window): "Welcome + first signal"
        if (hoursIn >= 20 && hoursIn < 28 && !client.trial_drip_d1_sent_at) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: FROM_EMAIL, to: [client.owner_email],
              subject: `You're in — here's what TechAlert found on Day 1`,
              html: `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7">
<p>Hey ${firstName},</p>
<p>Welcome to TechAlert. Your scanner has been running for 24 hours — and it's already found <strong>${found} candidate signal${found !== 1 ? "s" : ""}</strong> matching your criteria.</p>
<p>These are real companies actively hiring tradespeople in your market. The signal score tells you how urgent their need is.</p>
<p>We'll keep scanning every day. Reply here if you have questions — I read every one.</p>
<p>— Matt @ Detroit Web Agency</p>
</div>`,
            }),
          });
          await sb.from("hire_alert_clients").update({ trial_drip_d1_sent_at: now.toISOString() }).eq("id", client.id);
          dripResults.d1++;
        }

        // Day 3 (68-76h window): "Here's what we've found so far"
        if (hoursIn >= 68 && hoursIn < 76 && !client.trial_drip_d3_sent_at) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: FROM_EMAIL, to: [client.owner_email],
              subject: `TechAlert Day 3 update — ${found} signal${found !== 1 ? "s" : ""} found`,
              html: `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7">
<p>Hey ${firstName},</p>
<p>Halfway through your trial — TechAlert has identified <strong>${found} candidate signal${found !== 1 ? "s" : ""}</strong> in your market so far.</p>
<p>${found > 0 ? "Each one represents a company that's actively looking for tradespeople like you. The window to reach out first is short." : "The market's been quiet this week, but that changes fast — and when it does, you'll want to be first in line."}</p>
<p>Your trial ends in 3 more days. <a href="${checkoutUrl}">Upgrade to keep the alerts coming →</a></p>
<p>— Matt</p>
</div>`,
            }),
          });
          await sb.from("hire_alert_clients").update({ trial_drip_d3_sent_at: now.toISOString() }).eq("id", client.id);
          dripResults.d3++;
        }

        // Day 6 (140-148h window): "Trial ends tomorrow"
        if (hoursIn >= 140 && hoursIn < 148 && !client.trial_drip_d6_sent_at) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: FROM_EMAIL, to: [client.owner_email],
              subject: `Your TechAlert trial ends tomorrow`,
              html: `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7">
<p>Hey ${firstName},</p>
<p>Your trial wraps up tomorrow. In 7 days, TechAlert found <strong>${found} candidate signal${found !== 1 ? "s" : ""}</strong> in your market.</p>
<p>After your trial ends, the scanner stops and you'll miss new signals as they come in. At $149/mo that's about $5/day to know exactly which companies in your area are actively searching for your trade.</p>
<p><a href="${checkoutUrl}" style="display:inline-block;background:#0a1628;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Keep My Alerts Running →</a></p>
<p>— Matt</p>
</div>`,
            }),
          });
          await sb.from("hire_alert_clients").update({ trial_drip_d6_sent_at: now.toISOString() }).eq("id", client.id);
          dripResults.d6++;
        }
      }
    }

    // ── Find trials that have just expired ────────────────────────────────────
    const { data: expiredTrials } = await sb
      .from("hire_alert_clients")
      .select("*")
      .eq("trial_status", "active")
      .lte("trial_ends_at", now.toISOString())
      .limit(20);

    if (!expiredTrials?.length) {
      return new Response(JSON.stringify({ ok: true, converted: 0, drip: dripResults }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[hire-alert-trial-convert] Processing ${expiredTrials.length} expired trials`);

    for (const client of expiredTrials) {
      try {
        // Mark expired immediately to prevent double-processing
        await sb.from("hire_alert_clients")
          .update({ trial_status: "expired" })
          .eq("id", client.id);

        // Count candidates found during the trial window
        const { count } = await sb
          .from("hire_alert_candidates")
          .select("*", { count: "exact", head: true })
          .gte("created_at", client.trial_started_at || client.trial_ends_at)
          .lte("created_at", client.trial_ends_at);

        const candidateCount = count || 0;
        const firstName = client.owner_name?.split(" ")[0] || client.company_name || "there";
        const checkoutUrl = `${SITE_URL}/hire-alert?prefilled_email=${encodeURIComponent(client.owner_email || "")}`;

        // SMS conversion pitch
        if (client.phone) {
          const smsBody = candidateCount > 0
            ? `Hey ${firstName} — your TechAlert trial just ended. We found ${candidateCount} candidate${candidateCount !== 1 ? "s" : ""} during your 3 days. Upgrade to $99/mo to keep the alerts coming: ${checkoutUrl}\n\n— Matt`
            : `Hey ${firstName} — your TechAlert trial just ended. The market's been quiet, but that changes fast. Upgrade to $99/mo so you're first in line when a 10/10 candidate drops: ${checkoutUrl}\n\n— Matt`;

          await sendSMS(client.phone, TWILIO_PHONE_NUMBER, smsBody, "hire_alert");
        }

        // Email conversion
        if (RESEND_API_KEY && client.owner_email) {
          const subjectLine = candidateCount > 0
            ? `Your trial found ${candidateCount} candidate${candidateCount !== 1 ? "s" : ""} — keep the alerts going?`
            : `Your TechAlert trial just ended — here's what's next`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [client.owner_email],
              reply_to: "matt@detroitwebagent.com",
              subject: subjectLine,
              html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a1628;padding:32px;border-radius:12px;max-width:520px;margin:0 auto;">
<p style="color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">⚡ TECHALERT — TRIAL ENDED</p>
<h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 16px;">Hey ${firstName} — your 3-day trial is up.</h2>
${candidateCount > 0
  ? `<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 16px;">During your trial, TechAlert spotted <strong style="color:#00d4ff;">${candidateCount} candidate${candidateCount !== 1 ? "s" : ""}</strong> in your area. The market moves fast — don't miss the next one.</p>`
  : `<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 16px;">The market's been relatively quiet — but that's exactly when you want to have alerts running. When a 10/10 candidate drops, the first call wins.</p>`
}
<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">Keep TechAlert running for $99/mo — cancel anytime. No setup fees.</p>
<a href="${checkoutUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;font-weight:800;font-size:15px;text-decoration:none;">Upgrade to $99/mo →</a>
<p style="color:#475569;font-size:13px;margin:24px 0 0;">Questions? Text me: (313) 992-1219</p>
</div>`,
            }),
          });
        }

        console.log(`[hire-alert-trial-convert] Processed ${client.owner_email} — found ${candidateCount} candidates during trial`);
      } catch (e) {
        console.error(`[hire-alert-trial-convert] Error processing ${client.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, converted: expiredTrials.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hire-alert-trial-convert] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

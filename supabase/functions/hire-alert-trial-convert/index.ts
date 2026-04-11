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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Find trials that have just expired
    const { data: expiredTrials } = await sb
      .from("hire_alert_clients")
      .select("*")
      .eq("trial_status", "active")
      .lte("trial_ends_at", new Date().toISOString())
      .limit(20);

    if (!expiredTrials?.length) {
      return new Response(JSON.stringify({ ok: true, converted: 0 }), { status: 200 });
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
<p style="color:#475569;font-size:13px;margin:24px 0 0;">Questions? Text me: (313) 806-4952</p>
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
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hire-alert-trial-convert] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

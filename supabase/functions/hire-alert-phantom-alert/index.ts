// hire-alert-phantom-alert — cron: daily 8:30am ET
// Finds clients where trial_status='expired' AND trial_ends_at was 72-96h ago
// Finds 1 real new candidate added in last 24h
// Sends FOMO SMS: "Trial ended but we just found a top candidate today"
// Sets trial_status = 'phantom_sent'

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const SITE_URL = "https://detroitwebagency.com";
const FROM_EMAIL = "TechAlert <matt@detroitwebagency.com>";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const now = new Date();
    const cutoff96h = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString();
    const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Clients whose trial ended 72-96h ago (phantom window)
    const { data: phantomClients } = await sb
      .from("hire_alert_clients")
      .select("*")
      .eq("trial_status", "expired")
      .gte("trial_ends_at", cutoff96h)
      .lte("trial_ends_at", cutoff72h)
      .limit(20);

    if (!phantomClients?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    // Find 1 fresh high-score candidate from last 24h
    const { data: freshCandidates } = await sb
      .from("hire_alert_candidates")
      .select("full_name, license_type, city, availability_score, source")
      .gte("created_at", cutoff24h)
      .gte("availability_score", 7)
      .order("availability_score", { ascending: false })
      .limit(1);

    const freshCandidate = freshCandidates?.[0];

    let sentCount = 0;

    for (const client of phantomClients) {
      try {
        // Mark phantom_sent immediately
        await sb.from("hire_alert_clients")
          .update({ trial_status: "phantom_sent" })
          .eq("id", client.id);

        const firstName = client.owner_name?.split(" ")[0] || client.company_name || "there";
        const checkoutUrl = `${SITE_URL}/hire-alert`;
        const tradeLabel = (client.target_roles?.[0] || "tradesperson").toLowerCase();

        if (client.phone && freshCandidate) {
          // Real candidate — FOMO SMS
          await sendSMS(
            client.phone,
            TWILIO_PHONE_NUMBER,
            `Hey ${firstName} — your trial ended, but we just found a top-tier ${freshCandidate.license_type || tradeLabel} in ${freshCandidate.city || "Metro Detroit"} today (score: ${freshCandidate.availability_score}/10).\n\nWe can't show you their contact info without an active plan.\n\nUpgrade to $99/mo to unlock it: ${checkoutUrl}\n\n— Matt`,
            "hire_alert"
          );
        } else if (client.phone) {
          // No fresh candidate today — softer FOMO
          await sendSMS(
            client.phone,
            TWILIO_PHONE_NUMBER,
            `Hey ${firstName} — the alerts kept scanning after your trial ended. We're seeing ${tradeLabel}s enter the market this week.\n\nUpgrade to $99/mo to unlock contact info when we find your next match: ${checkoutUrl}\n\n— Matt`,
            "hire_alert"
          );
        }

        // Email phantom alert
        if (RESEND_API_KEY && client.owner_email && freshCandidate) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [client.owner_email],
              reply_to: "matt@detroitwebagency.com",
              subject: `We found a ${freshCandidate.availability_score}/10 ${freshCandidate.license_type || tradeLabel} today — your trial ended`,
              html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a1628;padding:32px;border-radius:12px;max-width:520px;margin:0 auto;">
<p style="color:#e8621a;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">⚡ TECHALERT — CANDIDATE FOUND</p>
<h2 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 16px;">Hey ${firstName} — we found someone today.</h2>
<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 16px;">Your trial ended, but TechAlert kept scanning. This morning we found a <strong style="color:#00d4ff;">${freshCandidate.license_type || tradeLabel}</strong> in <strong style="color:#00d4ff;">${freshCandidate.city || "Metro Detroit"}</strong> — availability score: <strong style="color:#00d4ff;">${freshCandidate.availability_score}/10</strong>.</p>
<div style="background:#0f2342;border:1px solid #1e3a5f;border-radius:10px;padding:20px;margin:0 0 24px;">
  <p style="color:#64748b;font-size:12px;margin:0 0 4px;font-weight:700;letter-spacing:0.5px;">CANDIDATE PREVIEW</p>
  <p style="color:#fff;font-size:18px;font-weight:800;margin:0 0 8px;">████████ ████████</p>
  <p style="color:#94a3b8;font-size:14px;margin:0 0 4px;">${freshCandidate.license_type || tradeLabel} · ${freshCandidate.city || "Metro Detroit"}</p>
  <p style="color:#64748b;font-size:13px;margin:0;">Contact info locked — upgrade to unlock</p>
</div>
<a href="${checkoutUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;font-weight:800;font-size:15px;text-decoration:none;">Unlock for $99/mo →</a>
<p style="color:#475569;font-size:13px;margin:24px 0 0;">Cancel anytime. No contracts. Text Matt: (313) 806-4952</p>
</div>`,
            }),
          });
        }

        sentCount++;
        console.log(`[hire-alert-phantom-alert] Sent phantom alert to ${client.owner_email}`);
      } catch (e) {
        console.error(`[hire-alert-phantom-alert] Error for ${client.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: sentCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hire-alert-phantom-alert] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

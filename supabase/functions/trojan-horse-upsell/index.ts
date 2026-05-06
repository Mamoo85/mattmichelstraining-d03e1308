// trojan-horse-upsell — Daily cross-sell engine (runs daily at 10am ET)
// Finds TechAlert clients who:
//   1. Signed up 30+ days ago
//   2. DON'T have FieldDesk (no matching field_crm_clients record)
//   3. Haven't been upsold in the last 14 days
// Sends personalized SMS + email with FieldDesk offer.
// "50% off first month when you add FieldDesk to your TechAlert plan."
//
// DATABASE TABLES USED:
//   - hire_alert_clients (read — find TechAlert clients)
//   - field_crm_clients (read — check for existing FieldDesk subscription)
//   - trojan_horse_log (write — track upsell attempts, prevent spam)
//
// CRON: 0 14 * * * (10am ET daily)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const FIELDDESK_URL = "https://detroitwebagent.com/field-service";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Cross-sell SMS templates (rotate for freshness) ─────────────────────────
const SMS_TEMPLATES = [
  {
    day: 30,
    msg: `Hey {name} — Matt from Detroit Web Agency. You've been on TechAlert for a month now. Quick question: are you still dispatching jobs with spreadsheets or eWay? I built FieldDesk specifically for shops like yours. 50% off first month if you add it. Text me back.`,
  },
  {
    day: 45,
    msg: `{name}, Matt here. TechAlert is finding you candidates — but are you losing revenue on dispatch? FieldDesk replaces FieldServio/ServiceTitan for $199/mo flat. No per-tech fees. 50% off your first month since you're already a TechAlert partner. Reply YES for a quick demo.`,
  },
  {
    day: 60,
    msg: `{name} — last check-in from Detroit Web Agency. Your TechAlert subscription helped you find techs. FieldDesk helps you keep them productive. $99.50 first month (50% partner discount). After that it's $199/mo flat. Text YES or call me: (313) 992-1219`,
  },
];

// ── Cross-sell email HTML ───────────────────────────────────────────────────
function buildUpsellEmail(
  companyName: string,
  daysSinceSignup: number
): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="color:#00d4ff;font-weight:800;font-size:14px;letter-spacing:2px;">DETROIT WEB AGENCY</span>
    </div>
    
    <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 16px;text-align:center;">
      You're Finding Techs.<br/>
      <span style="color:#00d4ff;">Now Dispatch Them Like a Pro.</span>
    </h1>
    
    <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;text-align:center;">
      ${companyName}, you've been on TechAlert for ${daysSinceSignup} days. Our scanner has been finding candidates for you every morning at 7am.
    </p>
    
    <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;text-align:center;">
      But here's the thing — once you hire those techs, <strong style="color:#fff;">how are you dispatching them?</strong>
      If you're using spreadsheets, whiteboards, or eWay... you're leaking revenue.
    </p>
    
    <div style="background:#001a33;border:2px solid #00d4ff;border-radius:12px;padding:28px;margin:0 0 24px;">
      <h2 style="color:#00d4ff;font-size:18px;font-weight:800;margin:0 0 12px;">FieldDesk — $199/mo flat</h2>
      <ul style="list-style:none;padding:0;margin:0;">
        ${["Live dispatch map — see every tech", "Mobile tech app — one-tap status updates", "Auto-SMS — customer gets notified automatically", "Invoicing → QuickBooks sync", "Unlimited users — no per-tech fees"].map(f => `<li style="padding:4px 0;color:#cbd5e1;font-size:14px;">✓ ${f}</li>`).join("")}
      </ul>
      <div style="margin-top:16px;padding:12px;background:#00d4ff15;border-radius:8px;text-align:center;">
        <span style="color:#f97316;font-weight:800;font-size:16px;">TechAlert Partner Exclusive: 50% off first month</span>
        <br/>
        <span style="color:#94a3b8;font-size:13px;">$99.50 first month → $199/mo after</span>
      </div>
    </div>
    
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${FIELDDESK_URL}?ref=trojan-horse&utm_source=upsell" 
         style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:8px;font-weight:800;font-size:16px;text-decoration:none;">
        See FieldDesk Demo →
      </a>
    </div>
    
    <div style="text-align:center;">
      <p style="color:#64748b;font-size:13px;margin:0 0 8px;">Or just text Matt:</p>
      <a href="sms:+13139921219" style="color:#00d4ff;font-weight:800;font-size:15px;text-decoration:none;">(313) 992-1219</a>
    </div>
    
    <hr style="border:none;border-top:1px solid #1e3a5f;margin:32px 0 16px;" />
    <p style="color:#475569;font-size:11px;text-align:center;margin:0;">
      Detroit Web Agency · Grosse Pointe, MI · You're receiving this because you're a TechAlert subscriber.
    </p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const fourteenDaysAgo = new Date(
    now.getTime() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  let upsellsSent = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // ── Step 1: Find TechAlert clients signed up 30+ days ago ─────────────
    const { data: techAlertClients } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, owner_email, owner_phone, created_at")
      .eq("active", true)
      .lte("created_at", thirtyDaysAgo);

    if (!techAlertClients?.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No TechAlert clients eligible for upsell (none 30+ days old)",
          upsells_sent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const client of techAlertClients) {
      try {
        // ── Step 2: Check if they already have FieldDesk ────────────────
        const { data: fieldDeskMatch } = await sb
          .from("field_crm_clients")
          .select("id")
          .ilike("email", client.owner_email)
          .limit(1);

        if (fieldDeskMatch && fieldDeskMatch.length > 0) {
          skipped++;
          continue; // Already a FieldDesk customer — skip
        }

        // ── Step 3: Check if we already upsold recently ─────────────────
        const { data: recentUpsell } = await sb
          .from("trojan_horse_log")
          .select("id")
          .eq("hire_alert_client_id", client.id)
          .gte("sent_at", fourteenDaysAgo)
          .limit(1);

        if (recentUpsell && recentUpsell.length > 0) {
          skipped++;
          continue; // Already upsold in the last 14 days — skip
        }

        // ── Step 4: Determine which template to use ─────────────────────
        const daysSinceSignup = Math.floor(
          (now.getTime() - new Date(client.created_at).getTime()) /
            (24 * 60 * 60 * 1000)
        );
        const template =
          SMS_TEMPLATES.find((t) => daysSinceSignup >= t.day) ||
          SMS_TEMPLATES[0];
        const smsBody = template.msg
          .replace("{name}", client.company_name || "there")
          .replace("{name}", client.company_name || "there");

        // ── Step 5: Send SMS (if phone exists + opt-out check) ──────────
        let smsSent = false;
        if (client.owner_phone) {
          // Check SMS opt-outs (TCPA compliance)
          const phone = client.owner_phone.replace(/\D/g, "");
          const e164 = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
          const { data: optOut } = await sb
            .from("sms_opt_outs")
            .select("id")
            .eq("phone", e164)
            .limit(1);

          if (!optOut?.length) {
            await sendSMS(e164, smsBody);
            smsSent = true;
          }
        }

        // ── Step 6: Send email ──────────────────────────────────────────
        let emailSent = false;
        if (RESEND_API_KEY && client.owner_email) {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Matt at Detroit Web Agency <matt@detroitwebagent.com>",
              to: [client.owner_email],
              subject: `${client.company_name}: You're finding techs — now dispatch them like a pro`,
              html: buildUpsellEmail(
                client.company_name,
                daysSinceSignup
              ),
            }),
          });
          emailSent = emailRes.ok;
        }

        // ── Step 7: Log the upsell attempt ──────────────────────────────
        await sb.from("trojan_horse_log").insert({
          hire_alert_client_id: client.id,
          company_name: client.company_name,
          email: client.owner_email,
          phone: client.owner_phone,
          days_since_signup: daysSinceSignup,
          sms_sent: smsSent,
          email_sent: emailSent,
          template_day: template.day,
          sent_at: now.toISOString(),
        });

        upsellsSent++;
      } catch (clientErr) {
        const msg =
          clientErr instanceof Error ? clientErr.message : String(clientErr);
        errors.push(`${client.company_name}: ${msg}`);
      }
    }

    // ── Step 8: Notify Matt with summary ──────────────────────────────────
    if (upsellsSent > 0) {
      const summaryMsg = `🎯 Trojan Horse: ${upsellsSent} FieldDesk upsell${upsellsSent === 1 ? "" : "s"} sent today (${skipped} skipped — already have FieldDesk or recently upsold)${errors.length ? `. ${errors.length} errors.` : "."}`;
      await sendSMS(ADMIN_PHONE, summaryMsg);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        upsells_sent: upsellsSent,
        skipped,
        errors: errors.length,
        total_eligible: techAlertClients.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[trojan-horse-upsell] Fatal error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

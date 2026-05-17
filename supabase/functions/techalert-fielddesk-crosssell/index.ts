// techalert-fielddesk-crosssell — Day-30 automated cross-sell from TechAlert to FieldDesk
// Runs daily at 10am ET via cron. Finds TechAlert clients who joined ~30 days ago,
// sends a personalized 50%-off FieldDesk pitch via email + SMS notification to Matt.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateCrossSellEmail(companyName: string): Promise<string> {
  if (!LOVABLE_API_KEY) return getDefaultEmail(companyName);

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `Write a short, warm cross-sell email body (HTML, 3-4 paragraphs) for a company called "${companyName}". They've been using TechAlert (hiring monitor) for 30 days. Pitch them FieldDesk — a field service CRM that replaces eWay CRM, works offline in boiler rooms, and doesn't charge per-technician. Offer: 50% off the first month ($99 instead of $199). Tone: direct, Michigan blue-collar, no corporate buzzwords, no AI mentions. End with a CTA to click the link below.`,
        }],
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) return getDefaultEmail(companyName);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || getDefaultEmail(companyName);
  } catch {
    return getDefaultEmail(companyName);
  }
}

function getDefaultEmail(companyName: string): string {
  return `<p>Hey ${companyName} team,</p>
<p>You've been getting candidate alerts from TechAlert for 30 days now — hope it's been saving you time finding good techs.</p>
<p>Since you're already in the system, I wanted to offer you <strong>50% off your first month of FieldDesk</strong> — our field service CRM built for HVAC/plumbing/boiler companies. It replaces eWay CRM, works offline in boiler rooms, and doesn't charge per technician. That's <strong>$99 instead of $199</strong> for month one.</p>
<p>Click the link below to get set up — takes about 5 minutes.</p>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find clients who joined ~30 days ago (28-32 day window) and haven't gotten the cross-sell
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 32);
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

    const { data: clients, error } = await sb
      .from("hire_alert_clients")
      .select("id, owner_email, company_name, owner_phone")
      .eq("active", true)
      .eq("fielddesk_cross_sell_sent", false)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .lte("created_at", twentyEightDaysAgo.toISOString())
      // Guard: skip Matt's own test accounts
      .not("owner_email", "ilike", "%detroitwebagent.com")
      .not("owner_email", "ilike", "%mattmichelstraining.com")
      .not("owner_email", "ilike", "matt@%");

    if (error) throw error;
    if (!clients?.length) {
      console.log("[CROSSSELL] No eligible clients today");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const client of clients) {
      const companyName = client.company_name || "your company";
      const emailBody = await generateCrossSellEmail(companyName);

      // Build checkout link with coupon param
      const checkoutUrl = `${SUPABASE_URL}/functions/v1/create-field-crm-checkout`;
      const ctaUrl = `https://detroitwebagent.com/field-service?coupon=TECHALERT50&email=${encodeURIComponent(client.owner_email)}&biz=${encodeURIComponent(companyName)}`;

      // Send email via Resend
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Matt Michels <matt@detroitwebagent.com>",
          to: [client.owner_email],
          subject: `${companyName} — 50% off FieldDesk (TechAlert perk)`,
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0a1628;padding:20px 28px;border-bottom:3px solid #00d4ff">
    <p style="color:#00d4ff;font-weight:700;font-size:11px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 4px">Detroit Web Agency</p>
    <h1 style="color:#fff;margin:0;font-size:20px">FieldDesk — 50% Off Your First Month</h1>
  </div>
  <div style="padding:24px 28px;color:#1e293b;font-size:15px;line-height:1.8">
    ${emailBody}
    <div style="text-align:center;margin:24px 0">
      <a href="${ctaUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Get FieldDesk — $99 First Month →</a>
    </div>
  </div>
  <div style="padding:16px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center">
    Detroit Web Agency · Grosse Pointe, MI · <a href="mailto:matt@detroitwebagent.com" style="color:#00d4ff">matt@detroitwebagent.com</a>
  </div>
</div></body></html>`,
        }),
      });

      if (emailRes.ok) {
        // Mark cross-sell as sent
        await sb
          .from("hire_alert_clients")
          .update({ fielddesk_cross_sell_sent: true })
          .eq("id", client.id);

        sent++;
        console.log(`[CROSSSELL] Sent to ${client.owner_email}`);
      } else {
        console.error(`[CROSSSELL] Email failed for ${client.owner_email}: ${await emailRes.text()}`);
      }
    }

    // Notify Matt
    if (sent > 0) {
      await sendSMS(
        ADMIN_PHONE,
        TWILIO_PHONE,
        `🔄 TechAlert→FieldDesk cross-sell fired for ${sent} client${sent > 1 ? "s" : ""}. Check email for details.`,
        "techalert_crosssell"
      );
    }

    // Heartbeat
    await sb.from("agent_heartbeats").upsert(
      { agent_name: "techalert-fielddesk-crosssell", last_beat: new Date().toISOString(), metadata: { sent } },
      { onConflict: "agent_name" }
    );

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CROSSSELL] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

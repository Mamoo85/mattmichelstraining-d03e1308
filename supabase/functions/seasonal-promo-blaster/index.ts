// Seasonal Promo Blaster — HTTP POST trigger or cron
// Sends AI-crafted seasonal promotional SMS + email blasts to client customer lists

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notifyMatt(subject: string, html: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² System <matt@mattmichelstraining.com>",
      to: ["matt@mattmichelstraining.com"],
      subject,
      html,
    }),
  });
}

function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "Spring";
  if (month >= 6 && month <= 8) return "Summer";
  if (month >= 9 && month <= 11) return "Fall";
  return "Winter";
}

function getUpcomingHoliday(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  if (month === 1) return "New Year";
  if (month === 2 && day < 15) return "Valentine's Day";
  if (month === 3) return "Spring Season";
  if (month === 4) return "Spring";
  if (month === 5 && day < 10) return "Mother's Day";
  if (month === 5) return "Memorial Day";
  if (month === 6) return "Father's Day";
  if (month === 7 && day < 5) return "4th of July";
  if (month === 7) return "Summer";
  if (month === 8) return "Back to School";
  if (month === 9) return "Labor Day";
  if (month === 10 && day > 20) return "Halloween";
  if (month === 10) return "Fall Season";
  if (month === 11 && day < 20) return "Veterans Day";
  if (month === 11) return "Thanksgiving";
  if (month === 12 && day < 20) return "Holiday Season";
  return "Christmas";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = req.headers.get("content-type")?.includes("json")
      ? await req.json().catch(() => ({}))
      : {};

    // Support both targeted (single clientId) and bulk (all active) modes
    const { clientId, promoTopic, customOffer } = body;

    let clients;
    if (clientId) {
      const { data, error } = await sb
        .from("promo_blaster_clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Client not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      clients = [data];
    } else {
      // Cron mode: find clients whose next_blast_at <= now
      const { data, error } = await sb
        .from("promo_blaster_clients")
        .select("*")
        .eq("active", true)
        .lte("next_blast_at", new Date().toISOString());

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      clients = data || [];
    }

    if (!clients?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No clients due for blast" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const season = getCurrentSeason();
    const holiday = getUpcomingHoliday();
    const todayStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    let processed = 0;
    let failed = 0;
    let totalSmsSent = 0;
    let totalEmailsSent = 0;

    for (const client of clients) {
      try {
        const businessName = client.business_name || "our business";
        const businessType = client.business_type || "local business";
        const offer = customOffer || client.current_offer || `${season} special — contact us for details`;
        const topic = promoTopic || holiday;

        // Generate promo content via Claude
        const prompt = `You are a marketing copywriter for ${businessName}, a ${businessType}.

Create a seasonal promotional campaign for: ${topic} (${season} ${new Date().getFullYear()})
Current offer/promotion: ${offer}

Write two versions:

---SMS---
A compelling SMS promotional message (under 160 characters). Must include:
- Business name or short identifier
- The offer/promotion
- A clear call to action (call, text, visit, book)
- Sense of urgency (limited time, this week only, etc.)
Do NOT include links or URLs in the SMS.

---EMAIL SUBJECT---
A punchy email subject line (under 55 characters) for this promo. No emojis.

---EMAIL BODY---
A short promotional email body (150-200 words) that:
- Opens with the seasonal hook
- Clearly states the offer/promotion
- Explains the value to the customer
- Has a strong call to action
- Sounds warm and local, not corporate
- Ends with business name and contact prompt

Write only the content — no labels beyond the section dividers.`;

        const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 800,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const aiData = await aiRes.json();
        const fullText = aiData?.content?.[0]?.text || "";

        // Parse sections
        const extractSection = (text: string, marker: string, nextMarker?: string): string => {
          const start = text.indexOf(`---${marker}---`);
          if (start === -1) return "";
          const contentStart = start + `---${marker}---`.length;
          const end = nextMarker ? text.indexOf(`---${nextMarker}---`) : text.length;
          return text.slice(contentStart, end === -1 ? text.length : end).trim();
        };

        const smsText = extractSection(fullText, "SMS", "EMAIL SUBJECT");
        const emailSubject = extractSection(fullText, "EMAIL SUBJECT", "EMAIL BODY");
        const emailBodyText = extractSection(fullText, "EMAIL BODY");

        // Fetch customer list for this client
        const { data: customers } = await sb
          .from("promo_blast_customers")
          .select("*")
          .eq("client_id", client.id)
          .eq("active", true);

        const customerList = customers || [];
        let clientSmsSent = 0;
        let clientEmailsSent = 0;

        // Send SMS to customers with phone numbers
        if (smsText) {
          const phoneCustomers = customerList.filter((c) => c.phone);
          for (const customer of phoneCustomers) {
            try {
              await sendSMS(customer.phone, TWILIO_PHONE_NUMBER, smsText, "seasonal_promo");
              clientSmsSent++;
            } catch (smsErr) {
              console.error(`[seasonal-promo-blaster] SMS error for ${customer.phone}:`, smsErr);
            }
          }
        }

        // Send email to customers with emails
        if (emailSubject && emailBodyText && RESEND_API_KEY) {
          const emailCustomers = customerList.filter((c) => c.email);
          const subject = emailSubject || `${topic} Special from ${businessName}`;

          // Batch emails in groups of 50
          const batchSize = 50;
          for (let i = 0; i < emailCustomers.length; i += batchSize) {
            const batch = emailCustomers.slice(i, i + batchSize);
            await Promise.allSettled(
              batch.map((customer) =>
                fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: `${businessName} <matt@mattmichelstraining.com>`,
                    to: [customer.email],
                    subject,
                    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <tr><td style="background:#1e293b;padding:20px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${season} ${new Date().getFullYear()}</p>
    <p style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">${businessName}</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 20px;font-size:15px;color:#1e293b;line-height:1.9;white-space:pre-line;">${emailBodyText.replace(/\n/g, "<br>")}</p>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0;font-size:14px;color:#9a3412;font-weight:600;">Limited Time Offer — ${topic}</p>
      <p style="margin:4px 0 0;font-size:14px;color:#7c2d12;">${offer}</p>
    </div>

    <hr style="border:1px solid #f1f5f9;margin:20px 0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">You're receiving this because you're a valued customer of ${businessName}. Reply to unsubscribe.</p>
  </td></tr>

  <tr><td style="background:#f8fafc;padding:12px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;font-size:12px;color:#94a3b8;">
    ${businessName} · Powered by M² Marketing
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
                  }),
                })
              )
            );
            clientEmailsSent += batch.length;
          }
        }

        totalSmsSent += clientSmsSent;
        totalEmailsSent += clientEmailsSent;

        // Store blast record
        await sb.from("promo_blast_records").insert({
          client_id: client.id,
          blast_date: new Date().toISOString(),
          topic,
          season,
          sms_text: smsText,
          email_subject: emailSubject,
          email_body: emailBodyText,
          sms_sent: clientSmsSent,
          emails_sent: clientEmailsSent,
          created_at: new Date().toISOString(),
        });

        // Schedule next blast (default 30 days out)
        const nextBlastDays = client.blast_frequency_days || 30;
        const nextBlastAt = new Date();
        nextBlastAt.setDate(nextBlastAt.getDate() + nextBlastDays);

        await sb
          .from("promo_blaster_clients")
          .update({
            last_blast_at: new Date().toISOString(),
            next_blast_at: nextBlastAt.toISOString(),
            total_blasts: (client.total_blasts || 0) + 1,
          })
          .eq("id", client.id);

        processed++;
        console.log(`[seasonal-promo-blaster] Blasted ${businessName}: ${clientSmsSent} SMS, ${clientEmailsSent} emails`);
      } catch (e) {
        console.error(`[seasonal-promo-blaster] Error for client ${client.id}:`, e);
        failed++;
      }
    }

    // Notify Matt
    await notifyMatt(
      `Promo Blaster Run — ${processed} clients, ${totalSmsSent} SMS, ${totalEmailsSent} emails`,
      `<div style="font-family:sans-serif;max-width:500px;padding:24px;">
<h2 style="color:#e8621a;">Seasonal Promo Blaster</h2>
<p><strong>Date:</strong> ${todayStr}</p>
<p><strong>Season/Holiday:</strong> ${season} / ${holiday}</p>
<p><strong>Clients blasted:</strong> ${processed}</p>
<p><strong>SMS sent:</strong> ${totalSmsSent}</p>
<p><strong>Emails sent:</strong> ${totalEmailsSent}</p>
<p><strong>Failed:</strong> ${failed}</p>
</div>`
    );

    return new Response(
      JSON.stringify({ processed, failed, totalSmsSent, totalEmailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[seasonal-promo-blaster] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

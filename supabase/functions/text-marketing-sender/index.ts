import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

// Called by pg_cron monthly to generate and send SMS campaigns for all active clients.
// Can also be called manually via POST with { clientEmail } to run for a single client.
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const singleClient = body?.clientEmail || null;

    const query = sb
      .from("text_marketing_clients")
      .select("id, business_name, contact_name, email, twilio_number, industry, campaign_count")
      .eq("active", true);

    if (singleClient) query.eq("email", singleClient);

    const { data: clients, error } = await query;
    if (error) throw error;
    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    let totalSent = 0;

    for (const client of clients) {
      try {
        if (!client.twilio_number) {
          console.warn(`[TEXT-MARKETING] No twilio_number for ${client.email} — skipping`);
          continue;
        }

        // Get contact list
        const { data: contacts } = await sb
          .from("text_marketing_contacts")
          .select("contact_phone, contact_name")
          .eq("client_email", client.email)
          .eq("opted_in", true);

        if (!contacts?.length) {
          console.warn(`[TEXT-MARKETING] No contacts for ${client.email} — skipping`);
          continue;
        }

        // Generate campaign copy with Claude
        let campaignText = `Hey! ${client.business_name} here. Hope your month is going great! Reply STOP to unsubscribe.`;
        if (ANTHROPIC_API_KEY) {
          const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 300,
              messages: [{
                role: "user",
                content: `Write a short, friendly SMS marketing message for ${client.business_name} (industry: ${client.industry || "local business"}).
The message should: promote their services, create a sense of urgency or value, be conversational and under 160 characters.
End with "Reply STOP to unsubscribe."
Return only the message text, nothing else.`,
              }],
            }),
          });
          if (claudeRes.ok) {
            const claudeData = await claudeRes.json();
            campaignText = claudeData?.content?.[0]?.text?.trim() || campaignText;
          }
        }

        // Send to all contacts via Twilio
        let sentCount = 0;
        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
          for (const contact of contacts) {
            const smsRes = await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              },
              body: new URLSearchParams({
                To: contact.contact_phone,
                From: client.twilio_number,
                Body: campaignText,
              }).toString(),
            });
            if (smsRes.ok) sentCount++;
          }
        }

        // Update campaign count
        await sb.from("text_marketing_clients")
          .update({ campaign_count: (client.campaign_count || 0) + 1 })
          .eq("id", client.id);

        totalSent += sentCount;

        // Email client a report
        if (RESEND_API_KEY && client.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Text Marketing <matt@notify.m2training.com>",
              to: [client.email],
              subject: `📱 Your monthly SMS campaign was sent — ${sentCount} messages`,
              html: `<p>Your monthly text campaign just went out!</p><p><strong>Campaign #${(client.campaign_count || 0) + 1}</strong><br>Messages sent: ${sentCount}<br>Contact list size: ${contacts.length}</p><hr/><p><strong>Message sent:</strong></p><blockquote>${campaignText}</blockquote><p>Reply here with any questions. — Matt</p>`,
            }),
          });
        }

        console.log(`[TEXT-MARKETING] Sent ${sentCount} messages for ${client.business_name}`);
      } catch (clientErr) {
        console.error(`[TEXT-MARKETING] Error for ${client.email}:`, clientErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[TEXT-MARKETING] Fatal error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

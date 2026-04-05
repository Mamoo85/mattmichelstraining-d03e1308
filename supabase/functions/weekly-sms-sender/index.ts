// Weekly SMS Sender — cron every Tuesday 10am ET
// Generates an AI-written tip/promo SMS and sends to each client's contact list

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const SEASONS: Record<number, string> = { 12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring", 6: "summer", 7: "summer", 8: "summer", 9: "fall", 10: "fall", 11: "fall" };

async function generateWeeklySMS(businessName: string, businessType: string, city: string): Promise<string> {
  const month = new Date().getMonth() + 1;
  const season = SEASONS[month];
  const prompt = `Write a short, friendly SMS for ${businessName} (${businessType} in ${city}) to send to their loyal customers this week.

Season: ${season}
Month: ${new Date().toLocaleString("default", { month: "long" })}

Rules:
- 1-2 sentences max, under 140 characters total
- Helpful tip OR a soft promotion — NOT both
- Sound like a real local business owner, not marketing copy
- Include a soft CTA (call us, book now, stop by, etc.)
- Do NOT include links
- Do NOT use hashtags
- Start with something attention-grabbing, not "Hi" or "Hello"

Write just the SMS text, nothing else.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 200, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return data?.content?.[0]?.text?.trim() || `${businessName} here — quick reminder we're taking bookings this week. Give us a call!`;
}

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: clients } = await sb.from("sms_blast_clients").select("*").eq("active", true);
  if (!clients?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  let totalSent = 0;

  for (const client of clients) {
    try {
      const message = await generateWeeklySMS(client.business_name, client.business_type || "local business", client.city || "your area");
      const smsText = `${message}\n\nReply STOP to unsubscribe.`;

      const { data: contacts } = await sb.from("sms_contacts").select("phone").eq("client_id", client.id).eq("opt_out", false);
      if (!contacts?.length) continue;

      let sent = 0;
      for (const contact of contacts) {
        if (contact.phone) {
          const result = await sendSMS(contact.phone, TWILIO_FROM_NUMBER, smsText, "weekly_sms_blast");
          if (result.success) sent++;
          // Rate limit: 1 per 100ms
          await new Promise(r => setTimeout(r, 100));
        }
      }

      await sb.from("sms_blast_clients").update({ last_blast_at: new Date().toISOString() }).eq("id", client.id);
      totalSent += sent;
      console.log(`[weekly-sms] ${client.business_name}: sent ${sent}/${contacts.length}`);

      // Notify Matt of delivery
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "M² System <matt@mattmichelstraining.com>", to: ["matt@mattmichelstraining.com"], subject: `📱 Weekly SMS sent — ${client.business_name} (${sent} recipients)`, html: `<p><strong>${client.business_name}</strong> weekly SMS delivered to ${sent} contacts.<br>Message: "${message}"</p>` }),
        });
      }
    } catch (e) {
      console.error(`[weekly-sms] Error for ${client.email}:`, e);
    }
  }

  return new Response(JSON.stringify({ clients: clients.length, totalSent }), { status: 200 });
});

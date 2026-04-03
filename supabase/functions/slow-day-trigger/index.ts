// Slow Day Trigger — Twilio inbound SMS webhook
// Owner texts a keyword → fires promo blast to their contact list

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

async function generatePromo(businessName: string, businessType: string, promoOffer: string): Promise<string> {
  if (!LOVABLE_API_KEY || !promoOffer) {
    return `${businessName} here — we have an opening TODAY and want to take care of you. ${promoOffer || "Call us now to book!"} Reply STOP to unsubscribe.`;
  }

  const prompt = `Write a short SMS promo for ${businessName} (${businessType}). The offer is: "${promoOffer}".

Rules: 1-2 sentences, urgent but friendly, ends with a call-to-action. Under 140 characters total (not including the STOP notice). Sound like a real local business owner.

Just write the SMS text, nothing else.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  const msg = data?.choices?.[0]?.message?.content?.trim() || `${businessName}: ${promoOffer} — call now!`;
  return `${msg}\n\nReply STOP to unsubscribe.`;
}

async function sendSMS(to: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }),
    });
    return res.ok;
  } catch { return false; }
}

serve(async (req) => {
  // Twilio sends form-encoded POST
  const body = await req.text();
  const params = new URLSearchParams(body);
  const fromPhone = params.get("From") || "";
  const messageBody = params.get("Body")?.trim().toUpperCase() || "";

  if (!fromPhone) return new Response("", { status: 200 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find client by their phone number
  const { data: client } = await sb.from("slow_day_clients")
    .select("*")
    .eq("phone", fromPhone)
    .eq("active", true)
    .maybeSingle();

  if (!client) {
    // Not a registered client — ignore
    return new Response(`<?xml version="1.0"?><Response></Response>`, { headers: { "Content-Type": "text/xml" } });
  }

  const triggerKeyword = (client.trigger_keyword || "SLOW").toUpperCase();

  if (messageBody !== triggerKeyword) {
    // Not the trigger keyword — send help message
    const helpMsg = `M² Promo System: Text "${triggerKeyword}" to fire your promo blast. Contacts: ${client.contact_count || 0}`;
    await sendSMS(fromPhone, helpMsg);
    return new Response(`<?xml version="1.0"?><Response></Response>`, { headers: { "Content-Type": "text/xml" } });
  }

  // Trigger keyword received — fire the blast
  const promoMessage = await generatePromo(client.business_name, client.business_type || "local business", client.promo_offer || "");

  // Get contacts
  const { data: contacts } = await sb.from("sms_contacts")
    .select("phone")
    .eq("client_id", client.id)
    .eq("opt_out", false)
    .limit(200);

  let sent = 0;
  if (contacts?.length) {
    for (const contact of contacts) {
      if (contact.phone) {
        await sendSMS(contact.phone, promoMessage);
        sent++;
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  await sb.from("slow_day_clients").update({ last_blast_at: new Date().toISOString() }).eq("id", client.id);

  // Confirm to owner
  await sendSMS(fromPhone, `✅ Promo blast sent to ${sent} customers! Message: "${promoMessage.split("\n")[0]}"`);

  console.log(`[slow-day-trigger] ${client.business_name} fired promo to ${sent} contacts`);
  return new Response(`<?xml version="1.0"?><Response></Response>`, { headers: { "Content-Type": "text/xml" } });
});

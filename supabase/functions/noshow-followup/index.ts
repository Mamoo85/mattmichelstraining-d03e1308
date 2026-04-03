// No-Show Follow-Up — cron every 5 minutes
// Sends scheduled re-booking SMS to no-show customers

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

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

serve(async () => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date().toISOString();

  // Get pending events whose send_at has passed
  const { data: events } = await sb.from("noshow_events")
    .select("*, noshow_clients(business_name, booking_url, custom_message)")
    .eq("status", "pending")
    .lte("send_at", now)
    .limit(50);

  if (!events?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  let sent = 0;
  for (const event of events) {
    try {
      const client = event.noshow_clients as any;
      const bookingUrl = client?.booking_url || "";
      const businessName = client?.business_name || "us";
      const customMsg = client?.custom_message;

      const greeting = event.customer_name ? `Hey ${event.customer_name.split(" ")[0]}` : "Hey";
      const message = customMsg ||
        `${greeting} — we missed you at your appointment with ${businessName} today! We'd love to get you rescheduled.${bookingUrl ? ` Book here: ${bookingUrl}` : " Reply or call us to find a new time."} No worries if plans changed!`;

      const ok = await sendSMS(event.customer_phone, message);

      await sb.from("noshow_events").update({ status: ok ? "sent" : "failed", sent_at: ok ? new Date().toISOString() : null }).eq("id", event.id);
      if (ok) sent++;
    } catch (e) {
      console.error(`[noshow-followup] Error for event ${event.id}:`, e);
      await sb.from("noshow_events").update({ status: "failed" }).eq("id", event.id);
    }
  }

  console.log(`[noshow-followup] Sent ${sent}/${events.length}`);
  return new Response(JSON.stringify({ sent, total: events.length }), { status: 200 });
});

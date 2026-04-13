// inbound-sms-relay — Twilio SMS webhook for +13139921219 (DWA work number)
// Forwards any inbound text to Matt's personal cell so he sees the reply.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendSMS } from "../_shared/twilio.ts";

const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const MATT_PERSONAL = Deno.env.get("MATT_PERSONAL_PHONE") || "+13138064952";

serve(async (req) => {
  const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

  if (req.method !== "POST") {
    return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get("From") || "Unknown";
    const body = params.get("Body") || "";

    console.log(`[inbound-sms-relay] SMS from ${from}: ${body}`);

    await sendSMS(
      MATT_PERSONAL,
      TWILIO_PHONE_NUMBER,
      `DWA msg from ${from}: ${body}`,
      "sms_relay"
    );
  } catch (e: unknown) {
    console.error("[inbound-sms-relay] Error:", e instanceof Error ? e.message : String(e));
  }

  return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
});

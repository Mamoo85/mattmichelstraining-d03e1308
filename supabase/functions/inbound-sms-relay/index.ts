// inbound-sms-relay — Twilio SMS webhook for +13139921219 (DWA work number)
// 1. Logs every inbound message to system_comms_log so the admin inbox can show threads.
// 2. Forwards a preview to Matt's personal cell so he sees the reply on his phone.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const MATT_PERSONAL = Deno.env.get("MATT_PERSONAL_PHONE") || "+13138064952";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  const twimlEmpty = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

  if (req.method !== "POST") {
    return new Response(twimlEmpty, { headers: { "Content-Type": "text/xml" } });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get("From") || "Unknown";
    const to = params.get("To") || TWILIO_PHONE_NUMBER;
    const body = params.get("Body") || "";
    const messageSid = params.get("MessageSid") || undefined;

    console.log(`[inbound-sms-relay] SMS from ${from} → ${to}: ${body}`);

    // 1. Log inbound message to system_comms_log so the admin inbox can render the thread.
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await sb.from("system_comms_log").insert({
        channel: "sms",
        product: "inbound",
        recipient: to, // the DWA number that received it
        body_preview: body.slice(0, 1000),
        status: "inbound",
        provider_id: messageSid,
        metadata: { from, direction: "inbound" },
      }).then(({ error }) => {
        if (error) console.error("[inbound-sms-relay] log insert error:", error.message);
      });
    }

    // 2. Forward to Matt's personal cell (existing behavior).
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

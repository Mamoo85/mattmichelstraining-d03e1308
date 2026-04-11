// missed-call-handler — fires on every incoming call to +13139921219
// Immediately sends an SMS back to the caller and plays a short "I'll call you right back" message.
// Twilio "A call comes in" webhook → this function → TwiML response.
// No status tracking needed — simpler and actually works.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";

const TWIML_HEADERS = { "Content-Type": "text/xml" };

function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: TWIML_HEADERS,
  });
}

serve(async (req) => {
  // Twilio sends form-encoded POST data
  if (req.method !== "POST") {
    return twiml("<Say>Method not allowed.</Say><Hangup/>");
  }

  let fromNumber = "";
  let toNumber = TWILIO_PHONE_NUMBER;

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    fromNumber = params.get("From") || "";
    toNumber = params.get("To") || TWILIO_PHONE_NUMBER;
    const callStatus = params.get("CallStatus") || "";

    console.log(`[missed-call-handler] Call from=${fromNumber} to=${toNumber} status=${callStatus}`);

    // If no caller number, just hang up
    if (!fromNumber) {
      return twiml("<Hangup/>");
    }

    // Send SMS back to caller if we have Twilio credentials
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const smsBody = "Hey! I just saw your call and I'll call you right back. — Matt @ Detroit Web Agency (313) 806-4952";
      const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: fromNumber,
            From: toNumber,
            Body: smsBody,
          }),
        }
      );

      if (smsRes.ok) {
        const result = await smsRes.json();
        console.log(`[missed-call-handler] SMS sent to ${fromNumber} — SID: ${result.sid}`);
      } else {
        const err = await smsRes.text();
        console.error(`[missed-call-handler] Twilio SMS error: ${err}`);
      }
    } else {
      console.warn("[missed-call-handler] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set — SMS skipped");
    }
  } catch (e: unknown) {
    console.error("[missed-call-handler] Error:", e instanceof Error ? e.message : String(e));
  }

  // Always return valid TwiML — play a short message and hang up
  return twiml(
    `<Say voice="alice">Thanks for calling Detroit Web Agency. We just texted you and will call right back.</Say><Hangup/>`
  );
});

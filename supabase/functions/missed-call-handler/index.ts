// missed-call-handler — fires on every incoming call to +13139921219
// Immediately sends an SMS back to the caller and plays a short "I'll call you right back" message.
// Twilio "A call comes in" webhook → this function → TwiML response.
// No status tracking needed — simpler and actually works.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendSMS } from "../_shared/twilio.ts";

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

    // Send SMS back to caller using shared TCPA-compliant sendSMS
    const smsBody = "Hey! I just saw your call and I'll call you right back. — Matt @ Detroit Web Agency (313) 806-4952";
    const smsResult = await sendSMS(fromNumber, toNumber, smsBody, "missed_call");
    if (smsResult.success) {
      console.log(`[missed-call-handler] SMS sent to ${fromNumber} — SID: ${smsResult.sid}`);
    } else if (smsResult.skipped) {
      console.log(`[missed-call-handler] SMS skipped — ${fromNumber} is opted out`);
    } else {
      console.error(`[missed-call-handler] SMS failed: ${smsResult.error}`);
    }
  } catch (e: unknown) {
    console.error("[missed-call-handler] Error:", e instanceof Error ? e.message : String(e));
  }

  // Always return valid TwiML — play a short message and hang up
  return twiml(
    `<Say voice="alice">Thanks for calling Detroit Web Agency. We just texted you and will call right back.</Say><Hangup/>`
  );
});

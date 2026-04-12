// missed-call-handler — Twilio VoiceUrl for +13139921219 (DWA work number)
// Forwards the call to Matt's personal phone. Does NOT send any SMS.
// A separate "missed-call-status" function handles post-call status
// and schedules the 5-minute delayed text-back if Matt didn't answer.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const MATT_PERSONAL = "+13138064952";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

const TWIML_HEADERS = { "Content-Type": "text/xml" };

function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: TWIML_HEADERS,
  });
}

serve(async (req) => {
  if (req.method !== "POST") {
    return twiml("<Hangup/>");
  }

  let fromNumber = "";
  let toNumber = "";

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    fromNumber = params.get("From") || "";
    toNumber = params.get("To") || "";

    console.log(`[missed-call-handler] Call from=${fromNumber} to=${toNumber}`);

    // Matt's personal number should NEVER trigger automated texts.
    // If somehow this webhook fires for that number, just ring through normally.
    if (toNumber === MATT_PERSONAL) {
      return twiml("<Dial><Number>" + MATT_PERSONAL + "</Number></Dial>");
    }

    // No caller ID — hang up silently
    if (!fromNumber) {
      return twiml("<Hangup/>");
    }
  } catch (e: unknown) {
    console.error("[missed-call-handler] Error parsing request:", e instanceof Error ? e.message : String(e));
    return twiml("<Hangup/>");
  }

  // Forward the call to Matt's personal phone for 25 seconds.
  // The action URL fires when the <Dial> completes (answered or missed).
  const statusUrl = `${SUPABASE_URL}/functions/v1/missed-call-status`;

  return twiml(
    `<Dial timeout="25" action="${statusUrl}" method="POST">` +
    `<Number>${MATT_PERSONAL}</Number>` +
    `</Dial>`
  );
});

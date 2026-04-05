import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);

    const callStatus = params.get("CallStatus") || "";
    const toNumber = params.get("To") || "";
    const fromNumber = params.get("From") || "";

    // Only fire on missed/unanswered calls
    if (!["no-answer", "busy", "failed"].includes(callStatus)) {
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    if (!toNumber || !fromNumber) {
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up the active client for this Twilio number
    const { data: client } = await sb
      .from("missed_call_clients")
      .select("id, business_name, response_message, active, text_count")
      .eq("twilio_number", toNumber)
      .eq("active", true)
      .single();

    if (!client) {
      console.warn(`[MISSED-CALL] No active client found for twilio_number=${toNumber}`);
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    // Check SMS opt-out before sending (TCPA compliance)
    const { data: optOut } = await sb
      .from("sms_opt_outs")
      .select("id")
      .eq("phone", fromNumber)
      .maybeSingle();

    if (optOut) {
      console.log(`[MISSED-CALL] ${fromNumber} is opted out — skipping`);
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    const message = client.response_message ||
      "Hey! I just missed your call — I'll call you right back. How can I help you?";

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error("[MISSED-CALL] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set");
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    // Send SMS directly via Twilio REST API (no gateway dependency)
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
          Body: message,
        }),
      }
    );

    if (!smsRes.ok) {
      const errText = await smsRes.text();
      console.error(`[MISSED-CALL] Twilio error: ${errText}`);
    } else {
      const result = await smsRes.json();
      console.log(`[MISSED-CALL] SMS sent to ${fromNumber} for ${client.business_name} — SID: ${result.sid}`);

      // Increment text count
      await sb
        .from("missed_call_clients")
        .update({ text_count: (client.text_count || 0) + 1 })
        .eq("id", client.id);
    }

    return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[MISSED-CALL] Error:", msg);
    return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  }
});

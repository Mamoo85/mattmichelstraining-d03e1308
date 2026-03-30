import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

// Twilio sends application/x-www-form-urlencoded — no CORS needed (server-to-server)
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);

    const callStatus = params.get("CallStatus") || "";
    const toNumber = params.get("To") || "";   // the Twilio number (client's assigned number)
    const fromNumber = params.get("From") || ""; // the caller's number

    // Fire on missed/no-answer/busy calls AND on "ringing" which is what
    // Android conditional call forwarding sends — the phone already rang
    // unanswered before forwarding to Twilio, so any inbound call here is a missed call.
    if (!["no-answer", "busy", "failed", "ringing", "in-progress"].includes(callStatus)) {
      return new Response("<Response/>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    if (!toNumber || !fromNumber) {
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up the client by their assigned Twilio number
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

    const message = client.response_message ||
      "Hey! I just missed your call — I'll call you right back. How can I help you?";

    // Send SMS via Twilio REST API
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const smsBody = new URLSearchParams({
        To: fromNumber,
        From: toNumber,
        Body: message,
      });

      const smsRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: smsBody.toString(),
      });

      if (!smsRes.ok) {
        const errText = await smsRes.text();
        console.error(`[MISSED-CALL] Twilio SMS error: ${errText}`);
      } else {
        // Increment text_count using raw SQL via Supabase
        const { error: updateErr } = await sb
          .from("missed_call_clients")
          .update({ text_count: (client as any).text_count ? (client as any).text_count + 1 : 1 })
          .eq("id", client.id);

        if (updateErr) {
          console.error(`[MISSED-CALL] Failed to increment text_count:`, updateErr);
        }

        console.log(`[MISSED-CALL] Sent text-back to ${fromNumber} for ${client.business_name}`);
      }
    } else {
      console.warn("[MISSED-CALL] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set");
    }

    // Return empty TwiML so Twilio doesn't attempt further action
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e: any) {
    console.error("[MISSED-CALL] Error:", e);
    return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  }
});

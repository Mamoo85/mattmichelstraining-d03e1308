import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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

    if (!["no-answer", "busy", "failed", "ringing", "in-progress"].includes(callStatus)) {
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    if (!toNumber || !fromNumber) {
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

    if (LOVABLE_API_KEY && TWILIO_API_KEY) {
      const smsRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: fromNumber, From: toNumber, Body: message }),
      });

      if (!smsRes.ok) {
        const errText = await smsRes.text();
        console.error(`[MISSED-CALL] Twilio gateway error: ${errText}`);
      } else {
        const { error: updateErr } = await sb
          .from("missed_call_clients")
          .update({ text_count: (client.text_count || 0) + 1 })
          .eq("id", client.id);

        if (updateErr) console.error(`[MISSED-CALL] Failed to increment text_count:`, updateErr);
        console.log(`[MISSED-CALL] Sent text-back to ${fromNumber} for ${client.business_name}`);
      }
    } else {
      console.warn("[MISSED-CALL] LOVABLE_API_KEY or TWILIO_API_KEY not set");
    }

    return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  } catch (e: any) {
    console.error("[MISSED-CALL] Error:", e);
    return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
  }
});

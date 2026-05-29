// missed-call-textback — Twilio StatusCallback webhook stub
// Foundation for the $99/mo Missed-Call Catch product.
// When a call ends with no-answer/busy, texts the caller on the contractor's behalf.
// Looks up client by the "To" number in missed_call_clients table.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    // Twilio StatusCallback sends form-encoded POST
    const body = await req.text();
    const params = new URLSearchParams(body);

    const callStatus = params.get("CallStatus") || "";
    const callerPhone = params.get("From") || "";      // person who called
    const contractorPhone = params.get("To") || "";    // contractor's number

    // Only act on missed calls
    if (!["no-answer", "busy", "failed"].includes(callStatus)) {
      return new Response("OK", { status: 200 });
    }

    if (!callerPhone || !contractorPhone) {
      return new Response("OK", { status: 200 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up contractor by their Twilio number
    const { data: client } = await sb
      .from("missed_call_clients")
      .select("client_name, active")
      .eq("client_phone", contractorPhone)
      .maybeSingle();

    if (!client?.active) {
      console.log(`[missed-call-textback] No active client for ${contractorPhone}`);
      return new Response("OK", { status: 200 });
    }

    await sendSMS(
      callerPhone,
      TWILIO_PHONE_NUMBER,
      `Hey, it's ${client.client_name}! I'm on a job right now — what can I help you with?`,
      "missed_call"
    );

    console.log(`[missed-call-textback] Texted ${callerPhone} on behalf of ${client.client_name}`);
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("[missed-call-textback] Error:", e);
    return new Response("OK", { status: 200 }); // Always 200 to Twilio
  }
});

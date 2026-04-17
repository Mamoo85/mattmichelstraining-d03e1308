// retry-missed-call-provision — retries Twilio number purchase if first attempt failed.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: client } = await sb
      .from("missed_call_clients")
      .select("id, email, business_name, business_phone, twilio_number")
      .eq("setup_token", token)
      .maybeSingle();

    if (!client) {
      return new Response(JSON.stringify({ error: "Invalid setup link" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (client.twilio_number) {
      return new Response(JSON.stringify({ success: true, twilio_number: client.twilio_number, message: "Already provisioned" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: "Provisioning unavailable — contact support" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const areaCode = (client.business_phone || "").replace(/\D/g, "").slice(0, 3) || "313";
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const handlerUrl = `${SUPABASE_URL}/functions/v1/missed-call-handler`;

    const searchRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&SmsEnabled=true&VoiceEnabled=true`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    const searchData = await searchRes.json();
    const available = searchData?.available_phone_numbers?.[0]?.phone_number;
    if (!available) {
      return new Response(JSON.stringify({ error: "No numbers available in your area code right now — try again in a few minutes" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buyRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          PhoneNumber: available,
          FriendlyName: `DWA - ${client.business_name || client.email}`,
          StatusCallback: handlerUrl,
          StatusCallbackMethod: "POST",
          VoiceUrl: handlerUrl,
          VoiceMethod: "POST",
        }),
      },
    );
    const buyData = await buyRes.json();
    const twilioNumber = buyData?.phone_number;
    if (!twilioNumber) {
      return new Response(JSON.stringify({ error: buyData?.message || "Provisioning failed — contact support" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("missed_call_clients").update({
      twilio_number: twilioNumber,
      active: true,
    }).eq("id", client.id);

    return new Response(JSON.stringify({ success: true, twilio_number: twilioNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

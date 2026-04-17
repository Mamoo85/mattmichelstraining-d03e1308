// send-missed-call-test — sends a test text from the customer's twilio number
// to their personal cell so they can verify the setup works.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
      .select("business_name, business_phone, twilio_number")
      .eq("setup_token", token)
      .maybeSingle();

    if (!client?.twilio_number || !client?.business_phone) {
      return new Response(JSON.stringify({ error: "Setup not complete" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = `✅ This is a test text from your Missed Call Text-Back system. Whenever someone misses a call to your business line and it forwards to ${client.twilio_number}, they'll get an instant text exactly like this. You're live. — ${client.business_name}`;
    const result = await sendSMS(client.business_phone, client.twilio_number, body, "missed_call");

    return new Response(JSON.stringify({ success: result.success, error: result.error || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

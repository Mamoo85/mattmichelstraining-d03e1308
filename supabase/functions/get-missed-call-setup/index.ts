// get-missed-call-setup — public token-based dashboard fetch
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await sb
      .from("missed_call_clients")
      .select("business_name, business_phone, twilio_number, contact_name, active, email")
      .eq("setup_token", token)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Invalid or expired setup link" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = data.twilio_number && data.business_phone
      ? "live"
      : data.twilio_number
      ? "awaiting_forwarding"
      : "provisioning_failed";

    return new Response(JSON.stringify({
      business_name: data.business_name,
      contact_name: data.contact_name,
      twilio_number: data.twilio_number,
      business_phone: data.business_phone,
      status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

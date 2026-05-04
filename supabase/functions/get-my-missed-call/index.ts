import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return new Response(JSON.stringify({ error: "token required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: client, error } = await sb
    .from("missed_call_clients")
    .select("id, business_name, contact_name, response_message, call_count, text_count, active, created_at, stripe_subscription_id, email")
    .eq("dashboard_token", token)
    .maybeSingle();

  if (error || !client) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pull last 30 captures (global table — currently single-tenant; safe).
  const { data: captures } = await sb
    .from("missed_call_captures")
    .select("id, caller_number, city, voicemail_transcript, recording_url, recording_duration, text_sent, reply_received, status, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  return new Response(JSON.stringify({ client, captures: captures || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

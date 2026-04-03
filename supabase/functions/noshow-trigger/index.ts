// No-Show Trigger — called by client's booking system webhook or manually
// Logs the no-show event, schedules a text for 30 minutes later

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { client_email, customer_phone, customer_name } = await req.json();
    if (!client_email || !customer_phone) {
      return new Response(JSON.stringify({ error: "client_email and customer_phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find the client
    const { data: client } = await sb.from("noshow_clients").select("id, active").eq("email", client_email).eq("active", true).maybeSingle();
    if (!client) return new Response(JSON.stringify({ error: "Client not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Schedule SMS for 30 minutes from now
    const sendAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await sb.from("noshow_events").insert({ client_id: client.id, customer_phone, customer_name: customer_name || null, send_at: sendAt, status: "pending" });

    console.log(`[noshow-trigger] Scheduled re-booking SMS for ${customer_phone} at ${sendAt}`);
    return new Response(JSON.stringify({ scheduled: true, send_at: sendAt }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

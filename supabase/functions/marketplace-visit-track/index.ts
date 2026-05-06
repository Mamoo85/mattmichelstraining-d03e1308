// marketplace-visit-track — public endpoint that upserts a buyer visit record using service-role
// Replaces direct client writes after marketplace_buyer_visits was locked down to service_role.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  try {
    const { buyer_email } = await req.json().catch(() => ({}));
    if (!buyer_email || typeof buyer_email !== "string") {
      return new Response(JSON.stringify({ error: "buyer_email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const email = buyer_email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return new Response(JSON.stringify({ error: "invalid email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    await sb.from("marketplace_buyer_visits").upsert(
      { buyer_email: email, last_seen_at: new Date().toISOString() },
      { onConflict: "buyer_email" },
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

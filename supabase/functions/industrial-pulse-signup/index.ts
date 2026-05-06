// industrial-pulse-signup (Channel 3 — public)
// POST { email, business_name?, vertical_interest? } → upserts into industrial_pulse_subscribers.
// Public, anonymous, no auth required. CORS-open.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, business_name, vertical_interest, source } = await req.json();

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "valid email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const cleanEmail = email.toLowerCase().trim();

    // Upsert (won't error on duplicate)
    const { error } = await sb
      .from("industrial_pulse_subscribers")
      .upsert({
        email: cleanEmail,
        business_name: business_name?.toString().slice(0, 200) || null,
        vertical_interest: vertical_interest?.toString().slice(0, 60) || null,
        source: source?.toString().slice(0, 60) || "industrial-pulse-page",
        unsubscribed: false,
        unsubscribed_at: null,
      }, { onConflict: "email" });

    if (error) {
      console.error("[industrial-pulse-signup] upsert fail", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industrial-pulse-signup]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

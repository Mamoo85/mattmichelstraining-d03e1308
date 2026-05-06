// trial-attribution-log — records first-touch UTM/referrer attribution
// at the moment a trial or checkout is initiated. Idempotent per (email, product).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { email, product, source, medium, campaign, content, referrer, metadata } = body;

    if (!email || !product) {
      return new Response(JSON.stringify({ ok: false, error: "email + product required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check existing — first-touch wins
    const { data: existing } = await sb
      .from("trial_attribution")
      .select("id")
      .eq("email", String(email).toLowerCase())
      .eq("product", product)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ ok: true, existing: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("trial_attribution").insert({
      email: String(email).toLowerCase(),
      product,
      source: source || null,
      utm_medium: medium || null,
      campaign: campaign || null,
      utm_content: content || null,
      metadata: { referrer: referrer || null, ...(metadata || {}) },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

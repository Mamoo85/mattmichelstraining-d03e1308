import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { email, name, phone, company_name, markets } = body;
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("luxury_re_clients").upsert(
      { email, contact_name: name || null, phone: phone || null, company_name: company_name || null, markets: markets || null, active: false },
      { onConflict: "email" }
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 29900, product_data: { name: "Luxury Real Estate Intelligence", description: "Weekly briefing on luxury market moves, off-market listings, buyer demand signals, and high-net-worth migration trends in your target markets." } }, quantity: 1 }],
      metadata: { type: "luxury_re_subscription", email, name: name || "", phone: phone || "", company_name: company_name || "", markets: markets || "" },
      success_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/luxury-re-intel?status=success`,
      cancel_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/luxury-re-intel`,
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

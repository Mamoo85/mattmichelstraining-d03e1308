import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { email, name, phone } = body;
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("str_reputation_clients").upsert(
      { email, contact_name: name || null, phone: phone || null, property_urls: body.propertyUrls || null, property_count: parseInt(body.propertyCount) || 1, active: false },
      { onConflict: "email" }
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      subscription_data: { trial_period_days: 14 },
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 7900, product_data: { name: "Airbnb & STR Host Reputation Manager", description: "AI monitors reviews and drafts personalized responses within 2 hours. Monthly reputation report included." } }, quantity: 1 }],
      metadata: { type: "str_reputation_subscription", email, name: name || "", phone: phone || "", ...Object.fromEntries(Object.entries(body).filter(([k]) => !["email","name","phone"].includes(k)).map(([k,v]) => [k, String(v)])) },
      success_url: "https://www.mattmichelstraining.com/str-reputation?status=success",
      cancel_url: "https://www.mattmichelstraining.com/str-reputation",
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

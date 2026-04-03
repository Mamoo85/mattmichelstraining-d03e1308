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
    const { email, name, businessName, phone, businessType, promoOffer } = await req.json();
    if (!email || !businessName) return new Response(JSON.stringify({ error: "email and businessName required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("slow_day_clients").upsert({ email, business_name: businessName, contact_name: name || null, phone: phone || null, business_type: businessType || null, promo_offer: promoOffer || null, active: false }, { onConflict: "email" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 2500, product_data: { name: "Slow Day Push SMS", description: "Text a keyword when you're slow — 200 customers instantly get your promo. One job pays for months." } }, quantity: 1 }],
      metadata: { type: "slow_day_subscription", email, name: name || "", businessName, phone: phone || "", businessType: businessType || "", promoOffer: promoOffer || "" },
      success_url: "https://www.mattmichelstraining.com/slow-day-sms?status=success",
      cancel_url: "https://www.mattmichelstraining.com/slow-day-sms",
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

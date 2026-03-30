import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, name, businessName, city, services } = await req.json();
    if (!email || !businessName || !city) {
      return new Response(JSON.stringify({ error: "email, businessName, and city are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 3900, product_data: { name: "AI Google Ads Copy Generator — $39/month", description: "10 AI-generated Google Ads copy variations delivered monthly." } }, quantity: 1 }],
      metadata: { type: "ads_copy_subscription", email, name: name || "", businessName, city, services: services || "" },
      success_url: "https://www.mattmichelstraining.com/ai-ads-copy?status=success",
      cancel_url: "https://www.mattmichelstraining.com/ai-ads-copy",
    });
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[CREATE-ADS-COPY-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

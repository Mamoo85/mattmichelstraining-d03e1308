import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, businessName, industry } = await req.json();
    if (!email || !businessName) return new Response(JSON.stringify({ error: "email and businessName required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, product_data: { name: "AI Competitor Price Monitor", description: "Weekly competitor pricing intelligence reports" }, unit_amount: 4900 }, quantity: 1 }],
      mode: "subscription",
      success_url: `${req.headers.get("origin") || "https://mattmichelstraining.lovable.app"}/ai-price-monitor?success=true`,
      cancel_url: `${req.headers.get("origin") || "https://mattmichelstraining.lovable.app"}/ai-price-monitor`,
      metadata: { type: "price_monitor_subscription", business_name: businessName, industry: industry || "" },
      subscription_data: { trial_period_days: 7 },
    });
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});

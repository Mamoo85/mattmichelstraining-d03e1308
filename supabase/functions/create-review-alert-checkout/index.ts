import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getStripeSecretKey } from "../_shared/stripe-key.ts";
const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const { email, name, businessName, phone } = await req.json();
    if (!email || !businessName) return new Response(JSON.stringify({ error: "email and businessName required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", payment_method_types: ["card"], customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 1900,
          product_data: { name: "Review Alerts", description: "Real-time SMS + email alerts for every new Google review your business receives." },
        },
        quantity: 1,
      }],
      metadata: { type: "review_alert_subscription", email, name: name || "", businessName, phone: phone || "" },
      success_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/review-alerts?status=success`,
      cancel_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/review-alerts`,
    });
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});

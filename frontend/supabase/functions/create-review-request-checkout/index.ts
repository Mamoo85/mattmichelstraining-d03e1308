import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { getStripeSecretKey } from "../_shared/stripe-key.ts";
const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email, name, businessName, googleReviewUrl } = await req.json();
    if (!email || !businessName) return new Response(JSON.stringify({ error: "email and businessName required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", payment_method_types: ["card"], customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 3900,
          product_data: { name: "Review Request SMS", description: "Automated SMS to customers after each job asking them to leave a Google review." },
        },
        quantity: 1,
      }],
      metadata: { type: "review_request_subscription", email, name: name || "", businessName, googleReviewUrl: googleReviewUrl || "" },
      success_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/review-request-sms?status=success`,
      cancel_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/review-request-sms`,
    });
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } }); }
});

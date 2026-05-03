// create-site-radar-checkout — Stripe checkout for SiteRadar $49/mo subscription.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email, businessName, website, city } = await req.json();
    if (!email || !businessName) {
      return new Response(JSON.stringify({ error: "email and businessName required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      payment_method_collection: "if_required",
      subscription_data: { trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } },
      discounts: [{ coupon: "s5f2M1Vq" }],
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 4900,
          product_data: {
            name: "SiteRadar — Visitor Intelligence",
            description: "See which companies visit your website. Real-time B2B visitor identification.",
          },
        },
        quantity: 1,
      }],
      metadata: { type: "site_radar_subscription", email, businessName, website: website || "", city: city || "" },
      success_url: `${origin}/site-radar?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/site-radar`,
    });
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[create-site-radar-checkout]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

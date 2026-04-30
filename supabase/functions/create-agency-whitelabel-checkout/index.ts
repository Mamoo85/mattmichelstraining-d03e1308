// create-agency-whitelabel-checkout — $999/mo subscription for staffing agencies
// who want to use the TechAlert candidate database under their own brand.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getStripeSecretKey } from "../_shared/stripe-key.ts";

const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { email, agency_name, contact_name, phone } = await req.json();
    if (!email || !agency_name) {
      return new Response(JSON.stringify({ error: "email and agency_name required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 99900, // $999/mo
          recurring: { interval: "month" },
          product_data: {
            name: "TechAlert White-Label — Staffing Agency",
            description: "Full access to the TechAlert candidate database under your agency's brand. Unlimited blasts, white-labeled emails, Michigan + expansion markets. $999/mo, cancel anytime.",
          },
        },
      }],
      metadata: {
        type: "agency_whitelabel_subscription",
        email,
        agency_name,
        contact_name: contact_name || "",
        phone: phone || "",
      },
      success_url: `${origin}/talent-radar?whitelabel=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/talent-radar`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

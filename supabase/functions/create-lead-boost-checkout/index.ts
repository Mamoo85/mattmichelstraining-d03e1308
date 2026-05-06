// create-lead-boost-checkout — Stripe checkout for optional Lead Boost upsell.
// Boost amounts: $100, $200, $300 → 20% mgmt fee included, fine print discloses.
// One-time OR recurring monthly.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contractor_id, email, boost_amount, recurring = false } = await req.json();

    if (!contractor_id || !email || !boost_amount) {
      return new Response(JSON.stringify({ error: "contractor_id, email, boost_amount required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = [100, 200, 300];
    if (!allowed.includes(Number(boost_amount))) {
      return new Response(JSON.stringify({ error: "boost_amount must be 100, 200, or 300" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalCents = Number(boost_amount) * 100;
    const origin = req.headers.get("origin") || "https://detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: recurring ? "subscription" : "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: totalCents,
          ...(recurring ? { recurring: { interval: "month" } } : {}),
          product_data: {
            name: `Lead Boost — $${boost_amount}${recurring ? "/mo" : ""}`,
            description: `Increases your monthly lead probability. Boost includes 20% management fee for ad platform setup, optimization, and reporting (see Terms).`,
          },
        },
      }],
      metadata: {
        type: "lead_boost_purchase",
        contractor_id,
        boost_amount: String(boost_amount),
        recurring: String(recurring),
      },
      success_url: `${origin}/contractor-portal/${contractor_id}?boost=success`,
      cancel_url: `${origin}/contractor-portal/${contractor_id}?boost=cancel`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-lead-boost-checkout] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

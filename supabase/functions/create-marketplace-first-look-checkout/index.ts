// create-marketplace-first-look-checkout — Stripe subscription for early access to hot leads.
// $49/mo single product, $129/mo all-products. Subscribers see hot leads 1h before public.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const VALID_PRODUCTS = ["mortgage", "talent", "demand", "growth", "supply", "all"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, product } = await req.json();
    const buyerEmail = String(email || "").trim().toLowerCase();
    const productKey = String(product || "all").toLowerCase();

    if (!buyerEmail || !buyerEmail.includes("@")) {
      return new Response(JSON.stringify({ error: "valid email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VALID_PRODUCTS.includes(productKey)) {
      return new Response(JSON.stringify({ error: "invalid product" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAll = productKey === "all";
    const priceCents = isAll ? 12900 : 4900;
    const label = isAll
      ? "Marketplace First Look — All Products"
      : `Marketplace First Look — ${productKey.charAt(0).toUpperCase() + productKey.slice(1)} Leads`;

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: buyerEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          product_data: {
            name: label,
            description: "Get hot leads 1 hour before they hit the public marketplace. Cancel anytime.",
          },
          unit_amount: priceCents,
        },
        quantity: 1,
      }],
      metadata: {
        type: "marketplace_first_look_subscription",
        email: buyerEmail,
        product: productKey,
      },
      success_url: `${origin}/marketplace/receipts?first_look=1&email=${encodeURIComponent(buyerEmail)}`,
      cancel_url: `${origin}/${isAll ? "mortgage" : productKey}-leads?cancelled=1`,
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-marketplace-first-look-checkout]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

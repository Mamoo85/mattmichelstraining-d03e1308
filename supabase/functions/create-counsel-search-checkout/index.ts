// Counsel Records Search checkout — $49/mo Solo, $79/mo Monitoring
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { getStripeSecretKey } from "../_shared/stripe-key.ts";

const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = "solo" | "monitoring";
const TIERS: Record<Tier, { amount: number; name: string; description: string }> = {
  solo: {
    amount: 4900,
    name: "Counsel Records Search — Solo",
    description: "Unlimited public-records searches for one Michigan attorney. Federal court + MI county + state corrections + business filings + AI-corroborated web research, in one click.",
  },
  monitoring: {
    amount: 7900,
    name: "Counsel Records Search — Monitoring",
    description: "Everything in Solo + saved subjects. Up to 25 saved names re-checked weekly; we email you when new hits land.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, contact_name, firm_name, bar_number, phone, tier } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const selectedTier: Tier = (tier && tier in TIERS) ? tier : "solo";
    const t = TIERS[selectedTier];
    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: t.amount,
          recurring: { interval: "month" },
          product_data: { name: t.name, description: t.description },
        },
      }],
      metadata: {
        type: "counsel_search_subscription",
        tier: selectedTier,
        email,
        contact_name: contact_name || "",
        firm_name: firm_name || "",
        bar_number: bar_number || "",
        phone: phone || "",
      },
      success_url: `${origin}/counsel-search?success=1&tier=${selectedTier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/counsel-search`,
    });
    return new Response(JSON.stringify({ url: session.url, tier: selectedTier }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-counsel-search-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

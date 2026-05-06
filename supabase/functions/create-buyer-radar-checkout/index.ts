// Buyer Radar checkout — industrial supplier intelligence ($399 / $599 / $799)
// Reuses industry_pulse_clients table with buyer_type='supplier' + vertical
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = "core" | "pro" | "enterprise";

const TIERS: Record<Tier, { amount: number; name: string; description: string }> = {
  core: {
    amount: 39900,
    name: "Buyer Radar — Core",
    description: "Daily buyer-intent alerts for industrial suppliers: federal contracts, building permits, hiring surges, SBA loans across MI manufacturing.",
  },
  pro: {
    amount: 59900,
    name: "Buyer Radar — Pro (Named-Account Watchlist)",
    description: "Everything in Core plus monitoring of your top 50 target accounts: any signal (contract win, permit, hiring, news, exec change) triggers an alert.",
  },
  enterprise: {
    amount: 79900,
    name: "Buyer Radar — Enterprise (RFQ Intercept)",
    description: "Everything in Pro plus daily RFQ intercept across SAM.gov, MITN, BidNetDirect for fab-metal NAICS (332/333/336) — your estimators see bids the day they drop.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, company_name, phone, contact_name, vertical, tier } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedTier: Tier = (tier && tier in TIERS) ? tier : "core";
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
        type: "buyer_radar_subscription",
        tier: selectedTier,
        email,
        company_name: company_name || "",
        contact_name: contact_name || "",
        phone: phone || "",
        vertical: vertical || "steel",
      },
      success_url: `${origin}/buyer-radar?success=1&tier=${selectedTier}`,
      cancel_url: `${origin}/buyer-radar`,
    });

    return new Response(JSON.stringify({ url: session.url, tier: selectedTier }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-buyer-radar-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

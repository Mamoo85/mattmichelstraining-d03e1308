// create-wire-checkout — $99/mo subscription to The Wire (contractor leads feed)
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, business_name, contact_name, phone, trades, cities } = await req.json();
    if (!email || !business_name) {
      return new Response(JSON.stringify({ error: "email and business_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "The Wire — Daily Contractor Leads",
            description: "Morning digest of fresh local contractor leads in your trades & cities. Cancel anytime.",
          },
          unit_amount: 9900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      success_url: `${origin}/the-wire?success=1`,
      cancel_url: `${origin}/the-wire?canceled=1`,
      metadata: {
        type: "wire_subscription",
        email,
        business_name,
        contact_name: contact_name || "",
        phone: phone || "",
        trades: JSON.stringify(trades || []),
        cities: JSON.stringify(cities || []),
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("[create-wire-checkout]", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const body = await req.json();
    // Accept both camelCase and snake_case field names
    const email = body.email;
    const name = body.name || "";
    const businessName = body.businessName || body.business_name || "";
    const industry = body.industry || "";
    const city = body.city || "";

    if (!email || !businessName) return new Response(JSON.stringify({ error: "email and business name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 6900,
          product_data: {
            name: "AI Competitor Watch — $69/month",
            description: "Weekly AI report on your top competitors' online presence",
          },
        },
        quantity: 1,
      }],
      metadata: { type: "competitor_watch_subscription", email, name, businessName, industry, city },
      success_url: `${origin}/competitor-watch?status=success`,
      cancel_url: `${origin}/competitor-watch`,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

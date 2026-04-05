import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ORIGINS = [
  "https://www.mattmichelstraining.com",
  "https://mattmichelstraining.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, phone, businessName, website, plan } = await req.json();

    if (!email || !businessName) {
      return new Response(
        JSON.stringify({ error: "Email and business name required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawOrigin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.mattmichelstraining.com";

    // Two tiers: standard ($1500 setup + $99/mo) or starter ($499 setup + $149/mo)
    const isStarter = plan === "starter";
    const setupAmount = isStarter ? 49900 : 150000;
    const monthlyAmount = isStarter ? 14900 : 9900;
    const setupLabel = isStarter ? "$499" : "$1,500";
    const monthlyLabel = isStarter ? "$149" : "$99";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: monthlyAmount,
            product_data: {
              name: `Digital Foundation — ${monthlyLabel}/mo`,
              description: "Custom website + GBP Auto-Poster (3x/week) + Missed Call Text-Back + hosting & maintenance",
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          type: "digital_foundation",
          email,
          name: name || "",
          businessName,
          phone: phone || "",
          website: website || "",
          plan: isStarter ? "starter" : "standard",
          setup_fee: setupLabel,
        },
      },
      metadata: {
        type: "digital_foundation",
        email,
        name: name || "",
        businessName,
        phone: phone || "",
        website: website || "",
        plan: isStarter ? "starter" : "standard",
        setup_fee: setupLabel,
      },
      payment_intent_data: undefined,
      success_url: `${origin}/digital-foundation?success=1`,
      cancel_url: `${origin}/digital-foundation`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[create-foundation-checkout]", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

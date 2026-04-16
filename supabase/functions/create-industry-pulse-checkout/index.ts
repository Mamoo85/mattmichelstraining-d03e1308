import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, company_name, phone, contact_name, target_industries } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          unit_amount: 9900, // $99/mo
          recurring: { interval: "month" },
          product_data: {
            name: "Industry Pulse Intelligence",
            description: "Daily predictive sales signals: MIOSHA compliance gaps, municipal bond funding, expansion hiring patterns across Metro Detroit industrial sectors.",
          },
        },
      }],
      metadata: {
        type: "industry_pulse_subscription",
        email,
        company_name: company_name || "",
        contact_name: contact_name || "",
        phone: phone || "",
        target_industries: Array.isArray(target_industries) ? target_industries.join(",") : "boiler,hvac,manufacturing",
      },
      success_url: `${origin}/industry-pulse?success=1`,
      cancel_url: `${origin}/industry-pulse`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-industry-pulse-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

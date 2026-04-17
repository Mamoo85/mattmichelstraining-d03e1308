import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { email, company_name, phone, target_roles, county } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 5000, // $50
            product_data: {
              name: "HireAlert — 10 Licensed Candidates (On-Demand)",
              description:
                "Instant delivery of 10 licensed tradesperson or healthcare professional names in your area. $5 refund per name if fewer than 10 are available.",
            },
          },
        },
      ],
      metadata: {
        type: "hire_alert_one_time",
        email,
        company_name: company_name || "",
        owner_phone: phone || "",
        target_roles: Array.isArray(target_roles) && target_roles.length
          ? target_roles.join(",")
          : "boiler_operator,hvac_tech",
        county: county || "",
        names_requested: "10",
        tos_version: "2026-04-fcra",
        data_classification: "b2b_market_intelligence_not_consumer_report",
      },
      success_url: `${origin}/hire-alert?success=ondemand`,
      cancel_url: `${origin}/hire-alert`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-hire-alert-one-time] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

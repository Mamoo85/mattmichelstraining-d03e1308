import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Price tiers (cents)
const PLAN_PRICES: Record<string, { cents: number; label: string }> = {
  basic: { cents: 900, label: "Athlete Nutrition Blueprint — Basic" },
  full: { cents: 1400, label: "Athlete Nutrition Blueprint — Full 7-Day Plan" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      plan = "basic",
      sport,
      weight_lbs,
      goal,
      dietary_restrictions,
      customer_email,
      position,
    } = await req.json();

    if (!customer_email) throw new Error("customer_email is required");
    if (!sport) throw new Error("sport is required");

    const planConfig = PLAN_PRICES[plan] || PLAN_PRICES.basic;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: planConfig.label,
            description: `Custom nutrition plan for ${sport}${position ? ` (${position})` : ""} — ${goal} — by Coach Matt Michels`,
          },
          unit_amount: planConfig.cents,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/nutrition-plan?status=success&email=${encodeURIComponent(customer_email)}`,
      cancel_url: `${origin}/nutrition-plan`,
      metadata: {
        type: "nutrition_plan",
        plan,
        sport,
        weight_lbs: String(weight_lbs || ""),
        goal: goal || "maintain",
        dietary_restrictions: (dietary_restrictions || "none").substring(0, 450),
        position: position || "",
        customer_email,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-NUTRITION-PLAN-CHECKOUT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// create-field-crm-checkout — Stripe checkout for M² Field CRM subscriptions
// Called from the Field CRM landing page with { email, name, business_name, phone, website, plan }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_PRICES: Record<string, number> = {
  standard: 19900,  // $199/mo
  pro: 29900,       // $299/mo
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, name, business_name, phone, website, plan = "standard", industry = "hvac" } = await req.json();

    if (!email || !business_name) {
      return new Response(JSON.stringify({ error: "email and business_name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const price = PLAN_PRICES[plan] || PLAN_PRICES.standard;
    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `M² Field CRM — ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
            description: "Visitor intelligence, dispatch map, review engine, pipeline CRM. Unlimited techs.",
          },
          unit_amount: price,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      metadata: {
        type: "field_crm_subscription",
        email,
        name: name || "",
        business_name,
        phone: phone || "",
        website: website || "",
        plan,
        industry,
      },
      success_url: `${origin}/field-crm?success=1&biz=${encodeURIComponent(business_name)}`,
      cancel_url: `${origin}/field-crm`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-FIELD-CRM-CHECKOUT]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

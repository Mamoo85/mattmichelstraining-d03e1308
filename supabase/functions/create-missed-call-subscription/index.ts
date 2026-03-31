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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, name, businessName, phone } = await req.json();

    if (!email || !businessName || !phone) {
      return new Response(
        JSON.stringify({ error: "email, businessName, and phone are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Insert pending row so we have a record even before payment
    await sb
      .from("missed_call_clients")
      .upsert(
        {
          email,
          contact_name: name || null,
          business_name: businessName,
          business_phone: phone,
          active: false,
        },
        { onConflict: "email" }
      );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      subscription_data: {
        trial_period_days: 7,
      },
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 9900,
          product_data: {
            name: "Missed Call Text-Back — $99/month",
            description: "Automatically texts callers back within seconds of a missed call. Never lose a lead again.",
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "missed_call_subscription",
        email,
        name: name || "",
        businessName,
        phone,
      },
      success_url: "https://www.mattmichelstraining.com/missed-call-text?status=success",
      cancel_url: "https://www.mattmichelstraining.com/missed-call-text",
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-MISSED-CALL-SUBSCRIPTION] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getStripeSecretKey, isStripeTestMode } from "../_shared/stripe-key.ts";

const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (isStripeTestMode()) console.warn("[create-missed-call-subscription] 🧪 TEST MODE");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

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
      payment_method_collection: "if_required",
      subscription_data: { trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } },
      discounts: [{ coupon: "s5f2M1Vq" }],
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 2500,
          product_data: {
          name: "TextBack — $99/month standalone ($49/mo bundled with any Radar)",
            description: "Automatically texts callers back within seconds of a missed call. Never lose a lead again. Statewide Michigan coverage. Bundle with Talent Radar, Growth Radar, or Demand Radar to drop to $49/mo.",
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
      success_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/missed-call-text?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/missed-call-text`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-MISSED-CALL-SUBSCRIPTION] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getStripeSecretKey, isStripeTestMode } from "../_shared/stripe-key.ts";

const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
if (isStripeTestMode()) console.warn("[create-blueprint-checkout] 🧪 TEST MODE");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 4700,
          product_data: {
            name: "Contractor Website Blueprint",
            description: "7-section guide: Google Business Profile setup, missed-call recovery, review automation, and the 90-day contractor website launch checklist.",
            images: ["https://detroitwebagent.com/dwa-og-image.png"],
          },
        },
      }],
      metadata: { type: "blueprint_purchase", email },
      success_url: `${origin}/blueprint-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/blueprint`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-blueprint-checkout] error:", err);
    return new Response(JSON.stringify({ error: err.message || "Checkout creation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

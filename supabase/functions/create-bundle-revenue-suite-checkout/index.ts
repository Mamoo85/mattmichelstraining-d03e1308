import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getStripeSecretKey, isStripeTestMode } from "../_shared/stripe-key.ts";

const STRIPE_SECRET_KEY = getStripeSecretKey();
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
if (isStripeTestMode()) console.warn("[create-bundle-revenue-suite-checkout] 🧪 TEST MODE");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { email, business_name, phone, city, business_type } = await req.json();

    if (!email || !business_name) {
      return new Response(
        JSON.stringify({ error: "email and business_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

    const rawOrigin = req.headers.get("origin") || "https://www.detroitwebagent.com";
    const ALLOWED = ["https://www.mattmichelstraining.com", "https://mattmichelstraining.com", "http://localhost:5173"];
    const origin = ALLOWED.includes(rawOrigin) ? rawOrigin : "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      payment_method_collection: "if_required",
      subscription_data: { trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } },
      discounts: [{ coupon: "s5f2M1Vq" }],
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: 29900,
            product_data: {
              name: "Revenue Suite — 8 Automated Revenue Tools",
              description: "Review Monitor, SMS Blast, No-Show Re-Booker, Estimate Drip, Invoice Chaser, After-Job Drip, Promo Blaster, Slow Day SMS — all included.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "bundle_revenue_suite",
        email,
        business_name,
        phone: phone || "",
        city: city || "",
        business_type: business_type || "",
      },
      success_url: `${origin}/bundle-revenue-suite?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/bundle-revenue-suite`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `🔥 Revenue Suite checkout started — ${business_name}`,
          html: `<p><strong>${business_name}</strong> started checkout for the Revenue Suite ($299/mo).<br>Email: ${email}<br>Phone: ${phone || "n/a"}<br>City: ${city || "n/a"}</p>`,
        }),
      });
    }

    console.log(`[REVENUE-SUITE] Checkout created for ${business_name}`);

    return new Response(
      JSON.stringify({ url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[REVENUE-SUITE] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getStripeSecretKey, isStripeTestMode } from "../_shared/stripe-key.ts";

const STRIPE_SECRET_KEY = getStripeSecretKey();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
if (isStripeTestMode()) console.warn("[create-field-service-checkout] 🧪 TEST MODE");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, company, plan, industry, test } = await req.json() as {
      email: string;
      name?: string;
      company?: string;
      plan: "standalone" | "bundle";
      industry?: string;
      test?: boolean;
    };

    const origin = req.headers.get("origin") ?? "https://mattmichelstraining.com";

    const isBundle = plan === "bundle";
    // $0 test mode — only allowed for Matt's email
    const isTest = test === true && email === "matt@detroitwebagent.com";
    const unitAmount = isTest ? 0 : (isBundle ? 19900 : 19900);
    const productName = isBundle
      ? "Detroit Web Agency — Field Service Platform (Website Bundle)"
      : "Detroit Web Agency — Field Service Platform (Standalone)";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Insert pending client row
    await sb.from("field_crm_clients").upsert({
      business_name: company || "New Client",
      owner_name: name ?? null,
      email: email,
      plan: plan ?? "standalone",
      industry: industry || "field_service",
      status: "pending",
    }, { onConflict: "email" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      payment_method_collection: "if_required",
      subscription_data: { trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } },
      discounts: [{ coupon: "s5f2M1Vq" }],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            recurring: { interval: "month" },
            product_data: { name: productName },
          },
        },
      ],
      metadata: {
        type: "field_crm_subscription",
        email,
        name: name ?? "",
        company: company ?? "",
        plan: plan ?? "standalone",
        industry: industry || "other",
      },
      success_url: `${origin}/field-service?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/field-service`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-field-service-checkout error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

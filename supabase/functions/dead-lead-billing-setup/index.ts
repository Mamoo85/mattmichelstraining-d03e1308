// dead-lead-billing-setup — creates a Stripe Checkout Session
// Default (setup mode): contractor saves card once; auto-charged $50 per revived lead.
// pilot_mode=true: $1 payment to prove it works; contractor_clients marked pilot_active=true.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeSecretKey, isStripeTestMode } from "../_shared/stripe-key.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = getStripeSecretKey();
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagent.com";
if (isStripeTestMode()) console.warn("[dead-lead-billing-setup] 🧪 TEST MODE");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

async function stripePost(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(STRIPE_SECRET_KEY + ":")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { contractor_id } = await req.json();
    if (!contractor_id) {
      return new Response(
        JSON.stringify({ error: "contractor_id required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Get contractor
    const { data: contractor } = await sb
      .from("contractor_clients" as any)
      .select("id, name, email, business_name, stripe_customer_id")
      .eq("id", contractor_id)
      .single();

    if (!contractor) {
      return new Response(
        JSON.stringify({ error: "Contractor not found" }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Create Stripe customer if needed
    let stripeCustomerId = (contractor as any).stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripePost("/customers", {
        email: contractor.email,
        name: (contractor as any).business_name || contractor.name,
        "metadata[contractor_id]": contractor_id,
      });
      stripeCustomerId = customer.id;
      await sb.from("contractor_clients" as any)
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", contractor_id);
    }

    // Create Stripe Checkout Session in setup mode
    const session = await stripePost("/checkout/sessions", {
      mode: "setup",
      customer: stripeCustomerId,
      "payment_method_types[0]": "card",
      "metadata[type]": "dead_lead_billing_setup",
      "metadata[contractor_id]": contractor_id,
      success_url: `${SITE_URL}/dead-lead-intake?billing=success`,
      cancel_url: `${SITE_URL}/dead-lead-intake?billing=cancel`,
    });

    if (session.error) {
      throw new Error(session.error.message);
    }

    return new Response(
      JSON.stringify({ ok: true, setup_url: session.url }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dead-lead-billing-setup]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

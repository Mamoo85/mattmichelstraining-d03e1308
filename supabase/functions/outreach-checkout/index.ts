// outreach-checkout — creates a Stripe Checkout session for the Autonomous SDR product
// POST { company_name, contact_email, contact_name?, industry?, geography?, trial? }
// → Returns { url: "https://checkout.stripe.com/...", client_id }
//
// Webhook handling (checkout.session.completed, customer.subscription.deleted)
// is done in stripe-webhook/index.ts — it already receives all Stripe events.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";
import { getStripeSecretKey } from "../_shared/stripe-key.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const MONTHLY_PRICE_CENTS = 99700; // $997/month
const TRIAL_DAYS = 14;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { company_name, contact_email, contact_name, industry, geography, trial } = await req.json();
    if (!company_name || !contact_email) {
      return new Response(JSON.stringify({ error: "company_name and contact_email are required" }), { status: 400 });
    }

    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    // Pre-create the outreach_clients row so we have an ID for the session metadata
    const { data: client, error: clientErr } = await sb.from("outreach_clients").insert({
      company_name,
      contact_name: contact_name || null,
      contact_email,
      target_industry: industry || "hvac",
      target_geography: geography || "Metro Detroit",
      daily_email_cap: 50,
      status: "trial",
      trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();

    if (clientErr) throw clientErr;

    const customer = await stripe.customers.create({
      email: contact_email,
      name: company_name,
      metadata: { outreach_client_id: client.id },
    });

    await sb.from("outreach_clients").update({ stripe_customer_id: customer.id }).eq("id", client.id);

    const useTrial = trial !== false;
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "Autonomous SDR — Detroit Web Agency",
            description: `Daily outreach to ${geography || "Metro Detroit"} ${industry || "trades"} businesses. 300 cold emails/day, D3/D7/D14 follow-up, hiring signal detection.`,
          },
          unit_amount: MONTHLY_PRICE_CENTS,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      ...(useTrial ? { subscription_data: { trial_period_days: TRIAL_DAYS } } : {}),
      success_url: `${origin}/my-outreach?client_id=${client.id}&welcome=1`,
      cancel_url: `${origin}/sdr-product?canceled=1`,
      metadata: {
        type: "outreach_subscription",
        client_id: client.id,
        company_name,
        contact_name: contact_name || "",
        industry: industry || "hvac",
        geography: geography || "Metro Detroit",
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, client_id: client.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[outreach-checkout]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

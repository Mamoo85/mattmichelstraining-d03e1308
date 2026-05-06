// create-techalert-sms-checkout
// $49/mo SMS-only TechAlert tier — no portal, no dashboard, just instant SMS alerts.
// POST { email, phone, city?, state? }

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagent.com";

function isValidEmail(s: string): boolean {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });

  let body: Record<string, any>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders }); }

  const { email, phone, city, state } = body;

  if (!isValidEmail(email)) return new Response(JSON.stringify({ error: "valid email required" }), { status: 400, headers: corsHeaders });
  if (!phone) return new Response(JSON.stringify({ error: "phone required for SMS tier" }), { status: 400, headers: corsHeaders });

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: "TechAlert SMS — Hiring Signal Alerts",
          description: "Instant SMS alerts when trade companies in your area post hiring signals. No portal — just a text when opportunity knocks. $49/mo, cancel anytime.",
        },
        unit_amount: 4900,
        recurring: { interval: "month" },
      },
      quantity: 1,
    }],
    metadata: {
      type: "hire_alert_sms_subscription",
      email,
      phone: String(phone).replace(/\D/g, ""),
      city: city || "",
      state: state || "MI",
      tier: "sms_only",
    },
    subscription_data: {
      trial_period_days: 7,
      metadata: {
        type: "hire_alert_sms_subscription",
        tier: "sms_only",
        phone: String(phone).replace(/\D/g, ""),
      },
    },
    success_url: `${SITE_URL}/talent-radar?subscribed=sms&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/talent-radar`,
    allow_promotion_codes: true,
  });

  return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

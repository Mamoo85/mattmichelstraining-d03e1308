// create-trade-radar-api-checkout
// $49/mo developer API tier for Trade Radar.
// POST { email, vertical }

import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagency.com";

const VALID_VERTICALS = ["roofing","hvac","plumbing","electrical","pest_control","gutters","exterior","tree","restoration","demo_junk","foundation"];

function isValidEmail(s: string): boolean {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });

  let body: Record<string, any>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders }); }

  const { email, vertical } = body;
  if (!isValidEmail(email)) return new Response(JSON.stringify({ error: "valid email required" }), { status: 400, headers: corsHeaders });
  if (!vertical || !VALID_VERTICALS.includes(vertical)) return new Response(JSON.stringify({ error: `vertical must be one of: ${VALID_VERTICALS.join(", ")}` }), { status: 400, headers: corsHeaders });

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `Trade Radar API — ${vertical.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`,
          description: "Developer API access to Trade Radar lead signals. GET /trade-radar-api with your API key. Up to 200 leads/request, 30-day rolling window. $49/mo.",
        },
        unit_amount: 4900,
        recurring: { interval: "month" },
      },
      quantity: 1,
    }],
    metadata: {
      type: "trade_radar_api_subscription",
      email,
      vertical,
    },
    success_url: `${SITE_URL}/trade-radar?api_subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/trade-radar`,
    allow_promotion_codes: true,
  });

  return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

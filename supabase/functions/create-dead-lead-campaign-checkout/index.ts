// create-dead-lead-campaign-checkout
// Self-serve Stripe checkout for Dead Lead Reactivation campaigns.
// Pricing: free setup, billed $50/reply (metered) OR flat $199 prepay for first 5 replies.
// POST { email, list_size, industry, campaign_name?, phone? }

import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

  const { email, list_size, industry, campaign_name, phone } = body;

  if (!isValidEmail(email)) return new Response(JSON.stringify({ error: "valid email required" }), { status: 400, headers: corsHeaders });
  if (!list_size || Number(list_size) < 1) return new Response(JSON.stringify({ error: "list_size required (minimum 1)" }), { status: 400, headers: corsHeaders });
  if (!industry) return new Response(JSON.stringify({ error: "industry required" }), { status: 400, headers: corsHeaders });

  const size = Math.min(Number(list_size), 10000);
  const name = String(campaign_name || `${industry} Re-engagement`).slice(0, 100);

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Check if contractor client exists
  const { data: contractor } = await sb
    .from("contractor_clients")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `Dead Lead Reactivation — ${name}`,
          description: `Reactivate up to ${size.toLocaleString()} dead leads via AI-powered SMS. You only pay $50 per positive reply received.`,
        },
        unit_amount: 0,   // $0 setup — billed per-reply via usage
      },
      quantity: 1,
    }],
    metadata: {
      type: "dead_lead_billing_setup",
      email,
      list_size: String(size),
      industry: String(industry).slice(0, 50),
      campaign_name: name,
      phone: phone || "",
      contractor_id: contractor?.id || "",
    },
    success_url: `${SITE_URL}/my-dead-lead-reactivation?session_id={CHECKOUT_SESSION_ID}&campaign=${encodeURIComponent(name)}`,
    cancel_url: `${SITE_URL}/dead-lead-reactivation`,
    allow_promotion_codes: true,
  });

  return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

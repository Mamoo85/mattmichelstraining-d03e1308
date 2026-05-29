// create-dwa-annual-checkout
// Annual subscription checkout for all 8 DWA products.
// 2 months free = 10 months billed annually (saves ~16%).
// POST { email, product, vertical? (for trade_radar), contact_name?, business_name?, phone? }

import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

// Annual price = 10 months (2 months free). Monthly shown for badge display.
const PRODUCTS: Record<string, { label: string; monthly_cents: number; annual_cents: number; webhook_type: string; success_path: string }> = {
  techalert:        { label: "TechAlert (Annual)",        monthly_cents: 14900, annual_cents: 149000, webhook_type: "hire_REDACTED",     success_path: "/talent-radar" },
  trade_radar:      { label: "Trade Radar (Annual)",       monthly_cents: 14900, annual_cents: 149000, webhook_type: "trade_radar_subscription_annual",     success_path: "/my-roofing-radar" },
  mortgage_radar:   { label: "Mortgage Radar (Annual)",    monthly_cents: 14900, annual_cents: 149000, webhook_type: "mortgage_radar_subscription_annual",  success_path: "/my-mortgage-radar" },
  fielddesk:        { label: "FieldDesk (Annual)",         monthly_cents: 19900, annual_cents: 199000, webhook_type: "field_service_subscription_annual",   success_path: "/field-service" },
  missed_call:      { label: "Missed-Call Catch (Annual)", monthly_cents:  9900, annual_cents:  99000, webhook_type: "missed_call_subscription_annual",     success_path: "/missed-call" },
  site_radar:       { label: "SiteRadar (Annual)",         monthly_cents:  4900, annual_cents:  49000, webhook_type: "site_radar_subscription_annual",      success_path: "/my-site-radar" },
  contractor_leads: { label: "Contractor Leads (Annual)",  monthly_cents: 39900, annual_cents: 399000, webhook_type: "contractor_lead_subscription_annual", success_path: "/contractor-leads" },
};

function isValidEmail(s: string): boolean {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });

  if (!STRIPE_SECRET_KEY) return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY missing" }), { status: 500, headers: corsHeaders });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders }); }

  const { email, product, vertical, contact_name, business_name, phone } = body as Record<string, any>;

  if (!isValidEmail(email)) return new Response(JSON.stringify({ error: "valid email required" }), { status: 400, headers: corsHeaders });

  const productKey = String(product || "").toLowerCase().replace(/-/g, "_");
  const config = PRODUCTS[productKey];
  if (!config) {
    return new Response(JSON.stringify({
      error: `unknown product: ${product}. Valid: ${Object.keys(PRODUCTS).join(", ")}`,
    }), { status: 400, headers: corsHeaders });
  }

  const label = productKey === "trade_radar" && vertical
    ? `${String(vertical).replace(/_/g, " ")} Radar (Annual)`
    : config.label;

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: label,
          description: `Annual plan — 2 months free vs monthly (saves $${(config.monthly_cents * 2 / 100).toFixed(0)}/yr)`,
        },
        unit_amount: config.annual_cents,
        recurring: { interval: "year" },
      },
      quantity: 1,
    }],
    metadata: {
      type: config.webhook_type,
      product: productKey,
      vertical: vertical || "",
      contact_name: contact_name || "",
      business_name: business_name || "",
      phone: phone || "",
      billing_cycle: "annual",
    },
    success_url: `${Deno.env.get("SITE_URL") || "https://detroitwebagent.com"}${productKey === "trade_radar" && vertical ? `/my-${String(vertical).replace(/_/g, "-")}-radar` : config.success_path}?session_id={CHECKOUT_SESSION_ID}&annual=true`,
    cancel_url: `${Deno.env.get("SITE_URL") || "https://detroitwebagent.com"}${productKey === "trade_radar" && vertical ? `/my-${String(vertical).replace(/_/g, "-")}-radar` : config.success_path}`,
    allow_promotion_codes: true,
  });

  return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

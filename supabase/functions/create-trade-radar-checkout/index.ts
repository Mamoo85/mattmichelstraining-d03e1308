// create-trade-radar-checkout — Stripe checkout for any of the 7 trade radar verticals.
// 7-day free trial (no CC required during trial). 50% off first 3 months via coupon LAUNCH50.
// POST { email, vertical, contact_name?, business_name?, phone?, zip_codes?, tcpa_consent }

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

// Full price in cents — Stripe applies 7-day trial + LAUNCH50 coupon automatically
const VERTICAL_PRICES: Record<string, { cents: number; label: string }> = {
  roofing:      { cents: 19900, label: "Roofing Radar" },
  hvac:         { cents: 24900, label: "HVAC Radar" },
  plumbing:     { cents: 19900, label: "Plumbing Radar" },
  electrical:   { cents: 19900, label: "Electrical Radar" },
  pest_control: { cents: 9900,  label: "Pest Control Radar" },
  gutters:      { cents: 12900, label: "Gutters Radar" },
  painting:     { cents: 14900, label: "Painting Radar" },
  exterior:     { cents: 14900, label: "Exterior Radar" },
  tree:         { cents: 14900, label: "Tree Service Radar" },
  restoration:  { cents: 24900, label: "Restoration Radar" },
  demo_junk:    { cents: 14900, label: "Demo & Junk Radar" },
  foundation:   { cents: 19900, label: "Foundation Radar" },
};

const PRODUCT_KEYS: Record<string, string> = {
  roofing: "trade_radar_roofing",
  hvac: "trade_radar_hvac",
  plumbing: "trade_radar_plumbing",
  electrical: "trade_radar_electrical",
  pest_control: "trade_radar_pest_control",
  gutters: "trade_radar_gutters",
  painting: "trade_radar_exterior",
  exterior: "trade_radar_exterior",
  tree: "trade_radar_tree",
  restoration: "trade_radar_restoration",
  demo_junk: "trade_radar_demo_junk",
  foundation: "trade_radar_foundation",
};

function isValidEmail(s: string): boolean {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: corsHeaders });
  }

  if (!STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY missing" }), { status: 500, headers: corsHeaders });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders }); }

  const {
    email, vertical, contact_name, business_name, phone,
    zip_codes, tcpa_consent,
  } = body as Record<string, any>;

  if (!isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "valid email required" }), { status: 400, headers: corsHeaders });
  }
  if (!vertical || !VERTICAL_PRICES[vertical as string]) {
    return new Response(JSON.stringify({ error: `unknown vertical: ${vertical}. Valid: ${Object.keys(VERTICAL_PRICES).join(", ")}` }), {
      status: 400, headers: corsHeaders,
    });
  }
  if (!tcpa_consent) {
    return new Response(JSON.stringify({ error: "tcpa_consent required" }), { status: 400, headers: corsHeaders });
  }

  const normalizedVertical = vertical as string;
  const priceConfig = VERTICAL_PRICES[normalizedVertical];
  const productKey = PRODUCT_KEYS[normalizedVertical] || `trade_radar_${normalizedVertical}`;
  const origin = req.headers.get("origin") || "https://detroitwebagent.com";
  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

  try {
    // Get or create Stripe customer
    let customerId: string;
    const existing = await stripe.customers.list({ email: email as string, limit: 1 });
    if (existing.data.length) {
      customerId = existing.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: email as string,
        name: (contact_name as string) || (business_name as string) || undefined,
        phone: phone as string || undefined,
        metadata: { vertical: vertical as string, source: "trade_radar_checkout" },
      });
      customerId = customer.id;
    }

    // Ensure LAUNCH50 coupon exists (50% off for 3 months)
    try {
      await stripe.coupons.retrieve("LAUNCH50");
    } catch {
      await stripe.coupons.create({
        id: "LAUNCH50",
        percent_off: 50,
        duration: "repeating",
        duration_in_months: 3,
        name: "Launch Pricing — 50% off first 3 months",
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      payment_method_collection: "if_required",
      discounts: [{ coupon: "s5f2M1Vq" }],
      // session-level metadata is what stripe-webhook reads at checkout.session.completed
      metadata: {
        type: "trade_radar_subscription",
        vertical: normalizedVertical,
        email: email as string,
        contact_name: (contact_name as string) ?? "",
        business_name: (business_name as string) ?? "",
        phone: (phone as string) ?? "",
        zip_codes: Array.isArray(zip_codes) ? (zip_codes as string[]).join(",") : ((zip_codes as string) ?? ""),
        tcpa_consent: "true",
        tcpa_consent_at: new Date().toISOString(),
      },
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: priceConfig.label,
            description: `Exclusive homeowner lead signals for ${normalizedVertical.replace(/_/g, " ")} contractors in your ZIPs. Delivered daily.`,
          },
          unit_amount: priceConfig.cents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: 7,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: {
          type: "trade_radar_subscription",
          vertical: normalizedVertical,
          email: email as string,
          contact_name: (contact_name as string) ?? "",
          business_name: (business_name as string) ?? "",
          phone: (phone as string) ?? "",
          zip_codes: Array.isArray(zip_codes) ? (zip_codes as string[]).join(",") : ((zip_codes as string) ?? ""),
          tcpa_consent: "true",
          tcpa_consent_at: new Date().toISOString(),
        },
      },
      success_url: `${origin}/my-${vertical}-radar?trial=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/start-trial?product=${productKey}`,
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-trade-radar-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});

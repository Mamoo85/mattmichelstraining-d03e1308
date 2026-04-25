// Mortgage Radar checkout — pre-trigger lead intelligence for loan officers
// $399/mo per LO (5 ZIPs included), $899/mo team (15 ZIPs)
// 100% public-record / behavioral signals — FCRA-clean, NOT bureau trigger leads
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getStripeSecretKey, isStripeTestMode } from "../_shared/stripe-key.ts";

const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
if (isStripeTestMode()) console.warn("[create-mortgage-radar-checkout] 🧪 TEST MODE");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = "solo" | "team";

const TIERS: Record<Tier, { amount: number; name: string; description: string; zips: number }> = {
  solo: {
    amount: 39900,
    zips: 5,
    name: "Mortgage Radar — Solo LO",
    description: "Daily in-market mortgage signals for one loan officer: permits, divorces, FSBO, foreclosure, new LLCs, job changes. 5 ZIP codes included. 100% public records — no bureau trigger leads.",
  },
  team: {
    amount: 89900,
    zips: 15,
    name: "Mortgage Radar — Team (5 LOs)",
    description: "Mortgage Radar for a 5-LO branch: 15 ZIPs included, shared lead pool with per-LO claim locks, weekly branch digest. Replaces $1k+/mo trigger lead spend with FCRA-clean public signals.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, business_name, contact_name, nmls_number, phone, zip_codes, extra_zip_count, tier } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedTier: Tier = (tier && tier in TIERS) ? tier : "solo";
    const t = TIERS[selectedTier];
    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    // Extra ZIPs add-on: $50/mo each beyond the base allotment
    const extraZips = Math.max(0, Number(extra_zip_count) || 0);
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: t.amount,
        recurring: { interval: "month" },
        product_data: { name: t.name, description: t.description },
      },
    }];

    if (extraZips > 0) {
      lineItems.push({
        quantity: extraZips,
        price_data: {
          currency: "usd",
          unit_amount: 5000,
          recurring: { interval: "month" },
          product_data: { name: "Mortgage Radar — Extra ZIP code", description: "Each additional ZIP code beyond your base plan." },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: lineItems,
      metadata: {
        type: "mortgage_radar_subscription",
        tier: selectedTier,
        email,
        business_name: business_name || "",
        contact_name: contact_name || "",
        nmls_number: nmls_number || "",
        phone: phone || "",
        zip_codes: Array.isArray(zip_codes) ? zip_codes.join(",") : (zip_codes || ""),
        extra_zip_count: String(extraZips),
      },
      success_url: `${origin}/mortgage-radar?success=1&tier=${selectedTier}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/mortgage-radar`,
    });

    return new Response(JSON.stringify({ url: session.url, tier: selectedTier }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-mortgage-radar-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

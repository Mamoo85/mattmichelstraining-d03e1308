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
    const { email, business_name, contact_name, nmls_number, phone, zip_codes, extra_zip_count, tier, dob, tcpa_consent, manual_ack, trial_mode, annual } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tcpa_consent || !manual_ack) {
      return new Response(JSON.stringify({ error: "TCPA consent and manual-outreach acknowledgment are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!dob) {
      return new Response(JSON.stringify({ error: "Date of birth is required (Michigan HB 4388)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const dobDate = new Date(dob);
    const ageYears = (Date.now() - dobDate.getTime()) / (365.25 * 86_400_000);
    if (Number.isNaN(ageYears) || ageYears < 18) {
      return new Response(JSON.stringify({ error: "Must be 18 or older" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedTier: Tier = (tier && tier in TIERS) ? tier : "solo";
    const t = TIERS[selectedTier];
    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    // Annual prepay: 2 months free (10 monthly payments billed annually)
    if (annual) {
      const annualTier: Tier = (tier && tier in TIERS) ? (tier as Tier) : "solo";
      const annualAmount = TIERS[annualTier].amount * 10;
      const annualSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: email,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: annualAmount,
            recurring: { interval: "year" },
            product_data: {
              name: `${TIERS[annualTier].name} — Annual (2 months free)`,
              description: "12 months for the price of 10. Billed once annually.",
            },
          },
        }],
        metadata: {
          type: "mortgage_radar_subscription",
          tier: annualTier,
          billing_cycle: "annual",
          email,
          business_name: business_name || "",
          contact_name: contact_name || "",
          nmls_number: nmls_number || "",
          phone: phone || "",
          zip_codes: Array.isArray(zip_codes) ? zip_codes.join(",") : (zip_codes || ""),
          dob: String(dob),
          tcpa_consent_at: new Date().toISOString(),
          manual_ack_at: new Date().toISOString(),
        },
        success_url: `${origin}/mortgage-radar?success=1&tier=${annualTier}&billing=annual&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/mortgage-radar`,
      });
      return new Response(JSON.stringify({ url: annualSession.url, billing: "annual" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First-10-free trial: capture card now, no charge until trial ends
    if (trial_mode) {
      const trialSession = await stripe.checkout.sessions.create({
        mode: "setup",
        payment_method_types: ["card"],
        customer_email: email,
        metadata: {
          type: "mortgage_radar_trial",
          tier: selectedTier,
          email,
          business_name: business_name || "",
          contact_name: contact_name || "",
          nmls_number: nmls_number || "",
          phone: phone || "",
          zip_codes: Array.isArray(zip_codes) ? zip_codes.join(",") : (zip_codes || ""),
          dob: String(dob),
          tcpa_consent_at: new Date().toISOString(),
          manual_ack_at: new Date().toISOString(),
        },
        success_url: `${origin}/mortgage-radar?trial=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/mortgage-radar`,
      });
      return new Response(JSON.stringify({ url: trialSession.url, trial: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        dob: String(dob),
        tcpa_consent_at: new Date().toISOString(),
        manual_ack_at: new Date().toISOString(),
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

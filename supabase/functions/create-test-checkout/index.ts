// CREATE TEST CHECKOUT — Admin Only
// Creates a real $0 Stripe checkout for any product so Matt can test the full
// purchase flow: checkout → webhook → delivery → email. Everything fires for real.
// Only works for Matt's email addresses.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const MATT_EMAILS = ["matt@mattmichelstraining.com", "matthewmichels@gmail.com", "matthewmichels4@gmail.com"];

const MATT = "matt@mattmichelstraining.com";
const SITE = "https://www.mattmichelstraining.com";

interface ProductConfig {
  name: string;
  description: string;
  mode: "payment" | "subscription";
  metadata: Record<string, string>;
  success_url: string;
}

const TEST_PRODUCTS: Record<string, ProductConfig> = {
  // ── INSTANT DELIVERY PRODUCTS ──────────────────────────────────────────────
  website_audit: {
    name: "TEST — AI Website Audit",
    description: "Full website audit delivered to your inbox within minutes.",
    mode: "payment",
    metadata: {
      type: "website_audit",
      email: MATT,
      business_name: "M² Performance Training",
      business_url: "mattmichelstraining.com",
      is_test: "true",
    },
    success_url: `${SITE}/audit-report?test=true`,
  },
  gbp_post_pack: {
    name: "TEST — GBP Post Pack",
    description: "30 Google Business Profile posts delivered to your inbox.",
    mode: "payment",
    metadata: {
      type: "gbp_post_pack",
      email: MATT,
      business_name: "M² Performance Training",
      business_info: JSON.stringify({ industry: "fitness training", city: "Grosse Pointe", business_info: "Performance training for athletes and families" }),
      is_test: "true",
    },
    success_url: `${SITE}/gbp-management?test=true`,
  },
  competitor_report: {
    name: "TEST — AI Competitor Report",
    description: "Full competitor analysis for your market.",
    mode: "payment",
    metadata: {
      type: "competitor_report",
      email: MATT,
      business_name: "M² Performance Training",
      industry: "fitness training",
      city: "Grosse Pointe",
      is_test: "true",
    },
    success_url: `${SITE}/audit-report?test=true`,
  },

  // ── SUBSCRIPTION PRODUCTS ──────────────────────────────────────────────────
  gbp_saas_subscription: {
    name: "TEST — GBP SaaS ($49/mo)",
    description: "AI posts 3x/week to Google Business Profile. $0 test.",
    mode: "subscription",
    metadata: {
      type: "gbp_saas_subscription",
      email: MATT,
      plan: "basic",
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/local-marketing?test=true`,
  },
  social_media_subscription: {
    name: "TEST — Social Media AI ($199/mo)",
    description: "3 posts/week to Facebook, Instagram, LinkedIn. $0 test.",
    mode: "subscription",
    metadata: {
      type: "social_media_subscription",
      email: MATT,
      plan: "standard",
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/social-media-ai?test=true`,
  },
  field_rep_subscription: {
    name: "TEST — Field Rep Tools ($29/mo)",
    description: "4 AI sales tools for field reps. $0 test.",
    mode: "subscription",
    metadata: {
      type: "field_rep_subscription",
      email: MATT,
      is_test: "true",
    },
    success_url: `${SITE}/field-rep-tools?test=true`,
  },
  contractor_lead_subscription: {
    name: "TEST — Contractor Leads ($399/mo)",
    description: "Exclusive local contractor leads. $0 test.",
    mode: "subscription",
    metadata: {
      type: "contractor_lead_subscription",
      email: MATT,
      businessName: "M² Test Roofing",
      trade: "roofing",
      city: "Grosse Pointe",
      is_test: "true",
    },
    success_url: `${SITE}/contractor-leads?test=true`,
  },
  b2b_database_subscription: {
    name: "TEST — B2B Database ($49/mo)",
    description: "Michigan dental office contacts database. $0 test.",
    mode: "subscription",
    metadata: {
      type: "b2b_database_subscription",
      email: MATT,
      niche: "dental",
      is_test: "true",
    },
    success_url: `${SITE}/b2b-leads?test=true`,
  },
  review_responder_subscription: {
    name: "TEST — Review Responder",
    description: "AI responds to Google reviews automatically. $0 test.",
    mode: "subscription",
    metadata: {
      type: "review_responder_subscription",
      email: MATT,
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/review-responder?test=true`,
  },
  seo_report_subscription: {
    name: "TEST — SEO Reports",
    description: "Monthly SEO audit reports. $0 test.",
    mode: "subscription",
    metadata: {
      type: "seo_report_subscription",
      email: MATT,
      businessName: "M² Performance Training",
      website: "mattmichelstraining.com",
      is_test: "true",
    },
    success_url: `${SITE}/seo-reports?test=true`,
  },
  chatbot_subscription: {
    name: "TEST — AI Chatbot",
    description: "AI chatbot for contractor websites. $0 test.",
    mode: "subscription",
    metadata: {
      type: "chatbot_subscription",
      email: MATT,
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/contractor-chatbot?test=true`,
  },
  missed_call_subscription: {
    name: "TEST — Missed Call Text",
    description: "Auto-texts back missed calls. $0 test.",
    mode: "subscription",
    metadata: {
      type: "missed_call_subscription",
      email: MATT,
      businessName: "M² Performance Training",
      is_test: "true",
    },
    success_url: `${SITE}/missed-call-text?test=true`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    // Verify the caller's JWT — must be a logged-in Supabase user with a Matt email
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized — no auth header" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await sbAuth.auth.getClaims(token);
    const userEmail = claimsData?.claims?.email as string | undefined;
    if (claimsError || !userEmail || !MATT_EMAILS.includes(userEmail)) {
      console.error("[TEST-CHECKOUT] Auth failed:", claimsError?.message, "email:", userEmail);
      return new Response(JSON.stringify({ error: "Unauthorized — test checkouts restricted to admin" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { product } = await req.json();
    const email = user.email!;

    const config = TEST_PRODUCTS[product];
    if (!config) {
      return new Response(JSON.stringify({ error: `Unknown product: ${product}`, available: Object.keys(TEST_PRODUCTS) }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const lineItem = {
      price_data: {
        currency: "usd",
        product_data: { name: config.name, description: config.description },
        unit_amount: 0,
        ...(config.mode === "subscription" ? { recurring: { interval: "month" as const } } : {}),
      },
      quantity: 1,
    };

    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      line_items: [lineItem],
      customer_email: email,
      metadata: { ...config.metadata, tester_email: email },
      success_url: config.success_url + "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: `${SITE}/admin`,
      payment_method_collection: "if_required", // $0 doesn't need payment method
    });

    console.log(`[TEST-CHECKOUT] ${product} — $0 session created for ${email}: ${session.id}`);
    return new Response(JSON.stringify({ url: session.url, session_id: session.id, product }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[TEST-CHECKOUT]", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

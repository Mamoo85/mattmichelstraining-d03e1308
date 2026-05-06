import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = "snapshot" | "weekly" | "enterprise";

const TIERS: Record<Tier, { mode: "payment" | "subscription"; amount: number; recurring: boolean; name: string; description: string }> = {
  snapshot: {
    mode: "payment",
    amount: 9900, // $99 one-time
    recurring: false,
    name: "Demand Radar — One-Time Snapshot",
    description: "One-time delivery of current Metro Detroit predictive sales signals: MIOSHA gaps, expansion patterns, bond filings. PDF + CSV.",
  },
  weekly: {
    mode: "subscription",
    amount: 19900, // $199/mo
    recurring: true,
    name: "Demand Radar — Weekly Digest",
    description: "Weekly email digest of new predictive sales signals across Metro Detroit. Cancel anytime.",
  },
  enterprise: {
    mode: "subscription",
    amount: 49900, // $499/mo
    recurring: true,
    name: "Demand Radar — Enterprise",
    description: "Daily statewide predictive intelligence with live dashboard, API access, and cross-referenced high-priority alerts.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, company_name, phone, contact_name, target_industries, tier, supplier_type, source_page } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedTier: Tier = (tier && tier in TIERS) ? tier : "weekly";
    const t = TIERS[selectedTier];
    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: t.mode,
      payment_method_types: ["card"],
      customer_email: email,
      // 7-day free trial on the $199/mo Weekly Digest tier only.
      // Snapshot is one-time payment and Enterprise is high-touch sales.
      ...(selectedTier === "weekly" ? { subscription_data: { trial_period_days: 7 } } : {}),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: t.amount,
          ...(t.recurring ? { recurring: { interval: "month" } } : {}),
          product_data: {
            name: t.name,
            description: t.description,
          },
        },
      }],
      metadata: {
        type: t.recurring ? "industry_pulse_subscription" : "industry_pulse_snapshot",
        tier: selectedTier,
        email,
        company_name: company_name || "",
        contact_name: contact_name || "",
        phone: phone || "",
        target_industries: Array.isArray(target_industries) ? target_industries.join(",") : (supplier_type || "general"),
        supplier_type: supplier_type || "",
      },
      success_url: `${origin}/${source_page === "demand-radar" ? "demand-radar" : "industry-pulse"}?success=1&tier=${selectedTier}`,
      cancel_url: `${origin}/${source_page === "demand-radar" ? "demand-radar" : "industry-pulse"}`,
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(JSON.stringify({ url: session.url, tier: selectedTier }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-industry-pulse-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

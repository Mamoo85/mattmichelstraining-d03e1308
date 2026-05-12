import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getStripeSecretKey, isStripeTestMode } from "../_shared/stripe-key.ts";

const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (isStripeTestMode()) console.warn("[create-hire-alert-checkout] 🧪 TEST MODE");

const BETA_LIMIT = 10;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { email, company_name, phone, plan, tier, target_roles, ref, county, target_state, target_metro, target_zip_prefixes, source_page } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    // Annual prepay: 2 months free (10 monthly payments billed annually)
    if (plan === "annual") {
      const annualSubPlan = tier === "bundle" ? "bundle" : "standalone";
      const monthlyAmount = annualSubPlan === "bundle" ? 7900 : 14900;
      const annualAmount = monthlyAmount * 10; // 10 months = 2 free
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
              name: `Talent Radar — Annual (2 months free)`,
              description: "12 months of Talent Radar for the price of 10. Billed once annually.",
            },
          },
        }],
        subscription_data: { trial_period_days: 7 },
        payment_method_collection: "if_required",
        metadata: {
          type: "hire_alert_subscription",
          plan: annualSubPlan,
          billing_cycle: "annual",
          email,
          company_name: company_name || "",
          owner_phone: phone || "",
          target_roles: Array.isArray(target_roles) && target_roles.length ? target_roles.join(",") : "boiler_operator,hvac_tech",
          target_state: (target_state || "MI").toUpperCase(),
          target_metro: (target_metro || "detroit").toLowerCase(),
          ref: ref || "direct",
        },
        success_url: `${origin}/talent-radar?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/hire-alert`,
      });
      return new Response(JSON.stringify({ url: annualSession.url, billing: "annual" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pay-per-hire tier: capture card now, charge $499 per confirmed hire later
    if (plan === "pay_per_hire") {
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        payment_method_types: ["card"],
        customer_email: email,
        metadata: {
          type: "techalert_pay_per_hire",
          email,
          company_name: company_name || "",
          owner_phone: phone || "",
          target_state: (target_state || "MI").toUpperCase(),
          target_metro: (target_metro || "detroit").toLowerCase(),
          target_roles: Array.isArray(target_roles) && target_roles.length ? target_roles.join(",") : "boiler_operator,hvac_tech",
          ref: ref || "direct",
        },
        success_url: `${origin}/talent-radar?success=1&plan=pay_per_hire&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/hire-alert`,
      });
      return new Response(JSON.stringify({ url: session.url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check active client count for dynamic pricing
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { count } = await sb
      .from("hire_alert_clients")
      .select("id", { count: "exact", head: true })
      .eq("active", true);

    const activeClients = count ?? 0;
    const isBeta = activeClients < BETA_LIMIT;

    // Determine pricing
    const resolvedPlan = plan === "bundle" ? "bundle" : "standalone";
    const resolvedState = (target_state || "MI").toUpperCase();
    const resolvedMetro = (target_metro || "detroit").toLowerCase();
    const isMI = resolvedState === "MI";
    const isPremiumMetro = ["dfw", "houston", "phoenix"].includes(resolvedMetro);
    let unitAmount: number;
    let pricingTier: string;

    if (isPremiumMetro) {
      // TX/AZ premium markets — no beta discount, full pricing
      unitAmount = resolvedPlan === "bundle" ? 9900 : 24900; // $99 / $249
      pricingTier = "premium_metro";
    } else if (isMI && isBeta) {
      // Michigan beta lock-in
      unitAmount = resolvedPlan === "bundle" ? 4900 : 9900; // $49 / $99
      pricingTier = "beta_grandfathered";
    } else if (resolvedPlan === "bundle") {
      unitAmount = 7900; // $79 standard bundle
      pricingTier = "standard";
    } else {
      unitAmount = 14900; // $149 standard
      pricingTier = "standard";
    }

    const metroLabels: Record<string, string> = {
      detroit: "Metro Detroit, MI",
      dfw: "Dallas–Fort Worth, TX",
      houston: "Houston Metro, TX",
      phoenix: "Phoenix Metro, AZ",
      atlanta: "Atlanta Metro, GA",
      miami: "Miami Metro, FL",
      nyc: "New York City Metro",
      la: "Los Angeles Metro, CA",
      chicago: "Chicago Metro, IL",
      philly: "Philadelphia Metro, PA",
      boston: "Boston Metro, MA",
    };
    const marketLabel = metroLabels[resolvedMetro] || resolvedState;

    const planLabel = resolvedPlan === "bundle"
      ? `Talent Radar + FieldDesk Bundle — ${marketLabel}`
      : `Talent Radar — ${marketLabel}${isMI && isBeta ? " (Beta)" : ""}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            recurring: { interval: "month" },
            product_data: {
              name: planLabel,
              description:
                "Daily alerts when licensed tradespeople become available across all of Michigan. Proprietary multi-source talent radar monitoring — license issuance, professional movement, live availability.",
            },
          },
        },
      ],
      metadata: {
        type: "hire_alert_subscription",
        plan: resolvedPlan,
        pricing_tier: pricingTier,
        email,
        company_name: company_name || "",
        owner_phone: phone || "",
        target_roles: Array.isArray(target_roles) && target_roles.length
          ? target_roles.join(",")
          : "boiler_operator,hvac_tech",
        target_state: resolvedState,
        target_metro: resolvedMetro,
        target_zip_prefixes: Array.isArray(target_zip_prefixes) ? target_zip_prefixes.join(",") : "",
        ref: ref || "direct",
        county: county || "",
        tos_accepted: "true",
        tos_version: "2026-04-fcra",
        data_classification: "b2b_market_intelligence_not_consumer_report",
      },
      success_url: `${origin}/${source_page === "healthcare" ? "talent-radar/healthcare" : "talent-radar"}?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${source_page === "healthcare" ? "talent-radar/healthcare" : "hire-alert"}`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-hire-alert-checkout] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

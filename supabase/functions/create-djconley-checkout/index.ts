// create-djconley-checkout
// Wave A4 — Stripe checkout for the DJ Conley / Forever-Pricing managed-website tiers.
// Two tiers, both lock today's price forever:
//   tier="monthly_499"          → $499/mo recurring, no setup fee
//   tier="build_499_plus_199"   → $499 one-time setup + $199/mo recurring
// metadata.type = "djconley_subscription"  (handled by stripe-webhook)
// metadata.tier, metadata.locked_price_cents, metadata.client_email
// Inline price_data per CLAUDE.md rule.

import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

type Tier = "monthly_499" | "build_499_plus_199";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tier: Tier = (body.tier === "build_499_plus_199" ? "build_499_plus_199" : "monthly_499");
    const email: string = String(body.email || "").trim().toLowerCase();
    const businessName: string = String(body.business_name || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

    // Reuse existing customer or let Stripe create one via customer_email
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const monthlyPriceCents = tier === "build_499_plus_199" ? 19900 : 49900;
    const setupPriceCents = tier === "build_499_plus_199" ? 49900 : 0;
    const productName =
      tier === "build_499_plus_199"
        ? "DWA Managed Website + Owner Dashboard (Build + Maintain)"
        : "DWA Managed Website + Owner Dashboard (All-in monthly)";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: monthlyPriceCents,
          product_data: {
            name: productName,
            description:
              "Forever Pricing — your monthly rate is locked at signup. Every future improvement is included free, forever.",
          },
        },
      },
    ];

    if (setupPriceCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: setupPriceCents,
          product_data: {
            name: "DWA Build — one-time setup",
            description: "Brand-new website, owner dashboard, full migration.",
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      customer: customerId,
      customer_email: customerId ? undefined : email,
      success_url: `${origin}/owner/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dj-conley`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          type: "djconley_subscription",
          tier,
          locked_price_cents: String(monthlyPriceCents),
          client_email: email,
          business_name: businessName,
          lock_version: "v1",
        },
      },
      metadata: {
        type: "djconley_subscription",
        tier,
        locked_price_cents: String(monthlyPriceCents),
        client_email: email,
        business_name: businessName,
        lock_version: "v1",
      },
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id, tier, locked_price_cents: monthlyPriceCents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[create-djconley-checkout] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

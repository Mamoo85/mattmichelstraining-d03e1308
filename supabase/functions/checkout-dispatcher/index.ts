// Generic checkout dispatcher — replaces dozens of per-SKU `create-*-checkout` functions.
// Frontend calls: supabase.functions.invoke("checkout-dispatcher", { body: { sku: "<sku>", ...overrides } })
//
// To migrate a `create-foo-checkout` function:
// 1. Add its entry to SKU_CATALOG below (price, metadata.type, mode, success/cancel URLs).
// 2. Update its frontend callsite to invoke "checkout-dispatcher" with { sku: "foo" }.
// 3. Delete the old function folder + its [functions.create-foo-checkout] block in config.toml.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SkuConfig = {
  // EITHER a Stripe price_id (preferred for subscriptions) OR inline price_data
  priceId?: string;
  priceData?: {
    currency: string;
    unit_amount: number;
    product_data: { name: string; description?: string };
    recurring?: { interval: "day" | "week" | "month" | "year" };
  };
  mode: "subscription" | "payment";
  // Routed by stripe-webhook via session.metadata.type
  metadataType: string;
  successUrl?: string; // path appended to origin; default /dashboard?checkout=success
  cancelUrl?: string;  // default /pricing?checkout=canceled
  allowPromotionCodes?: boolean;
  trialDays?: number;
};

// Starter catalog. Migrate SKUs into here as you retire per-product functions.
const SKU_CATALOG: Record<string, SkuConfig> = {
  // EXAMPLE — uncomment & adapt when migrating an existing checkout:
  // "ads-copy": {
  //   priceData: {
  //     currency: "usd",
  //     unit_amount: 4900,
  //     product_data: { name: "AI Ads Copy", description: "AI-generated ad copy monthly" },
  //     recurring: { interval: "month" },
  //   },
  //   mode: "subscription",
  //   metadataType: "ads_copy_subscription",
  // },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sku = String(body?.sku || "").trim();
    if (!sku) throw new Error("Missing 'sku' in request body");

    const cfg = SKU_CATALOG[sku];
    if (!cfg) throw new Error(`Unknown sku: ${sku}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Optional auth — try to identify user, but allow guest checkout
    let userEmail: string | undefined = body?.email;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await sb.auth.getUser(token);
      if (data?.user?.email) userEmail = data.user.email;
    }

    let customerId: string | undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "";
    const successUrl = body?.successUrl || cfg.successUrl || "/dashboard?checkout=success";
    const cancelUrl = body?.cancelUrl || cfg.cancelUrl || "/pricing?checkout=canceled";

    const lineItem: any = cfg.priceId
      ? { price: cfg.priceId, quantity: 1 }
      : { price_data: cfg.priceData, quantity: 1 };

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [lineItem],
      mode: cfg.mode,
      success_url: `${origin}${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${cancelUrl}`,
      allow_promotion_codes: cfg.allowPromotionCodes ?? true,
      metadata: { type: cfg.metadataType, sku, ...(body?.metadata || {}) },
    };

    if (cfg.mode === "subscription" && cfg.trialDays) {
      sessionParams.subscription_data = { trial_period_days: cfg.trialDays };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CHECKOUT-DISPATCHER] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

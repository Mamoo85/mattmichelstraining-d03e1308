import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_TIER_MAP: Record<string, string> = {
  "prod_UAlStH84vrByST": "basic",
  "prod_UAlTgNGJWmREZL": "foundation",
  "prod_UAlTkDlrDfDije": "custom",
  "prod_UAlUIuvjHBjtNL": "team_elite",
  // Legacy product IDs (keep for existing subscribers during transition)
  "prod_U9ppSReG0j0RIr": "basic",
  "prod_U9pqrtuc44EE4A": "foundation",
  "prod_U9pqNqVuxYD6kl": "custom",
  "prod_U9pq1sVSh9nOQi": "team_elite",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logStep("No auth header, returning unsubscribed");
      return new Response(JSON.stringify({ subscribed: false, subscription_tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      logStep("Auth failed, returning unsubscribed", { error: userError?.message });
      return new Response(JSON.stringify({ subscribed: false, subscription_tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found");
      // Sync free tier to profile
      await supabaseClient.from("profiles").update({ subscription_tier: "free" }).eq("user_id", user.id);
      return new Response(JSON.stringify({ subscribed: false, subscription_tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Sync stripe_customer_id
    await supabaseClient.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", user.id);

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let tier = "free";

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product;
      tier = PRODUCT_TIER_MAP[productId as string] || "basic";
      logStep("Active subscription found", { productId, tier, subscriptionEnd });
    } else {
      logStep("No active subscription");
    }

    // Sync tier to profile
    await supabaseClient.from("profiles").update({ subscription_tier: tier }).eq("user_id", user.id);

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      subscription_tier: tier,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

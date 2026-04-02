import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_TIER_MAP: Record<string, string> = {
  // ── Current monthly (prod_UBI*) ──────────────────────────────────────────
  "prod_UBI78IQsBpyfNw": "basic",        // Foundation $19.99/mo
  "prod_UEfNKQVnbRcu1F": "guided",       // M² Guided $59.99/mo  ← was missing
  "prod_UBI7Wdb3liTxiF": "foundation",   // Pro $149.99/mo
  "prod_UBI8SV9Fa6CibX": "custom",       // Elite $349.99/mo
  "prod_UBI8mP9jA5rV3U": "team_elite",   // Team Elite

  // ── Current annual (prod_UC3* / prod_UEf*) ───────────────────────────────
  "prod_UC3NyJRutYTL87": "basic",        // Foundation annual ← was missing
  "prod_UEfQGAQMjysPqV": "guided",       // Guided annual     ← was missing
  "prod_UC3OvNMcgtPafc": "foundation",   // Pro annual        ← was missing
  "prod_UC3ONcP6ZoWtdM": "custom",       // Elite annual      ← was missing

  // ── Previous generation (prod_UAl*) ─────────────────────────────────────
  "prod_UAlStH84vrByST": "basic",
  "prod_UAlTgNGJWmREZL": "foundation",
  "prod_UAlTkDlrDfDije": "custom",
  "prod_UAlUIuvjHBjtNL": "team_elite",

  // ── Legacy (prod_U9p*) ───────────────────────────────────────────────────
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

    // Check if this user is a child linked to a parent — if so, inherit parent's subscription
    const { data: childLink } = await supabaseClient
      .from("parent_child_links")
      .select("parent_user_id")
      .eq("child_user_id", user.id)
      .limit(1)
      .maybeSingle();

    let targetEmail = user.email;
    let targetUserId = user.id;

    if (childLink) {
      // Get parent's email for Stripe lookup
      const { data: parentProfile } = await supabaseClient
        .from("profiles")
        .select("email, user_id")
        .eq("user_id", childLink.parent_user_id)
        .single();

      if (parentProfile?.email) {
        targetEmail = parentProfile.email;
        targetUserId = parentProfile.user_id;
        logStep("Child account — inheriting parent subscription", { parentUserId: targetUserId });
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: targetEmail, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found");
      await supabaseClient.from("profiles").update({ subscription_tier: "free" }).eq("user_id", user.id);
      return new Response(JSON.stringify({ subscribed: false, subscription_tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Sync stripe_customer_id to the billing owner (parent or self)
    await supabaseClient.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", targetUserId);

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
      try {
        const endDate = new Date(subscription.current_period_end * 1000);
        subscriptionEnd = isNaN(endDate.getTime()) ? null : endDate.toISOString();
      } catch { subscriptionEnd = null; }

      // Multi-item support: check if this user has a specific subscription item mapped
      const { data: familyItem } = await supabaseClient
        .from("family_subscription_items")
        .select("tier, price_id")
        .eq("member_user_id", user.id)
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (familyItem) {
        tier = familyItem.tier;
        logStep("Tier from family item", { tier });
      } else {
        // Fallback: use first item (single-member or legacy subscription)
        productId = subscription.items.data[0].price.product;
        tier = PRODUCT_TIER_MAP[productId as string] || "basic";
        logStep("Active subscription found", { productId, tier, subscriptionEnd });
      }
    } else {
      logStep("No active subscription");
    }

    // Sync tier to the requesting user's profile (child or self)
    await supabaseClient.from("profiles").update({ subscription_tier: tier }).eq("user_id", user.id);

    // If this is a parent, also sync tier to all linked children
    if (!childLink) {
      const { data: children } = await supabaseClient
        .from("parent_child_links")
        .select("child_user_id")
        .eq("parent_user_id", user.id);

      if (children && children.length > 0) {
        // Only sync children who DON'T have their own family_subscription_items
        for (const c of children) {
          const { data: childItem } = await supabaseClient
            .from("family_subscription_items")
            .select("tier")
            .eq("member_user_id", c.child_user_id)
            .maybeSingle();

          if (childItem) {
            // Child has their own tier mapping — sync that
            await supabaseClient.from("profiles")
              .update({ subscription_tier: childItem.tier })
              .eq("user_id", c.child_user_id);
          } else {
            // Inherit parent's tier
            await supabaseClient.from("profiles")
              .update({ subscription_tier: tier })
              .eq("user_id", c.child_user_id);
          }
        }
        logStep("Synced tier to children", { childCount: children.length, tier });
      }
    }

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

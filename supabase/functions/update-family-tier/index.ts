import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tier → Stripe price mapping
const TIER_PRICES: Record<string, string> = {
  basic: "price_1TCPvZD52tPWee46bA8lKVBA",
  foundation: "price_1TCPwUD52tPWee46mjJXqu9b",
  custom: "price_1TCPwuD52tPWee46MpjphmuR",
  team_elite: "price_1TCPxJD52tPWee46WeEgLPli",
};

const PRICE_TO_TIER: Record<string, string> = Object.fromEntries(
  Object.entries(TIER_PRICES).map(([k, v]) => [v, k])
);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[UPDATE-FAMILY-TIER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("No auth");

    const token = authHeader.replace("Bearer ", "");
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userError } = await sb.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");
    const parentUserId = userData.user.id;
    logStep("Authenticated", { parentUserId });

    const { memberUserId, newTier } = await req.json();
    if (!memberUserId || !newTier) throw new Error("Missing memberUserId or newTier");
    if (!TIER_PRICES[newTier]) throw new Error(`Invalid tier: ${newTier}`);

    const newPriceId = TIER_PRICES[newTier];
    logStep("Request", { memberUserId, newTier, newPriceId });

    // Verify the parent has authority over this member
    if (memberUserId !== parentUserId) {
      const { data: link } = await sb
        .from("parent_child_links")
        .select("id")
        .eq("parent_user_id", parentUserId)
        .eq("child_user_id", memberUserId)
        .maybeSingle();
      if (!link) throw new Error("Not authorized to manage this member");
    }

    // Get parent's Stripe customer
    const { data: parentProfile } = await sb
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("user_id", parentUserId)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId = parentProfile?.stripe_customer_id;
    if (!customerId && parentProfile?.email) {
      const customers = await stripe.customers.list({ email: parentProfile.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        await sb.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", parentUserId);
      }
    }
    if (!customerId) throw new Error("No Stripe customer found. Subscribe first.");
    logStep("Stripe customer", { customerId });

    // Find existing active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    let subscription: Stripe.Subscription;

    if (subscriptions.data.length === 0) {
      // No active subscription — create one with this item
      logStep("Creating new subscription");
      subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: newPriceId, metadata: { member_user_id: memberUserId } }],
        proration_behavior: "create_prorations",
      });

      const item = subscription.items.data[0];
      await sb.from("family_subscription_items").upsert({
        parent_user_id: parentUserId,
        member_user_id: memberUserId,
        stripe_subscription_id: subscription.id,
        stripe_subscription_item_id: item.id,
        tier: newTier,
        price_id: newPriceId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "parent_user_id,member_user_id" });

      await sb.from("profiles").update({ subscription_tier: newTier }).eq("user_id", memberUserId);
      logStep("New subscription created", { subscriptionId: subscription.id });
    } else {
      subscription = subscriptions.data[0];
      logStep("Existing subscription found", { subscriptionId: subscription.id });

      // Check if this member already has a subscription item
      const { data: existingItem } = await sb
        .from("family_subscription_items")
        .select("*")
        .eq("parent_user_id", parentUserId)
        .eq("member_user_id", memberUserId)
        .maybeSingle();

      if (existingItem) {
        // Update existing subscription item's price (Stripe handles proration)
        logStep("Updating existing item", { itemId: existingItem.stripe_subscription_item_id });
        await stripe.subscriptionItems.update(existingItem.stripe_subscription_item_id, {
          price: newPriceId,
          proration_behavior: "create_prorations",
        });

        await sb.from("family_subscription_items").update({
          tier: newTier,
          price_id: newPriceId,
          updated_at: new Date().toISOString(),
        }).eq("id", existingItem.id);
      } else {
        // Add new subscription item for this member
        logStep("Adding new subscription item");
        const newItem = await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: newPriceId,
          proration_behavior: "create_prorations",
          metadata: { member_user_id: memberUserId },
        });

        await sb.from("family_subscription_items").insert({
          parent_user_id: parentUserId,
          member_user_id: memberUserId,
          stripe_subscription_id: subscription.id,
          stripe_subscription_item_id: newItem.id,
          tier: newTier,
          price_id: newPriceId,
        });
      }

      // Sync tier to profile
      await sb.from("profiles").update({ subscription_tier: newTier }).eq("user_id", memberUserId);
    }

    // Calculate new family total
    const { data: allItems } = await sb
      .from("family_subscription_items")
      .select("tier, member_user_id")
      .eq("parent_user_id", parentUserId);

    const tierPrices: Record<string, number> = {
      basic: 14.99,
      foundation: 39.99,
      custom: 99.99,
      team_elite: 149.99,
    };

    const familyTotal = (allItems || []).reduce((sum: number, item: any) => {
      return sum + (tierPrices[item.tier] || 0);
    }, 0);

    logStep("Complete", { familyTotal });

    return new Response(JSON.stringify({
      success: true,
      familyTotal: familyTotal.toFixed(2),
      memberTier: newTier,
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

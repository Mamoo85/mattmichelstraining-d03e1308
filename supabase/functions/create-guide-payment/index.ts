import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_DISCOUNTS: Record<string, number> = {
  basic: 10, foundation: 15, custom: 20, team_elite: 25,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { priceId, metadata: extraMetadata, giftCardCode } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    let customerEmail: string | undefined;
    let customerId: string | undefined;
    let userId: string | undefined;
    let tier = "free";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      if (userData?.user?.email) {
        customerEmail = userData.user.email;
        userId = userData.user.id;
        const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
        if (customers.data.length > 0) customerId = customers.data[0].id;
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("subscription_tier")
          .eq("user_id", userId)
          .single();
        tier = profile?.subscription_tier || "free";
      }
    }

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";

    const sessionMetadata: Record<string, string> = { priceId };
    if (extraMetadata && typeof extraMetadata === "object") {
      for (const [k, v] of Object.entries(extraMetadata)) {
        sessionMetadata[k] = String(v).substring(0, 500);
      }
    }

    // Get the price amount from Stripe to calculate gift card discount
    const stripePrice = await stripe.prices.retrieve(priceId);
    let originalAmountCents = stripePrice.unit_amount || 0;

    // Apply tier discount
    const discountPct = TIER_DISCOUNTS[tier] || 0;
    let tierDiscountCents = 0;
    if (discountPct > 0) {
      tierDiscountCents = Math.round(originalAmountCents * discountPct / 100);
    }

    let amountAfterTierCents = originalAmountCents - tierDiscountCents;

    // Apply gift card
    let giftCardAppliedCents = 0;
    let giftCardId: string | undefined;

    if (giftCardCode && userId) {
      const { data: card } = await supabaseClient
        .from("gift_cards")
        .select("*")
        .eq("code", giftCardCode.toUpperCase().trim())
        .eq("is_active", true)
        .single();

      if (card && card.remaining_balance > 0) {
        const cardBalanceCents = Math.round(card.remaining_balance * 100);
        giftCardAppliedCents = Math.min(cardBalanceCents, amountAfterTierCents);
        giftCardId = card.id;
        sessionMetadata.gift_card_code = giftCardCode;
        sessionMetadata.gift_card_id = card.id;
        sessionMetadata.gift_card_applied_cents = String(giftCardAppliedCents);
      }
    }

    const finalAmountCents = Math.max(0, amountAfterTierCents - giftCardAppliedCents);

    // Build line items with calculated final price
    const lineItemName = extraMetadata?.type === "custom_program"
      ? `M² Custom Program — ${extraMetadata.weeks || 4} Week`
      : "M² Training Product";

    let description = "";
    if (tierDiscountCents > 0) description += `Member discount: -$${(tierDiscountCents / 100).toFixed(2)}`;
    if (giftCardAppliedCents > 0) description += `${description ? " · " : ""}Gift card: -$${(giftCardAppliedCents / 100).toFixed(2)}`;

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: lineItemName,
            ...(description ? { description } : {}),
          },
          unit_amount: finalAmountCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/dashboard?purchase=success`,
      cancel_url: `${origin}/shop`,
      metadata: sessionMetadata,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // NOTE: Gift card deduction now happens in verify step / webhook after payment confirms
    // Store gift card info in metadata so it can be deducted after payment

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-GUIDE-PAYMENT] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

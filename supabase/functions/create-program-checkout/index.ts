import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_DISCOUNTS: Record<string, number> = {
  basic: 10, foundation: 15, custom: 20, team_elite: 25,
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROGRAM-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Auth failed");

    const user = userData.user;
    logStep("User authenticated", { email: user.email });

    const { programId, promoCode, giftCardCode } = await req.json();
    if (!programId) throw new Error("programId required");

    const { data: program, error: programError } = await supabaseClient
      .from("training_programs")
      .select("id, title, price, is_active, stripe_price_id, stripe_product_id")
      .eq("id", programId)
      .single();

    if (programError || !program) throw new Error("Program not found");
    if (!program.is_active) throw new Error("Program is not available");

    const { data: existing } = await supabaseClient
      .from("user_active_programs")
      .select("id")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .limit(1);

    if (existing && existing.length > 0) throw new Error("You already own this program");

    // Promo code discount
    let discountAmount = 0;
    let promoId: string | undefined;

    if (promoCode) {
      const { data: promo, error: promoError } = await supabaseClient
        .from("promotions")
        .select("*")
        .eq("code", promoCode.toUpperCase().trim())
        .eq("is_active", true)
        .single();

      if (promoError || !promo) throw new Error("Invalid or expired promo code");
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) throw new Error("This promo code has expired");
      if (promo.max_uses && promo.current_uses >= promo.max_uses) throw new Error("This promo code has reached its usage limit");
      if (promo.applies_to !== "all" && promo.applies_to !== "programs") {
        if (promo.specific_product_id && promo.specific_product_id !== programId) throw new Error("This promo code is not valid for this program");
      }

      if (promo.discount_type === "percent") {
        discountAmount = (program.price * promo.discount_value) / 100;
      } else {
        discountAmount = promo.discount_value;
      }
      promoId = promo.id;
    }

    // Tier discount (don't stack with promo)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single();

    const tier = profile?.subscription_tier || "free";
    const tierDiscountPct = TIER_DISCOUNTS[tier] || 0;
    if (tierDiscountPct > 0 && discountAmount === 0) {
      discountAmount = (program.price * tierDiscountPct) / 100;
    }

    let priceAfterDiscount = Math.max(0, program.price - discountAmount);

    // Gift card
    let giftCardApplied = 0;
    let giftCardId: string | undefined;

    if (giftCardCode) {
      const { data: card } = await supabaseClient
        .from("gift_cards")
        .select("*")
        .eq("code", giftCardCode.toUpperCase().trim())
        .eq("is_active", true)
        .single();

      if (card && card.remaining_balance > 0) {
        giftCardApplied = Math.min(card.remaining_balance, priceAfterDiscount);
        giftCardId = card.id;
        priceAfterDiscount = Math.max(0, priceAfterDiscount - giftCardApplied);
        logStep("Gift card applied", { code: giftCardCode, applied: giftCardApplied, remaining: priceAfterDiscount });
      }
    }

    const finalPriceCents = Math.round(priceAfterDiscount * 100);

    // If gift card covers full amount, activate directly without Stripe
    if (finalPriceCents === 0 && giftCardId) {
      // Deduct gift card
      const { data: currentCard } = await supabaseClient
        .from("gift_cards")
        .select("remaining_balance")
        .eq("id", giftCardId)
        .single();

      if (currentCard) {
        const newBalance = Math.max(0, currentCard.remaining_balance - giftCardApplied);
        await supabaseClient.from("gift_cards").update({
          remaining_balance: newBalance,
          is_active: newBalance > 0,
          redeemed_by: user.id,
          redeemed_at: new Date().toISOString(),
        }).eq("id", giftCardId);
      }

      // Activate program
      await supabaseClient.from("user_active_programs").insert({
        user_id: user.id,
        program_id: programId,
        status: "active",
      });

      logStep("Program activated via gift card (no Stripe needed)");
      return new Response(JSON.stringify({ activated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Stripe checkout
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";

    // Always use price_data with the calculated final price for consistency
    const lineItems = [{
      price_data: {
        currency: "usd",
        product_data: {
          name: program.title,
          description: giftCardApplied > 0
            ? `M² Interactive Program (Gift card: -$${giftCardApplied.toFixed(2)}${discountAmount > 0 ? `, Discount: -$${discountAmount.toFixed(2)}` : ""})`
            : discountAmount > 0
            ? `M² Interactive Program (Discount: -$${discountAmount.toFixed(2)})`
            : "M² Interactive Training Program",
        },
        unit_amount: finalPriceCents,
      },
      quantity: 1,
    }];

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/shop?program_purchased=${programId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
      metadata: {
        program_id: programId,
        user_id: user.id,
        type: "interactive_program",
        promo_id: promoId || "",
        promo_code: promoCode || "",
        gift_card_code: giftCardCode || "",
        gift_card_id: giftCardId || "",
        gift_card_applied: String(giftCardApplied),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, finalPrice: finalPriceCents / 100 });

    // NOTE: Promo usage increment moved to webhook (checkout.session.completed)
    // to avoid incrementing before payment is confirmed

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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

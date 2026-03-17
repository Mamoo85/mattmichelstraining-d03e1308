import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_DISCOUNTS: Record<string, number> = {
  basic: 10, pro: 15, elite: 20, team: 25,
};

const GIFT_CARD_PRICES: Record<number, string> = {
  25: "price_1TBrN7D52tPWee46oXruhpLi",
  50: "price_1TBrNhD52tPWee46AzyyW9gX",
  100: "price_1TBrO2D52tPWee464iT4y2rg",
  150: "price_1TBrOSD52tPWee468kpeMd4M",
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "M2-";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const logStep = (step: string, details?: any) => {
  console.log(`[GIFT-CARD] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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

    const { amount, recipientEmail } = await req.json();
    if (!amount || !GIFT_CARD_PRICES[amount]) throw new Error("Invalid gift card amount");

    const priceId = GIFT_CARD_PRICES[amount];

    // Check user's subscription tier for discount
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single();

    const tier = profile?.subscription_tier || "free";
    const discountPct = TIER_DISCOUNTS[tier] || 0;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const origin = req.headers.get("origin") || "https://m2training.lovable.app";
    const giftCode = generateCode();

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/shop?gift_card=success&code=${giftCode}`,
      cancel_url: `${origin}/shop`,
      metadata: {
        type: "gift_card",
        gift_code: giftCode,
        gift_amount: String(amount),
        recipient_email: recipientEmail || "",
        purchaser_id: user.id,
      },
    };

    // Apply tier discount
    if (discountPct > 0) {
      const coupon = await stripe.coupons.create({
        percent_off: discountPct,
        duration: "once",
        name: `Member ${discountPct}% discount`,
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
      logStep("Tier discount applied", { tier, discountPct });
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id });

    // Pre-create the gift card (will be activated by webhook or success verification)
    await supabaseClient.from("gift_cards").insert({
      code: giftCode,
      original_amount: amount,
      remaining_balance: amount,
      purchaser_id: user.id,
      recipient_email: recipientEmail || null,
      stripe_session_id: session.id,
      is_active: true,
    });

    logStep("Gift card pre-created", { code: giftCode, amount });

    return new Response(JSON.stringify({ url: session.url, code: giftCode }), {
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

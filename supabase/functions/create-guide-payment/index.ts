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
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
        // Get subscription tier for discount
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("subscription_tier")
          .eq("user_id", userId)
          .single();
        tier = profile?.subscription_tier || "free";
      }
    }

    const origin = req.headers.get("origin") || "https://m2training.lovable.app";

    const sessionMetadata: Record<string, string> = { priceId };
    if (extraMetadata && typeof extraMetadata === "object") {
      for (const [k, v] of Object.entries(extraMetadata)) {
        sessionMetadata[k] = String(v).substring(0, 500);
      }
    }

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/shop?purchase=success`,
      cancel_url: `${origin}/shop`,
      metadata: sessionMetadata,
    };

    // Apply tier discount
    const discountPct = TIER_DISCOUNTS[tier] || 0;
    if (discountPct > 0) {
      const coupon = await stripe.coupons.create({
        percent_off: discountPct,
        duration: "once",
        name: `Member ${discountPct}% discount`,
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    // Apply gift card as credit if provided
    if (giftCardCode && userId) {
      const { data: card } = await supabaseClient
        .from("gift_cards")
        .select("*")
        .eq("code", giftCardCode.toUpperCase().trim())
        .eq("is_active", true)
        .single();

      if (card && card.remaining_balance > 0) {
        sessionMetadata.gift_card_code = giftCardCode;
        sessionMetadata.gift_card_id = card.id;
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
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

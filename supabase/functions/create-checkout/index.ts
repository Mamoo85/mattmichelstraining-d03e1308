import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Auth failed");
    const user = userData.user;
    logStep("User authenticated", { email: user.email });

    const { priceId, promoCode, referralCode, trialDays, successUrl, cancelUrl, trialPath } = await req.json();
    if (!priceId) throw new Error("No priceId provided");
    logStep("Price ID received", { priceId, promoCode: promoCode || "none", referralCode: referralCode || "none", trialDays: trialDays || "none" });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }
    logStep("Customer lookup", { customerId: customerId || "new" });

    // Validate promo code if provided
    let stripeCouponId: string | undefined;
    let promoId: string | undefined;

    if (promoCode) {
      const { data: promo, error: promoError } = await supabaseClient
        .from("promotions")
        .select("*")
        .eq("code", promoCode.toUpperCase().trim())
        .eq("is_active", true)
        .single();

      if (promoError || !promo) {
        throw new Error("Invalid or expired promo code");
      }

      // Check expiry
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        throw new Error("This promo code has expired");
      }

      // Check max uses
      if (promo.max_uses && promo.current_uses >= promo.max_uses) {
        throw new Error("This promo code has reached its usage limit");
      }

      // Check applies_to scope
      if (promo.applies_to !== "all" && promo.applies_to !== "subscriptions") {
        throw new Error("This promo code is not valid for subscriptions");
      }

      logStep("Promo validated", { code: promo.code, type: promo.discount_type, value: promo.discount_value });

      // Create a Stripe coupon for this discount
      const couponParams: any = {
        name: `Promo: ${promo.code}`,
      };

      if (promo.discount_type === "percent") {
        couponParams.percent_off = promo.discount_value;
        // For subscriptions, apply once
        couponParams.duration = "once";
      } else {
        couponParams.amount_off = Math.round(promo.discount_value * 100);
        couponParams.currency = "usd";
        couponParams.duration = "once";
      }

      const coupon = await stripe.coupons.create(couponParams);
      stripeCouponId = coupon.id;
      promoId = promo.id;
      logStep("Stripe coupon created", { couponId: coupon.id });
    }

    // Handle referral code — gives friend 10% off first month
    let referralCouponId: string | undefined;
    let referralCodeValue: string | undefined;

    if (referralCode && !stripeCouponId) {
      // Validate referral code exists
      const { data: refRow } = await supabaseClient
        .from("referral_codes")
        .select("user_id, code")
        .eq("code", referralCode.toUpperCase().trim())
        .single();

      if (refRow && refRow.user_id !== user.id) {
        // Don't let users refer themselves
        const referralCoupon = await stripe.coupons.create({
          name: `Referral: ${refRow.code}`,
          percent_off: 10,
          duration: "once",
        });
        referralCouponId = referralCoupon.id;
        referralCodeValue = refRow.code;
        logStep("Referral coupon created", { couponId: referralCoupon.id, referrerUserId: refRow.user_id });
      }
    }

    const origin = req.headers.get("origin") || "";
    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl ? `${origin}${successUrl}` : `${origin}/dashboard?checkout=success`,
      cancel_url: cancelUrl ? `${origin}${cancelUrl}` : `${origin}/pricing?checkout=canceled`,
    };

    // Add trial period if specified
    if (trialDays && Number(trialDays) > 0) {
      sessionParams.subscription_data = {
        trial_period_days: Number(trialDays),
        metadata: { trial_path: trialPath || "basic" },
      };
      logStep("Trial period added", { days: trialDays, path: trialPath });
    }

    if (stripeCouponId) {
      sessionParams.discounts = [{ coupon: stripeCouponId }];
    } else if (referralCouponId) {
      sessionParams.discounts = [{ coupon: referralCouponId }];
    } else {
      // No custom discount — let Stripe's built-in promo code box appear
      sessionParams.allow_promotion_codes = true;
    }

    // Store promo ID and referral code in metadata
    const metadata: any = {};
    if (promoId) metadata.promo_id = promoId;
    if (referralCodeValue) metadata.referral_code = referralCodeValue;
    if (Object.keys(metadata).length > 0) {
      sessionParams.metadata = metadata;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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

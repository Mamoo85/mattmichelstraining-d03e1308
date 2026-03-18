import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");

    // Verify admin role
    const { data: isAdmin } = await supabaseClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const {
      code,
      discount_type,
      discount_value,
      duration,
      duration_in_months,
      max_redemptions,
      expires_at,
    } = await req.json();

    if (!code || !discount_type) throw new Error("Code and discount_type required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // Create the Stripe coupon first
    const couponParams: any = {
      name: `Promo: ${code.toUpperCase()}`,
      duration: duration || "once",
    };

    if (duration === "repeating" && duration_in_months) {
      couponParams.duration_in_months = Number(duration_in_months);
    }

    if (discount_type === "percent") {
      couponParams.percent_off = Number(discount_value);
    } else {
      couponParams.amount_off = Math.round(Number(discount_value) * 100);
      couponParams.currency = "usd";
    }

    const coupon = await stripe.coupons.create(couponParams);

    // Create the promotion code on top of the coupon
    const promoParams: any = {
      coupon: coupon.id,
      code: code.toUpperCase().trim(),
      active: true,
    };

    if (max_redemptions) {
      promoParams.max_redemptions = Number(max_redemptions);
    }

    if (expires_at) {
      promoParams.expires_at = Math.floor(new Date(expires_at).getTime() / 1000);
    }

    const promoCode = await stripe.promotionCodes.create(promoParams);

    console.log(`[CREATE-STRIPE-PROMO] Created promo code: ${promoCode.code}, coupon: ${coupon.id}`);

    return new Response(JSON.stringify({
      success: true,
      promo_code_id: promoCode.id,
      coupon_id: coupon.id,
      code: promoCode.code,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[CREATE-STRIPE-PROMO] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

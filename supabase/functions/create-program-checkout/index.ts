import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Not authenticated");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Auth failed");

    const user = userData.user;
    logStep("User authenticated", { email: user.email });

    const { programId, promoCode } = await req.json();
    if (!programId) throw new Error("programId required");

    // Fetch program details
    const { data: program, error: programError } = await supabaseClient
      .from("training_programs")
      .select("id, title, price, is_active, stripe_price_id, stripe_product_id")
      .eq("id", programId)
      .single();

    if (programError || !program) throw new Error("Program not found");
    if (!program.is_active) throw new Error("Program is not available");

    logStep("Program found", { title: program.title, price: program.price });

    // Check if user already owns this program
    const { data: existing } = await supabaseClient
      .from("user_active_programs")
      .select("id")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error("You already own this program");
    }

    // Validate promo code if provided
    let discountAmount = 0;
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

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        throw new Error("This promo code has expired");
      }

      if (promo.max_uses && promo.current_uses >= promo.max_uses) {
        throw new Error("This promo code has reached its usage limit");
      }

      if (promo.applies_to !== "all" && promo.applies_to !== "programs") {
        // Check specific product
        if (promo.specific_product_id && promo.specific_product_id !== programId) {
          throw new Error("This promo code is not valid for this program");
        }
      }

      logStep("Promo validated", { code: promo.code, type: promo.discount_type, value: promo.discount_value });

      if (promo.discount_type === "percent") {
        discountAmount = (program.price * promo.discount_value) / 100;
      } else {
        discountAmount = promo.discount_value;
      }

      promoId = promo.id;
    }

    const finalPrice = Math.max(0, program.price - discountAmount);
    logStep("Final price calculated", { original: program.price, discount: discountAmount, final: finalPrice });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://m2training.lovable.app";

    // Use proper Stripe price ID if available, otherwise use price_data
    const lineItems = program.stripe_price_id
      ? [{
          price: program.stripe_price_id,
          quantity: 1,
        }]
      : [{
          price_data: {
            currency: "usd",
            product_data: {
              name: program.title,
              description: discountAmount > 0
                ? `M² Interactive Training Program (Promo applied: -$${discountAmount.toFixed(2)})`
                : "M² Interactive Training Program",
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: 1,
        }];

    // If using a Stripe price but there's a discount, create a coupon
    let discounts: any[] | undefined;
    if (program.stripe_price_id && discountAmount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(discountAmount * 100),
        currency: "usd",
        duration: "once",
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      ...(discounts ? { discounts } : {}),
      mode: "payment",
      success_url: `${origin}/shop?program_purchased=${programId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop`,
      metadata: {
        program_id: programId,
        user_id: user.id,
        type: "interactive_program",
        promo_code: promoCode || "",
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Increment promo usage
    if (promoId) {
      const { data: currentPromo } = await supabaseClient
        .from("promotions")
        .select("current_uses")
        .eq("id", promoId)
        .single();

      await supabaseClient
        .from("promotions")
        .update({ current_uses: (currentPromo?.current_uses || 0) + 1 })
        .eq("id", promoId);
      logStep("Promo usage incremented");
    }

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

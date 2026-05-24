// Creates a Stripe Checkout session for a Guilds & Grains subscription plan.
// Public function (verify_jwt=false). Accepts guest checkout (no auth required).
// POST { plan_slug: string, email?: string, success_path?: string, cancel_path?: string }
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const planSlug = String(body.plan_slug ?? "").trim();
    if (!planSlug) throw new Error("plan_slug required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: plan, error } = await sb
      .from("gng_subscription_plans")
      .select("slug,name,description,price_cents,currency,interval,is_digital,cover_image_url")
      .eq("slug", planSlug)
      .eq("active", true)
      .maybeSingle();
    if (error || !plan) throw new Error("plan_not_found");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("stripe_key_missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as any });

    const origin = req.headers.get("origin") || "https://m2training.lovable.app";
    const successPath = String(body.success_path ?? "/gng/subscriptions/success");
    const cancelPath = String(body.cancel_path ?? "/gng/subscriptions");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: body.email ? String(body.email) : undefined,
      line_items: [{
        price_data: {
          currency: plan.currency ?? "usd",
          unit_amount: plan.price_cents,
          recurring: { interval: (plan.interval as any) ?? "month" },
          product_data: {
            name: plan.name,
            description: plan.description ?? undefined,
            images: plan.cover_image_url ? [plan.cover_image_url] : undefined,
          },
        },
        quantity: 1,
      }],
      // Physical box plans need a shipping address; digital plans skip it
      shipping_address_collection: plan.is_digital ? undefined : { allowed_countries: ["US", "CA"] },
      allow_promotion_codes: true,
      success_url: `${origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${cancelPath}`,
      metadata: { type: "gng_subscription", plan_slug: plan.slug },
      subscription_data: {
        metadata: { type: "gng_subscription", plan_slug: plan.slug },
      },
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

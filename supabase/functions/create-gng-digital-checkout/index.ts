// Stripe one-time checkout for a Guilds & Grains digital product.
// Public (no auth). POST { product_slug: string, email?: string }
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
    const slug = String(body.product_slug ?? "").trim();
    if (!slug) throw new Error("product_slug required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: p, error } = await sb
      .from("gng_digital_products")
      .select("slug,name,description,price_cents,currency,preview_image_url")
      .eq("slug", slug).eq("active", true).maybeSingle();
    if (error || !p) throw new Error("product_not_found");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("stripe_key_missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as any });

    const origin = req.headers.get("origin") || "https://m2training.lovable.app";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: body.email ? String(body.email) : undefined,
      line_items: [{
        price_data: {
          currency: p.currency ?? "usd",
          unit_amount: p.price_cents,
          product_data: {
            name: p.name,
            description: p.description ?? undefined,
            images: p.preview_image_url ? [p.preview_image_url] : undefined,
          },
        },
        quantity: 1,
      }],
      allow_promotion_codes: true,
      success_url: `${origin}/gng/downloads?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/gng/downloads`,
      metadata: { type: "gng_digital", product_slug: p.slug },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

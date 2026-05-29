// v4 §5 — Add-On Marketplace Stripe checkout
// Accepts { addon_slug, client_email } and creates a recurring Stripe subscription.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { addon_slug, client_email } = await req.json();
    if (!addon_slug || !client_email) {
      return new Response(JSON.stringify({ error: "addon_slug and client_email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: addon, error } = await sb
      .from("addon_catalog" as any)
      .select("*")
      .eq("slug", addon_slug)
      .eq("active", true)
      .maybeSingle();

    if (error || !addon) {
      return new Response(JSON.stringify({ error: "addon not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-11-20.acacia" });
    const origin = req.headers.get("origin") ?? "https://detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: client_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: (addon as any).monthly_price_cents,
            recurring: { interval: "month" },
            product_data: {
              name: `${(addon as any).name} (Add-on)`,
              description: (addon as any).pitch,
            },
          },
        },
      ],
      success_url: `${origin}/my-addons?session_id={CHECKOUT_SESSION_ID}&added=${addon_slug}`,
      cancel_url: `${origin}/my-addons`,
      metadata: {
        type: "addon_subscription",
        addon_slug,
        client_email,
      },
    });

    // Track the pitch
    await sb.from("addon_pitches" as any).insert({
      client_email,
      addon_slug,
      outcome: "pending",
      stripe_session_id: session.id,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

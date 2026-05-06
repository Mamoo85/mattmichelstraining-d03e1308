// One-time $50 checkout for "5 More Dossiers" pack (upgrade from free dossier preview).
// Public endpoint — guest checkout supported. Email collected on request-free-dossier flow.
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

function validEmail(e: unknown): e is string {
  return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 255;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { email, signal_id } = await req.json().catch(() => ({}));
    if (!validEmail(email)) {
      return new Response(JSON.stringify({ error: "Valid email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const cleanEmail = (email as string).trim().toLowerCase();

    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-08-27.basil" });

    // Reuse Stripe customer if exists.
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: cleanEmail, limit: 1 });
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : cleanEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 5000,
          product_data: {
            name: "5 More Industrial Growth Dossiers",
            description: "5 freshly-curated 1-page intelligence dossiers on Metro Detroit manufacturers about to spend on supplier consumables. Delivered within 24 hours.",
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/get-dossier?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/get-dossier?checkout=canceled`,
      metadata: {
        type: "dossier_pack_5",
        email: cleanEmail,
        signal_id: signal_id || "",
      },
    });

    // Mark the free request as upgraded (best-effort).
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      await sb
        .from("free_dossier_requests")
        .update({ status: "upgrade_clicked", stripe_session_id: session.id })
        .eq("email", cleanEmail)
        .eq("status", "preview_sent");
    } catch (e) {
      console.error("[create-dossier-pack-checkout] log update failed", e);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-dossier-pack-checkout] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

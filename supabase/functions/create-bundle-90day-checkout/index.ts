import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
    const company = typeof body.company === "string" ? body.company.trim().slice(0, 200) : undefined;

    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-08-27.basil" });
    const origin = req.headers.get("origin") || "https://detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "Website + FieldDesk Bundle (First 90 Days)",
            description: "New website + FieldDesk dispatch + Missed-Call Catch + SiteRadar — set up and managed for the first 90 days.",
          },
          unit_amount: 49900,
        },
        quantity: 1,
      }],
      metadata: {
        type: "bundle_90day_purchase",
        company: company || "",
      },
      success_url: `${origin}/bundle-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/website-plus-fielddesk?canceled=1`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

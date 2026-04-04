import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const { email, businessName, contactName, industry, targetTitle } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: cors });
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      metadata: { type: "linkedin_outreach_subscription", email, businessName: businessName || email, contactName: contactName || "", industry: industry || "", targetTitle: targetTitle || "" },
      line_items: [{ price_data: { currency: "usd", unit_amount: 7900, recurring: { interval: "month" }, product_data: { name: "AI LinkedIn Outreach Sequences" } }, quantity: 1 }],
      success_url: `${req.headers.get("origin") || "https://mattmichelstraining.com"}/linkedin-outreach?status=success`,
      cancel_url: `${req.headers.get("origin") || "https://mattmichelstraining.com"}/linkedin-outreach`,
    });
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors }); }
});

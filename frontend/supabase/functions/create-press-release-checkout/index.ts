import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email, name, businessName, city, industry } = await req.json();
    if (!email || !businessName) return new Response(JSON.stringify({ error: "email and businessName required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", payment_method_types: ["card"], customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 3900, product_data: { name: "AI Press Release Service — $39/month", description: "Monthly AI-written press release about your business, ready to submit to local media." } }, quantity: 1 }],
      metadata: { type: "press_release_subscription", email, name: name || "", businessName, city: city || "", industry: industry || "" },
      success_url: "https://www.mattmichelstraining.com/ai-press-release?status=success",
      cancel_url: "https://www.mattmichelstraining.com/ai-press-release",
    });
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } }); }
});

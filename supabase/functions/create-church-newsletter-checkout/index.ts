import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email, name, businessName, denomination } = await req.json();
    if (!email || !businessName) return new Response(JSON.stringify({ error: "email and businessName required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", payment_method_types: ["card"], customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 2900, product_data: { name: "AI Church & Nonprofit Newsletter — $29/month", description: "Monthly AI-written congregation newsletter, weekly bulletin content, and sermon summaries." } }, quantity: 1 }],
      metadata: { type: "church_newsletter", email, name: name || "", businessName, denomination: denomination || "" },
      success_url: "https://www.mattmichelstraining.com/ai-church-newsletter?status=success",
      cancel_url: "https://www.mattmichelstraining.com/ai-church-newsletter",
    });
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } }); }
});

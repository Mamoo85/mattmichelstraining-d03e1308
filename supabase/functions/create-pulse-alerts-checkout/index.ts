import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email, phone, businessName, vertical, city } = await req.json();
    if (!email || !phone) {
      return new Response(JSON.stringify({ error: "email and phone required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 2900,
          product_data: {
            name: "Pulse Alerts — $29/month",
            description: "Same-hour SMS alerts when Metro Detroit manufacturers post hiring signals. First dossier free.",
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "pulse_alerts_subscription",
        email,
        phone,
        business_name: businessName || "",
        vertical: vertical || "",
        city: city || "",
      },
      success_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/pulse-alerts?status=success`,
      cancel_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/pulse-alerts`,
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { email, business_name } = body;
    if (!email) return new Response(JSON.stringify({ error: "Email required" }), { status: 400, headers: corsHeaders });

    const origin = req.headers.get("origin") || "https://mattmichelstraining.com";

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
            name: "Storm Damage Lead Blaster",
            description: "Real-time severe weather SMS alerts matched to your service area. Never miss a storm lead.",
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "storm_lead_subscription",
        email,
        businessName: business_name || "",
        phone: body.phone || "",
        zip_codes: (body.zip_codes || []).join(","),
        trade: body.trade || "",
      },
      success_url: `${origin}/storm-leads?success=1`,
      cancel_url: `${origin}/storm-leads`,
    });

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          subject: `💰 New Storm Damage Lead Blaster signup — ${business_name || email}`,
          html: `<p><strong>${business_name || email}</strong> just started checkout for Storm Damage Lead Blaster.</p><p>Email: ${email}</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: corsHeaders });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[CHECKOUT] Error:`, msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});

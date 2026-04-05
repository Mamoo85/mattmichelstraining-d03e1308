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

    const tier = body.tier === "subscription" ? "subscription" : "one-time";
    const isSubscription = tier === "subscription";

    const mode = isSubscription ? "subscription" : "payment";
    const unitAmount = isSubscription ? 2900 : 4900;
    const label = isSubscription ? "Tech Support Monthly" : "Remote Tech Support Session";
    const description = isSubscription
      ? "Monthly tech support subscription with priority scheduling."
      : "One-time remote tech support session. Matt will contact you within 24 hours.";

    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          ...(isSubscription ? { recurring: { interval: "month" } } : {}),
          unit_amount: unitAmount,
          product_data: { name: label, description },
        },
        quantity: 1,
      }],
      metadata: {
        type: "tech_support_session",
        email,
        businessName: business_name || "",
        name: body.name || "",
        phone: body.phone || "",
        issue: body.issue_description || "",
        tier,
      },
      success_url: `${origin}/tech-support?success=1`,
      cancel_url: `${origin}/tech-support`,
    });

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          subject: `💰 New ${label} signup — ${business_name || email}`,
          html: `<p><strong>${business_name || email}</strong> just started checkout for ${label}.</p><p>Email: ${email}</p>`,
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

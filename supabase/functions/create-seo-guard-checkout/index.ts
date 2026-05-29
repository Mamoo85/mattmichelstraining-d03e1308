import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { email, business_name, website_url, keywords, phone } =
      await req.json();

    if (!email || !website_url) {
      return new Response(
        JSON.stringify({ error: "email and website_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const rawOrigin =
      req.headers.get("origin") || "https://www.detroitwebagent.com";
    const ALLOWED = [
      "https://www.mattmichelstraining.com",
      "https://mattmichelstraining.com",
      "http://localhost:5173",
      "http://localhost:3000",
    ];
    const origin = ALLOWED.includes(rawOrigin)
      ? rawOrigin
      : "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            unit_amount: 2900,
            product_data: {
              name: "M2 SEO Guard — Weekly SEO Monitoring",
              description:
                "JS visibility check, keyword rank tracking, citation health, indexation monitoring, AI audit reports, SMS alerts.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "seo_guard_subscription",
        email,
        business_name: business_name || "",
        website_url,
        keywords: (keywords || "").toString(),
        phone: phone || "",
      },
      success_url: `${origin}/seo-guard?status=success`,
      cancel_url: `${origin}/seo-guard`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "M² System <matt@detroitwebagent.com>",
          to: ["matt@detroitwebagent.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `New SEO Guard checkout — ${business_name || email} ($29/mo)`,
          html: `<p><strong>${business_name || email}</strong> started SEO Guard trial.<br>URL: ${website_url}<br>Keywords: ${keywords || "none"}<br>Phone: ${phone || "n/a"}</p>`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-SEO-GUARD-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

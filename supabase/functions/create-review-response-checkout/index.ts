import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { businessName, email, phone, industry, googlePlaceId, brandVoice } = await req.json();
    if (!businessName || !email) throw new Error("Business name and email required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "AI Review Response Service", description: "Daily AI-drafted review responses in your brand voice" },
          unit_amount: 4900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      mode: "subscription",
      success_url: `${req.headers.get("origin") || "https://www.mattmichelstraining.com"}/ai-review-response?success=true`,
      cancel_url: `${req.headers.get("origin") || "https://www.mattmichelstraining.com"}/ai-review-response?canceled=true`,
      metadata: {
        type: "review_response_subscription",
        businessName, email, phone: phone || "", industry: industry || "",
        googlePlaceId: googlePlaceId || "", brandVoice: brandVoice || "",
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : "Unknown error") }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

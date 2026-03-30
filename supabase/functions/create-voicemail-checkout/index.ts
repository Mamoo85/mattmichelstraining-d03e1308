import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, name, businessName, phone } = await req.json();
    if (!email || !businessName || !phone) {
      return new Response(JSON.stringify({ error: "email, businessName, and phone are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      subscription_data: { trial_period_days: 7 },
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 4900, product_data: { name: "AI Voicemail Transcription — $49/month", description: "AI transcribes and summarizes voicemails. Delivered via text and email instantly." } }, quantity: 1 }],
      metadata: { type: "voicemail_transcription_subscription", email, name: name || "", businessName, phone },
      success_url: "https://www.mattmichelstraining.com/ai-voicemail?status=success",
      cancel_url: "https://www.mattmichelstraining.com/ai-voicemail",
    });
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[CREATE-VOICEMAIL-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

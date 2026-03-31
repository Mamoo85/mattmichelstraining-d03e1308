import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, name, business_name, business_type, city, phone } = await req.json();

    if (!email || !business_name) {
      return new Response(
        JSON.stringify({ error: "email and business_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: client } = await sb
      .from("chatbot_clients")
      .insert({
        business_name,
        business_type: business_type || null,
        contact_name: name || null,
        email,
        phone: phone || null,
        city: city || null,
        active: false,
      })
      .select()
      .single();

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          unit_amount: 14900,
          product_data: {
            name: "M² Contractor AI Chatbot — $149/month",
            description: "AI chat widget for your website. Qualifies visitors 24/7 and captures name, phone, and project details automatically.",
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "chatbot_subscription",
        email,
        business_name,
        client_id: client?.id || "",
      },
      success_url: `${origin}/contractor-chatbot?success=1`,
      cancel_url: `${origin}/contractor-chatbot`,
    });

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@m2training.com"],
          subject: `New Chatbot signup — ${business_name}`,
          html: `<p><strong>${business_name}</strong> started checkout for the Contractor AI Chatbot at $149/month.<br>
Contact: ${name || "n/a"} — ${email}${phone ? " — " + phone : ""}${city ? "<br>City: " + city : ""}${business_type ? "<br>Type: " + business_type : ""}</p>`,
        }),
      });
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[CREATE-CHATBOT-CHECKOUT] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

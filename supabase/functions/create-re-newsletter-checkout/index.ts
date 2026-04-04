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
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const {
      agent_name,
      brokerage,
      zip_codes,
      brand_color = "#1a4a7a",
      phone,
      website,
      customer_email,
      customer_name,
    } = await req.json();

    if (!customer_email || !agent_name || !zip_codes) {
      return new Response(JSON.stringify({ error: "customer_email, agent_name, and zip_codes are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawOrigin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const ALLOWED_ORIGINS = ["https://www.mattmichelstraining.com", "https://mattmichelstraining.com", "http://localhost:5173", "http://localhost:3000"];
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 7900,
          recurring: { interval: "month" },
          product_data: {
            name: "AI Real Estate Newsletter",
            description: "Weekly hyper-local market report newsletters sent to your contacts — branded to you.",
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "re_newsletter",
        agent_name,
        brokerage: brokerage || "",
        zip_codes,
        brand_color,
        phone: phone || "",
        website: website || "",
        customer_email,
        customer_name: customer_name || "",
      },
      success_url: `${origin}/real-estate-newsletter/dashboard?success=1`,
      cancel_url: `${origin}/real-estate-newsletter`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `New RE Newsletter checkout — ${agent_name} @ ${brokerage || "unknown brokerage"}`,
          html: `<p>New real estate newsletter signup started checkout:<br>
<strong>${agent_name}</strong> — ${brokerage || "n/a"}<br>
Email: ${customer_email}<br>
Zips: ${zip_codes}<br>
Phone: ${phone || "n/a"} | Site: ${website || "n/a"}<br>
$79/mo</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-RE-NEWSLETTER-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

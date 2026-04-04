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
      customer_email,
      customer_name,
      company_name,
      mark_text,
      goods_services,
      nice_classes,
    } = await req.json();

    if (!customer_email || !mark_text) {
      return new Response(JSON.stringify({ error: "customer_email and mark_text are required" }), {
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
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 4900,
            recurring: { interval: "month" },
            product_data: {
              name: "AI Trademark Watch Service",
              description: `Monitoring: ${mark_text}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "trademark_watch",
        customer_email,
        customer_name: customer_name || "",
        company_name: company_name || "",
        mark_text,
        goods_services: goods_services || "",
        nice_classes: nice_classes || "",
      },
      success_url: `${origin}/trademark-watch?success=1&mark=${encodeURIComponent(mark_text)}`,
      cancel_url: `${origin}/trademark-watch`,
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
          subject: `New Trademark Watch checkout — ${mark_text} (${company_name || customer_email})`,
          html: `<p>Trademark Watch checkout started:<br><strong>${company_name || customer_name || customer_email}</strong><br>${customer_email}<br>Mark: <strong>${mark_text}</strong><br>Classes: ${nice_classes || "n/a"}<br>G&amp;S: ${goods_services || "n/a"}<br>Price: $49/mo</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-TRADEMARK-WATCH-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

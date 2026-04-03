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
      plan_type = "direct",
      company_name,
      monitored_domain,
      customer_email,
      customer_name,
    } = await req.json();

    if (!customer_email || !monitored_domain) {
      return new Response(
        JSON.stringify({ error: "customer_email and monitored_domain are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const isReseller = plan_type === "reseller";

    const unitAmount   = isReseller ? 19900 : 4900;
    const productName  = isReseller
      ? "Dark Web Monitor — MSP Reseller (10 Domains)"
      : "Dark Web Credential Monitor";
    const metaType     = isReseller ? "dark_web_monitor_reseller" : "dark_web_monitor";
    const priceLabel   = isReseller ? "$199/mo" : "$49/mo";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            recurring: { interval: "month" },
            product_data: { name: productName },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: metaType,
        plan_type,
        company_name:      company_name      || "",
        monitored_domain:  monitored_domain  || "",
        customer_email:    customer_email    || "",
        customer_name:     customer_name     || "",
      },
      success_url: `${origin}/dark-web-monitor/dashboard?success=1&domain=${encodeURIComponent(monitored_domain)}`,
      cancel_url:  `${origin}/dark-web-monitor`,
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
          subject: `New Dark Web Monitor checkout — ${company_name || customer_email} (${priceLabel})`,
          html: `<p>Dark Web Monitor checkout started:<br><strong>${company_name || customer_name || customer_email}</strong><br>Email: ${customer_email}<br>Domain: ${monitored_domain}<br>Plan: ${plan_type} (${priceLabel})</p>`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-DARK-WEB-MONITOR-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

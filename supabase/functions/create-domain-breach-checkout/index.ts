import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BASE_URL = "https://www.detroitwebagent.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { customer_email, domain } = await req.json();
    if (!customer_email || !domain) {
      return new Response(JSON.stringify({ error: "customer_email and domain are required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase().trim();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: order } = await sb
      .from("domain_breach_orders")
      .insert({ customer_email, domain: cleanDomain })
      .select("id")
      .single();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 1900,
          product_data: {
            name: "Business Domain Breach Report",
            description: `Dark web breach scan for ${cleanDomain}. Every data breach your company domain has appeared in, with AI remediation steps. Delivered instantly.`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "domain_breach_report",
        customer_email,
        domain: cleanDomain,
        order_id: order?.id || "",
      },
      success_url: `${BASE_URL}/lab/domain-breach?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/lab/domain-breach`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-domain-breach-checkout]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

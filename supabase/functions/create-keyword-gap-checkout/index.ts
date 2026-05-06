import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" } as any);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BASE_URL = "https://www.detroitwebagent.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function cleanDomain(d: string): string {
  return d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase().trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const { customer_email, your_domain, competitor_domain } = await req.json();
    if (!customer_email || !your_domain || !competitor_domain) {
      return new Response(JSON.stringify({ error: "customer_email, your_domain, and competitor_domain are required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (!EMAIL_RE.test(customer_email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const yourClean = cleanDomain(your_domain);
    const competitorClean = cleanDomain(competitor_domain);
    if (!DOMAIN_RE.test(yourClean) || !DOMAIN_RE.test(competitorClean)) {
      return new Response(JSON.stringify({ error: "Invalid domain format" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (yourClean === competitorClean) {
      return new Response(JSON.stringify({ error: "Your domain and competitor domain must be different" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Create Stripe session FIRST so we have session.id for the DB row
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 1900,
          product_data: {
            name: "Local Keyword Gap Report",
            description: `SEO keyword gap: ${yourClean} vs ${competitorClean}. Keywords your competitor ranks for that you don't — sorted by opportunity. Delivered instantly.`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "keyword_gap_report",
        customer_email,
        your_domain: yourClean,
        competitor_domain: competitorClean,
      },
      success_url: `${BASE_URL}/lab/keyword-gap?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/lab/keyword-gap`,
    });

    // Insert order with stripe_session_id — used by webhook + deliver function for idempotency
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("keyword_gap_orders").insert({
      customer_email,
      your_domain: yourClean,
      competitor_domain: competitorClean,
      stripe_session_id: session.id,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-keyword-gap-checkout]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BASE_URL = "https://www.mattmichelstraining.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCTS = {
  website_audit: {
    name: "AI Website Audit Report",
    description: "Instant AI-generated audit of your website: SEO, mobile, trust signals, local ranking, and actionable recommendations. Delivered to your inbox within 60 seconds.",
    amount: 2900,
    success_path: "/ai-website-audit?success=1",
    cancel_path: "/ai-website-audit",
  },
  gbp_post_pack: {
    name: "AI Google Business Profile Post Pack (30 Posts)",
    description: "30 ready-to-schedule GBP posts generated specifically for your business. 3 months of content, delivered instantly.",
    amount: 1900,
    success_path: "/ai-gbp-post-pack?success=1",
    cancel_path: "/ai-gbp-post-pack",
  },
  competitor_report: {
    name: "AI Local Competitor Analysis Report",
    description: "AI-generated competitive landscape for your local market: nearby competitors, review gaps, positioning opportunities. Delivered to your inbox.",
    amount: 4900,
    success_path: "/ai-competitor-report?success=1",
    cancel_path: "/ai-competitor-report",
  },
} as const;

type ProductKey = keyof typeof PRODUCTS;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { product_type, email, business_name, business_url, city, industry, business_info } = body;

    if (!product_type || !email) {
      return new Response(JSON.stringify({ error: "product_type and email are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const product = PRODUCTS[product_type as ProductKey];
    if (!product) {
      return new Response(JSON.stringify({ error: "Invalid product type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Pre-insert a pending order so we have context when the webhook fires
    if (product_type === "website_audit") {
      await sb.from("audit_orders").insert({
        email,
        business_name: business_name || null,
        business_url: business_url || null,
        status: "pending",
      }).select().single().then(({ data }) => {
        // Store order id in metadata below
        (body as any).__order_id = data?.id;
      }).catch(() => {});
    } else if (product_type === "gbp_post_pack") {
      await sb.from("gbp_post_packs").insert({
        email,
        business_name: business_name || null,
        business_info: JSON.stringify({ city, industry, business_info }),
        status: "pending",
      }).select().single().then(({ data }) => {
        (body as any).__order_id = data?.id;
      }).catch(() => {});
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: product.amount,
          product_data: {
            name: product.name,
            description: product.description,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: product_type,
        email,
        business_name: business_name || "",
        business_url: business_url || "",
        city: city || "",
        industry: industry || "",
        business_info: business_info || "",
        order_id: (body as any).__order_id || "",
      },
      success_url: `${BASE_URL}${product.success_path}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}${product.cancel_path}`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-report-checkout]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

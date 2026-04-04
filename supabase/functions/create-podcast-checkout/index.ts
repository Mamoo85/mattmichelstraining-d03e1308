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
      podcast_name,
      rss_feed_url,
      podcast_niche,
      target_audience,
      tone = "professional",
    } = await req.json();

    if (!customer_email || !rss_feed_url) {
      return new Response(
        JSON.stringify({ error: "customer_email and rss_feed_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawOrigin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const ALLOWED_ORIGINS = ["https://www.mattmichelstraining.com", "https://mattmichelstraining.com", "http://localhost:5173", "http://localhost:3000"];
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.mattmichelstraining.com";
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Create Stripe product + price inline (no hardcoded price ID)
    const product = await stripe.products.create({
      name: "Podcast-to-Revenue Machine",
      description: "Automatic blog post, LinkedIn post, email newsletter, YouTube description, and Twitter thread for every new podcast episode.",
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 19900,
      currency: "usd",
      recurring: { interval: "month" },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        type: "podcast_revenue_machine",
        podcast_name: podcast_name || "",
        rss_feed_url,
        podcast_niche: podcast_niche || "",
        target_audience: target_audience || "",
        tone,
        customer_email,
        customer_name: customer_name || "",
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          type: "podcast_revenue_machine",
          podcast_name: podcast_name || "",
          rss_feed_url,
          podcast_niche: podcast_niche || "",
          target_audience: target_audience || "",
          tone,
          customer_email,
          customer_name: customer_name || "",
        },
      },
      success_url: `${origin}/podcast-revenue-machine/dashboard?success=1`,
      cancel_url: `${origin}/podcast-revenue-machine`,
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
          subject: `🎙️ New Podcast Revenue Machine checkout — ${podcast_name || customer_email}`,
          html: `<p>New checkout started:<br><strong>${customer_name || "Unknown"}</strong><br>${customer_email}<br>Podcast: ${podcast_name || "n/a"}<br>RSS: ${rss_feed_url}<br>Niche: ${podcast_niche || "n/a"}<br>Tone: ${tone}<br>$199/mo<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/><span style="color:#94a3b8;font-size:13px;">Grosse Pointe, MI · (313) 806-4952</span></div></p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-PODCAST-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

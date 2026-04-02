import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const {
      camp_name, sport, age_range, start_date, end_date,
      location, price_description, website_url, contact_email,
    } = await req.json();

    if (!camp_name || !contact_email) {
      return new Response(JSON.stringify({ error: "camp_name and contact_email are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: contact_email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Camp Directory Listing — ${camp_name}`,
              description: `Monthly listing in the M² Youth Sports Camp Directory for ${camp_name}`,
            },
            unit_amount: 4900,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "camp_listing",
        camp_name,
        sport: sport || "",
        age_range: age_range || "",
        start_date: start_date || "",
        end_date: end_date || "",
        location: location || "",
        price_description: price_description || "",
        website_url: website_url || "",
        contact_email,
        customer_email: contact_email,
      },
      success_url: `${siteUrl}/sports-camps?status=success`,
      cancel_url: `${siteUrl}/sports-camps`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CREATE-CAMP-LISTING-CHECKOUT] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

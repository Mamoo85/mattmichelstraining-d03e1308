import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      business_name,
      contact_name,
      phone,
      target_trades,
      target_counties,
      min_permit_count,
    } = await req.json();

    if (!email || !business_name) {
      return new Response(
        JSON.stringify({ error: "email and business_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 19900, // $199/mo
            recurring: { interval: "month" },
            product_data: {
              name: "High-Volume Buyer Permit Package",
              description:
                "Weekly digest of Metro Detroit contractors pulling 5+ active permits in your trade verticals — verified active accounts with estimated material spend, contact emails, and project addresses.",
            },
          },
        },
      ],
      metadata: {
        type: "high_volume_buyer_subscription",
        email,
        business_name,
        contact_name: contact_name || "",
        phone: phone || "",
        target_trades: Array.isArray(target_trades) && target_trades.length
          ? target_trades.join(",")
          : "hvac,plumbing,electrical",
        target_counties: Array.isArray(target_counties) && target_counties.length
          ? target_counties.join(",")
          : "Wayne,Oakland,Macomb",
        min_permit_count: String(min_permit_count || 5),
      },
      success_url: `${origin}/high-volume-buyer-alerts?success=1`,
      cancel_url: `${origin}/high-volume-buyer-alerts`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[create-high-volume-buyer-checkout]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

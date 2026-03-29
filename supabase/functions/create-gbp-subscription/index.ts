import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (msg: string, data?: any) =>
  console.log(`[CREATE-GBP-SUBSCRIPTION] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { business_name, contact_name, phone, email, current_gbp_url } = await req.json();

    if (!business_name || !email) {
      return new Response(
        JSON.stringify({ error: "business_name and email are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://mattmichelstraining.com";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Google Business Profile Management",
              description: `Monthly GBP management for ${business_name}`,
            },
            unit_amount: 4900,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "gbp_subscription",
        business_name,
        contact_name: contact_name || "",
        phone: phone || "",
        current_gbp_url: current_gbp_url || "",
        customer_email: email,
      },
      success_url: `${siteUrl}/gbp-management?status=success`,
      cancel_url: `${siteUrl}/gbp-management`,
    });

    log("Subscription session created", { session_id: session.id, business_name });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", { error: String(err) });
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

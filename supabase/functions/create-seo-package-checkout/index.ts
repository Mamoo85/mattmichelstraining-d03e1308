import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (msg: string, data?: any) =>
  console.log(`[CREATE-SEO-PACKAGE-CHECKOUT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { business_name, city, industry, email, customer_email } = await req.json();

    if (!business_name || !city || !industry || !email) {
      return new Response(
        JSON.stringify({ error: "business_name, city, industry, and email are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedEmail: string = customer_email || email;
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://mattmichelstraining.com";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: resolvedEmail,
      line_items: [
        {
          price: "price_1THQrCD52tPWee46S22fwipp",
          quantity: 1,
        },
      ],
      metadata: {
        type: "seo_package",
        business_name,
        city,
        industry,
        customer_email: resolvedEmail,
      },
      success_url: `${siteUrl}/seo-package?status=success`,
      cancel_url: `${siteUrl}/seo-package`,
    });

    log("Checkout session created", { session_id: session.id, business_name });

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

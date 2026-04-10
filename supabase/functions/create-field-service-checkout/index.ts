import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, company, plan, industry } = await req.json() as {
      email: string;
      name?: string;
      company?: string;
      plan: "standalone" | "bundle";
      industry?: string;
    };

    const origin = req.headers.get("origin") ?? "https://mattmichelstraining.com";

    const isBundle = plan === "bundle";
    const unitAmount = isBundle ? 19900 : 29900;
    const productName = isBundle
      ? "Detroit Web Agency — Field Service Platform (Website Bundle)"
      : "Detroit Web Agency — Field Service Platform (Standalone)";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Insert pending client row
    await sb.from("field_service_clients").insert({
      company_name: company || "New Client",
      owner_name: name ?? null,
      owner_email: email,
      plan: plan ?? "standalone",
      industry: industry || "field_service",
      active: false,
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            recurring: { interval: "month" },
            product_data: { name: productName },
          },
        },
      ],
      metadata: {
        type: "field_service_subscription",
        email,
        name: name ?? "",
        company: company ?? "",
        plan: plan ?? "standalone",
      },
      success_url: `${origin}/field-service?success=1`,
      cancel_url: `${origin}/field-service`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-field-service-checkout error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

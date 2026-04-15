import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { email, company_name, phone, plan, target_roles, ref, county } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // $49/mo for Field CRM bundle clients, $99/mo standalone
    const resolvedPlan = plan === "bundle" ? "bundle" : "standalone";
    const unitAmount = resolvedPlan === "bundle" ? 4900 : 9900;
    const planLabel = resolvedPlan === "bundle" ? "TechAlert + Field CRM Bundle" : "TechAlert Hiring Monitor";

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
            unit_amount: unitAmount,
            recurring: { interval: "month" },
            product_data: {
              name: planLabel,
              description:
                "Daily alerts when licensed tradespeople become available in Metro Detroit. Scans MIOSHA license DB, Apollo, and job boards.",
            },
          },
        },
      ],
      metadata: {
        type: "hire_alert_subscription",
        plan: resolvedPlan,
        email,
        company_name: company_name || "",
        owner_phone: phone || "",
        target_roles: Array.isArray(target_roles) && target_roles.length
          ? target_roles.join(",")
          : "boiler_operator,hvac_tech",
        ref: ref || "direct",
        county: county || "",
      },
      success_url: `${origin}/hire-alert?success=1`,
      cancel_url: `${origin}/hire-alert`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-hire-alert-checkout] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

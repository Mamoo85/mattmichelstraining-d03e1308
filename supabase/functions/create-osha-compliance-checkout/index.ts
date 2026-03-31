import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { businessName, email, industry, employeeCount } = await req.json();
    if (!email || !businessName) throw new Error("Missing required fields");
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, product_data: { name: "AI OSHA/Safety Compliance Checker" }, unit_amount: 9900 }, quantity: 1 }],
      subscription_data: { trial_period_days: 7, metadata: { type: "osha_compliance_subscription", businessName, email, industry: industry || "", employeeCount: String(employeeCount || "") } },
      metadata: { type: "osha_compliance_subscription", businessName, email, industry: industry || "", employeeCount: String(employeeCount || "") },
      success_url: `${req.headers.get("origin") || "https://mattmichelstraining.lovable.app"}/ai-osha-compliance?success=true`,
      cancel_url: `${req.headers.get("origin") || "https://mattmichelstraining.lovable.app"}/ai-osha-compliance`,
    });
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLANS: Record<string, { label: string; amount: number; mode: "payment" | "subscription"; interval?: "month" }> = {
  sheet:   { label: "Talent Radar — 10-Name Intelligence Sheet",   amount: 25000,  mode: "payment" },
  starter: { label: "Talent Radar Starter — 1 Vertical, Daily Sheets", amount: 49900, mode: "subscription", interval: "month" },
  pro:     { label: "Talent Radar Pro — 3 Verticals, Unlimited Sheets", amount: 79900, mode: "subscription", interval: "month" },
  agency:  { label: "Talent Radar Agency — All Verticals, Multi-State", amount: 149900, mode: "subscription", interval: "month" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const { email, company_name, phone, plan = "sheet", target_verticals, ref } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const planConfig = PLANS[plan] || PLANS.sheet;
    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";
    const verticalsStr = Array.isArray(target_verticals) && target_verticals.length
      ? target_verticals.join(",")
      : "trades";

    const metadata = {
      type: plan === "sheet" ? "talent_radar_sheet" : "talent_radar_subscription",
      email,
      company_name: company_name || "",
      owner_phone: phone || "",
      plan,
      target_verticals: verticalsStr,
      ref: ref || "direct",
    };

    const lineItem = {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: planConfig.amount,
        product_data: {
          name: planConfig.label,
          description: plan === "sheet"
            ? "10 new-licensee contacts with name, license #, city, phone, email, and enrichment data. Delivered instantly."
            : "Daily sheets of freshly licensed candidates in your selected vertical(s). Cancel anytime.",
        },
        ...(planConfig.mode === "subscription" ? { recurring: { interval: "month" } } : {}),
      },
    };

    const session = await stripe.checkout.sessions.create({
      mode: planConfig.mode,
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [lineItem],
      metadata,
      success_url: `${origin}/my-talent-radar?success=1`,
      cancel_url: `${origin}/talent-radar`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-talent-radar-checkout]", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

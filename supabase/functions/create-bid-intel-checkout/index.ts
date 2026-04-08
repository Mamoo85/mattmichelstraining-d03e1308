import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { company_name, trade, service_territory, max_bid_radius_miles, phone, customer_name, customer_email } = await req.json();

    if (!customer_email || !company_name || !trade) {
      return new Response(JSON.stringify({ error: "customer_email, company_name, and trade are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawOrigin = req.headers.get("origin") || "https://www.detroitwebagent.com";
    const ALLOWED_ORIGINS = ["https://www.mattmichelstraining.com", "https://mattmichelstraining.com", "http://localhost:5173", "http://localhost:3000", "https://www.detroitwebagent.com", "https://detroitwebagent.com"];
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 59900,
          recurring: { interval: "month" },
          product_data: {
            name: "Bid Intelligence & Proposal Factory",
            description: "Daily bid board scanning, AI-scored opportunity matching, auto-generated first-draft proposals, and deadline alerts for commercial subcontractors.",
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "bid_intel_monitor",
        company_name: company_name || "",
        trade: trade || "",
        service_territory: service_territory || "",
        max_bid_radius_miles: max_bid_radius_miles ? String(max_bid_radius_miles) : "50",
        phone: phone || "",
        customer_email,
        customer_name: customer_name || "",
      },
      success_url: `${origin}/bid-intelligence?success=1`,
      cancel_url: `${origin}/bid-intelligence`,
    });

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `New Bid Intelligence checkout — ${company_name}`,
          html: `<p>New bid intelligence checkout started:<br><strong>${company_name}</strong><br>${customer_email}<br>Trade: ${trade || "n/a"}<br>Territory: ${service_territory || "n/a"}</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-BID-INTEL-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

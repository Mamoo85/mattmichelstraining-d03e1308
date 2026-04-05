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
    const { company_name, naics_codes, state, additional_states, phone, customer_name, customer_email } = await req.json();

    if (!customer_email || !company_name) {
      return new Response(JSON.stringify({ error: "customer_email and company_name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawOrigin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const ALLOWED_ORIGINS = ["https://www.mattmichelstraining.com", "https://mattmichelstraining.com", "http://localhost:5173", "http://localhost:3000"];
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 49700,
          recurring: { interval: "month" },
          product_data: {
            name: "Regulatory Filing Monitor",
            description: "Daily Federal Register + state EPA monitoring, AI-generated draft compliance filings, deadline management, and SMS alerts for your NAICS codes.",
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "reg_filing_monitor",
        company_name: company_name || "",
        naics_codes: naics_codes || "",
        state: state || "",
        additional_states: additional_states || "",
        phone: phone || "",
        customer_email,
        customer_name: customer_name || "",
      },
      success_url: `${origin}/regulatory-filing-monitor?success=1`,
      cancel_url: `${origin}/regulatory-filing-monitor`,
    });

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `New Reg Filing Monitor checkout — ${company_name}`,
          html: `<p>New regulatory filing monitor checkout started:<br><strong>${company_name}</strong><br>${customer_email}<br>NAICS: ${naics_codes || "n/a"}<br>State: ${state || "n/a"}</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-REG-FILING-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

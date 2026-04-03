import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const {
      company_name,
      naics_codes,
      keywords,
      set_aside_types,
      min_contract_value,
      max_contract_value,
      preferred_states,
      customer_name,
      customer_email,
    } = await req.json();

    if (!customer_email || !company_name) {
      return new Response(JSON.stringify({ error: "customer_email and company_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 29900,
            recurring: { interval: "month" },
            product_data: {
              name: "Government Contract Opportunity Monitor",
              description: "Daily SAM.gov scanning, AI-scored opportunities, bid recommendations, and deadline alerts for federal contracts matching your NAICS codes and keywords.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "gov_contract_monitor",
        company_name: company_name || "",
        naics_codes: naics_codes || "",
        keywords: keywords || "",
        set_aside_types: set_aside_types || "",
        customer_email,
        customer_name: customer_name || "",
        min_contract_value: min_contract_value ? String(min_contract_value) : "",
        max_contract_value: max_contract_value ? String(max_contract_value) : "",
        preferred_states: preferred_states || "",
      },
      success_url: `${origin}/gov-contract-monitor?success=1`,
      cancel_url: `${origin}/gov-contract-monitor`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `New Gov Contract Monitor checkout — ${company_name}`,
          html: `<p>New government contract monitor checkout started:<br><strong>${company_name}</strong><br>${customer_email}<br>NAICS: ${naics_codes || "n/a"}<br>Keywords: ${keywords || "n/a"}<br>Set-Asides: ${set_aside_types || "n/a"}</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-GOV-CONTRACT-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

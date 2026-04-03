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
    const { customer_email, customer_name, company_name, industry, sub_industries, state_focus } = await req.json();

    if (!customer_email || !industry) {
      return new Response(JSON.stringify({ error: "customer_email and industry are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "AI Regulatory Change Monitor",
            description: "Weekly AI-powered regulatory digest for your industry",
          },
          unit_amount: 19700,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      metadata: {
        type: "regulatory_monitor",
        customer_email,
        customer_name: customer_name || "",
        company_name: company_name || "",
        industry,
        sub_industries: sub_industries || "",
        state_focus: state_focus || "",
      },
      success_url: `${origin}/regulatory-monitor?success=1`,
      cancel_url: `${origin}/regulatory-monitor`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      const industryLabel = industry.charAt(0).toUpperCase() + industry.slice(1).replace(/_/g, "/");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
          subject: `New Regulatory Monitor checkout — ${company_name || customer_email} (${industryLabel})`,
          html: `<p>Regulatory Monitor checkout started:<br><strong>${company_name || customer_name || customer_email}</strong><br>${customer_email}<br>Industry: ${industryLabel}<br>State Focus: ${state_focus || "National"}<br>$197/mo<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-REGULATORY-MONITOR-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Service catalog — each service maps to its pricing and metadata type
const SERVICE_CATALOG: Record<string, { label: string; price: number; metaType: string; description: string }> = {
  dental: { label: "Dental & Orthodontic Practices", price: 9900, metaType: "b2b_database_subscription", description: "Searchable database of verified dental offices. Updated daily." },
  hvac: { label: "HVAC & Mechanical Contractors", price: 9900, metaType: "b2b_database_subscription", description: "Searchable database of verified HVAC contractors. Updated daily." },
  pt: { label: "Physical Therapy & Chiro Offices", price: 9900, metaType: "b2b_database_subscription", description: "Searchable database of verified PT/chiro offices. Updated daily." },
  auto: { label: "Independent Auto Repair Shops", price: 9900, metaType: "b2b_database_subscription", description: "Searchable database of verified auto repair shops. Updated daily." },
  industrial: { label: "Industrial Suppliers & Manufacturers", price: 4900, metaType: "b2b_database_subscription", description: "Searchable database of verified industrial contacts. Updated weekly." },
  contractor_leads: { label: "Exclusive Contractor Leads — Founding Rate", price: 24900, metaType: "contractor_lead_subscription", description: "Exclusive leads for your trade in your city. One contractor per territory." },
  gbp_basic: { label: "GBP Management — Basic (Founding Rate)", price: 2900, metaType: "gbp_saas_subscription", description: "AI posts to your Google Business Profile 3x/week." },
  gbp_pro: { label: "GBP Management — Pro (Founding Rate)", price: 4900, metaType: "gbp_saas_subscription", description: "AI posts 3x/week + review solicitation + photo optimization." },
  social_standard: { label: "Social Media AI — Standard (Founding Rate)", price: 9900, metaType: "social_media_subscription", description: "AI-generated posts 3x/week to Facebook, Instagram, LinkedIn." },
  social_pro: { label: "Social Media AI — Pro (Founding Rate)", price: 14900, metaType: "social_media_subscription", description: "AI posts 5x/week + stories + engagement. Full social management." },
  web_design: { label: "Web Design & Development", price: 49900, metaType: "web_design_subscription", description: "Professional website design with monthly retainer." },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json();
    const { email, name, business_name, phone, service, city, state, trade, website, niche, referral_code } = body;

    if (!email) return new Response(JSON.stringify({ error: "email is required" }), { status: 400, headers: corsHeaders });

    // Resolve service key — support legacy `niche` field for backward compat
    const serviceKey = service || niche || "dental";
    const svc = SERVICE_CATALOG[serviceKey];
    if (!svc) return new Response(JSON.stringify({ error: `Unknown service: ${serviceKey}` }), { status: 400, headers: corsHeaders });

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: "price_1THQr5D52tPWee46A8MFdnB0", quantity: 1 }],
      metadata: {
        type: svc.metaType,
        niche: niche || serviceKey,
        customer_name: name || "",
        business_name: business_name || "",
        email,
        phone: phone || "",
        city: city || "",
        state: state || "MI",
        trade: trade || "",
        website: website || "",
        industry: niche || serviceKey,
        referral_code: referral_code || "",
      },
      success_url: `${origin}/get-started?success=1&service=${serviceKey}`,
      cancel_url: `${origin}/get-started`,
    });

    // Notify Matt
    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"], bcc: ["matthewmichels4@gmail.com"],
          subject: `🔔 Checkout started — ${svc.label} — ${business_name || email}`,
          html: `<p><strong>${business_name || name || email}</strong> started checkout for <strong>${svc.label}</strong> ($${(svc.price / 100).toFixed(0)}/mo).</p><p>Email: ${email}<br>Phone: ${phone || "n/a"}<br>City: ${city || "n/a"}</p>`,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: corsHeaders });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-B2B-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});

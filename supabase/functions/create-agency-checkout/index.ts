import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Creates Stripe customer + Checkout for agency onboarding.
 * Two paths:
 *  - "performance": setup mode (saves card, no upfront charge — billed per interview)
 *  - "annual_prepay": payment mode for $25K territory lock (full year prepay)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { agency_name, contact_name, contact_email, contact_phone, vertical, territory_counties, pricing_model } = await req.json();
    if (!agency_name || !contact_email || !vertical) throw new Error("agency_name, contact_email, vertical required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: contact_email,
      name: agency_name,
      phone: contact_phone || undefined,
      metadata: { type: "staffing_agency", vertical },
    });

    // Insert agency record
    const { data: agency, error: agencyErr } = await supabase
      .from("staffing_agency_clients")
      .insert({
        agency_name,
        contact_name: contact_name || null,
        contact_email,
        contact_phone: contact_phone || null,
        vertical,
        territory_counties: territory_counties || [],
        pricing_model: pricing_model || "performance",
        stripe_customer_id: customer.id,
        active: true,
      })
      .select()
      .single();
    if (agencyErr) throw agencyErr;

    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";
    let session: Stripe.Checkout.Session;

    if (pricing_model === "annual_prepay") {
      session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: "Territory Lock — Annual Prepay", description: "12-month exclusive feed for your vertical + counties. Includes ATS sync." },
            unit_amount: 2500000,
          },
          quantity: 1,
        }],
        success_url: `${origin}/agency-portal?id=${agency.id}&welcome=1`,
        cancel_url: `${origin}/talent-intelligence?canceled=1`,
        metadata: { type: "agency_annual_prepay", agency_id: agency.id },
      });
    } else {
      // Setup mode — save card, no upfront charge
      session = await stripe.checkout.sessions.create({
        customer: customer.id,
        mode: "setup",
        payment_method_types: ["card"],
        success_url: `${origin}/agency-portal?id=${agency.id}&welcome=1`,
        cancel_url: `${origin}/talent-intelligence?canceled=1`,
        metadata: { type: "agency_performance_setup", agency_id: agency.id },
      });
    }

    return new Response(JSON.stringify({ url: session.url, agency_id: agency.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

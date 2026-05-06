// create-hirealert-ondemand — One-time Stripe payment for instant name packs
// $50 for 10 names, $25 for 5 names
// Refund policy: $5 back per name we can't deliver
//
// Flow:
//   1. Client pays via Stripe checkout (mode: "payment", not subscription)
//   2. Webhook fires → deliver-ondemand-names pulls candidates and emails them
//   3. Client gets email with name pack within 5 minutes
//
// Supports both trades and healthcare license types

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const PACKS: Record<string, { names: number; cents: number; label: string }> = {
  "10-pack": { names: 10, cents: 5000, label: "10 Licensed Names — Instant Pack" },
  "5-pack":  { names: 5,  cents: 2500, label: "5 Licensed Names — Starter Pack" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email,
      company_name,
      phone,
      pack = "10-pack",
      license_types = [],
      county,
      source,
      ref,
    } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedPack = PACKS[pack] || PACKS["10-pack"];

    // Verify we have enough candidates to fulfill
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const query = sb
      .from("hire_alert_candidates")
      .select("id", { count: "exact", head: true })
      .gte("availability_score", 3);

    if (county) {
      query.ilike("location", `%${county}%`);
    }

    const { count: availableCandidates } = await query;

    // We'll fulfill what we can and refund the rest
    const canDeliver = Math.min(availableCandidates ?? 0, selectedPack.names);
    const shortfall = selectedPack.names - canDeliver;

    const origin = req.headers.get("origin") || "https://www.detroitwebagent.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: selectedPack.cents,
            product_data: {
              name: selectedPack.label,
              description: `${selectedPack.names} licensed professionals${county ? ` in ${county} County` : " in Metro Detroit"}. Delivered to your email within 5 minutes. $5 refund per name we can't deliver.`,
            },
          },
        },
      ],
      metadata: {
        type: "hirealert_ondemand",
        pack,
        names_requested: String(selectedPack.names),
        email,
        company_name: company_name || "",
        phone: phone || "",
        license_types: JSON.stringify(license_types),
        county: county || "",
        source: source || "",
        ref: ref || "",
        estimated_deliverable: String(canDeliver),
      },
      success_url: `${origin}/go/techalert?success=1&pack=${pack}`,
      cancel_url: `${origin}/go/techalert`,
    });

    return new Response(
      JSON.stringify({
        url: session.url,
        available: canDeliver,
        shortfall,
        refund_estimate: shortfall * 500, // $5 per undeliverable name in cents
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-hirealert-ondemand] Error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

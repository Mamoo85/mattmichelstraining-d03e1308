// create-customer-portal-session — returns a Stripe billing portal URL for self-serve management.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCT_TABLES = [
  { table: "hire_alert_clients", emailCol: "owner_email", customerCol: "stripe_customer_id" },
  { table: "field_crm_clients", emailCol: "email", customerCol: "stripe_customer_id" },
  { table: "missed_call_clients", emailCol: "email", customerCol: "stripe_customer_id" },
  { table: "mortgage_radar_clients", emailCol: "email", customerCol: "stripe_customer_id" },
  { table: "contractor_clients", emailCol: "email", customerCol: "stripe_customer_id" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { email } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let stripeCustomerId: string | null = null;

    for (const p of PRODUCT_TABLES) {
      const { data } = await sb.from(p.table).select(p.customerCol).eq(p.emailCol, email).maybeSingle();
      const id = (data as Record<string, string> | null)?.[p.customerCol];
      if (id) { stripeCustomerId = id; break; }
    }

    if (!stripeCustomerId) {
      // Look up by email directly in Stripe as fallback
      const customers = await stripe.customers.list({ email, limit: 1 });
      stripeCustomerId = customers.data[0]?.id || null;
    }

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ error: "No billing account found for this email" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: origin,
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

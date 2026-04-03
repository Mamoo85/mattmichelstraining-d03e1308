import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { email, name, phone } = body;
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("grant_discovery_clients").upsert(
      { email, contact_name: name || null, phone: phone || null, org_name: body.orgName || null, mission: body.mission || null, geography: body.geography || null, cause_areas: body.causeAreas || null, active: false },
      { onConflict: "email" }
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      subscription_data: { trial_period_days: 14 },
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 19900, product_data: { name: "Weekly Grant Discovery for Nonprofits", description: "Every Monday: ranked list of grant opportunities matched to your mission, with fit scores and deadlines." } }, quantity: 1 }],
      metadata: { type: "grant_discovery_subscription", email, name: name || "", phone: phone || "", ...Object.fromEntries(Object.entries(body).filter(([k]) => !["email","name","phone"].includes(k)).map(([k,v]) => [k, String(v)])) },
      success_url: "https://www.mattmichelstraining.com/grant-discovery?status=success",
      cancel_url: "https://www.mattmichelstraining.com/grant-discovery",
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

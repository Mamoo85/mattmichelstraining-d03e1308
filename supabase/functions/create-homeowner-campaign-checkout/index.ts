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
    const { email, name, businessName, phone, businessType, targetZip, offerHeadline } = await req.json();
    if (!email || !businessName || !targetZip) return new Response(JSON.stringify({ error: "email, businessName, and targetZip required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("homeowner_campaign_clients").upsert({ email, business_name: businessName, contact_name: name || null, phone: phone || null, business_type: businessType || null, target_zip: targetZip, offer_headline: offerHeadline || null, active: false }, { onConflict: "email" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      subscription_data: { trial_period_days: 14 },
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 5900, product_data: { name: "New Homeowner Campaign", description: "Automatically reaches new movers in your target ZIP with a personalized welcome offer — before your competitors do." } }, quantity: 1 }],
      metadata: { type: "homeowner_campaign_subscription", email, name: name || "", businessName, phone: phone || "", businessType: businessType || "", targetZip, offerHeadline: offerHeadline || "" },
      success_url: "https://www.mattmichelstraining.com/new-homeowner-campaign?status=success",
      cancel_url: "https://www.mattmichelstraining.com/new-homeowner-campaign",
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

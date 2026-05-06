import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { email, name, phone, child_name, child_age, story_themes } = body;
    if (!email) return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await sb.from("story_subscription_clients").upsert(
      { email, parent_name: name || null, phone: phone || null, child_name: child_name || null, child_age: child_age || null, story_themes: story_themes || null, active: false },
      { onConflict: "email" }
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price_data: { currency: "usd", recurring: { interval: "month" }, unit_amount: 999, product_data: { name: "Children's Story Subscription", description: "4 original bedtime stories per month, personalized with your child's name and favorite themes. New story every week, delivered by email." } }, quantity: 1 }],
      metadata: { type: "childrens_story_subscription", email, name: name || "", phone: phone || "", child_name: child_name || "" },
      success_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/childrens-stories?status=success`,
      cancel_url: `${req.headers.get("origin") || "https://www.detroitwebagent.com"}/childrens-stories`,
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

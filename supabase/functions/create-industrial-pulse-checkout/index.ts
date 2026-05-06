// Channel 3 unlock checkout — $50 one-time snapshot OR $199/mo firehose
// Public endpoint. Creates Stripe Checkout Session, records pending row in industrial_pulse_unlocks.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Plan = "snapshot_50" | "firehose_199";

const PLANS: Record<Plan, { mode: "payment" | "subscription"; amount: number; recurring: boolean; name: string; description: string }> = {
  snapshot_50: {
    mode: "payment",
    amount: 5000,
    recurring: false,
    name: "Detroit Industrial Pulse — This Week's Unlock",
    description: "Unlock all of this week's Metro Detroit hiring signals: full company name, address, hiring count, predicted spend window. One-time, this week only.",
  },
  firehose_199: {
    mode: "subscription",
    amount: 19900,
    recurring: true,
    name: "Detroit Industrial Pulse — Firehose",
    description: "Daily access to every Metro Detroit hiring signal across every vertical. Cancel anytime.",
  },
};

const ALLOWED_ORIGINS = [
  "https://www.detroitwebagent.com",
  "https://detroitwebagent.com",
  "https://m2training.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, plan, business_name } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedPlan: Plan = (plan && plan in PLANS) ? plan as Plan : "snapshot_50";
    const p = PLANS[selectedPlan];

    const rawOrigin = req.headers.get("origin") || "";
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.detroitwebagent.com";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Pre-insert pending row so we can correlate the webhook later
    const { data: pending, error: insErr } = await sb.from("industrial_pulse_unlocks").insert({
      email: email.trim().toLowerCase(),
      plan: selectedPlan,
      amount_cents: p.amount,
      status: "pending",
      week_start: new Date().toISOString().slice(0, 10),
      metadata: { business_name: business_name || null, source: "industrial-pulse-page" },
    }).select("id").maybeSingle();

    if (insErr) console.error("[ipu pre-insert]", insErr.message);

    const session = await stripe.checkout.sessions.create({
      mode: p.mode,
      payment_method_types: ["card"],
      customer_email: email.trim().toLowerCase(),
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: p.amount,
          ...(p.recurring ? { recurring: { interval: "month" } } : {}),
          product_data: {
            name: p.name,
            description: p.description,
          },
        },
      }],
      metadata: {
        type: p.recurring ? "industrial_pulse_firehose" : "industrial_pulse_snapshot",
        plan: selectedPlan,
        email: email.trim().toLowerCase(),
        business_name: business_name || "",
        unlock_id: pending?.id || "",
      },
      success_url: `${origin}/industrial-pulse?unlocked=1&plan=${selectedPlan}&email=${encodeURIComponent(email.trim().toLowerCase())}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/industrial-pulse`,
    });

    // Save session id to pending row
    if (pending?.id) {
      await sb.from("industrial_pulse_unlocks").update({ stripe_session_id: session.id }).eq("id", pending.id);
    }

    return new Response(JSON.stringify({ url: session.url, plan: selectedPlan }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[create-industrial-pulse-checkout]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

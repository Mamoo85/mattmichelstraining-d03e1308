// Verify a Stripe Checkout Session for Industrial Pulse and return real plan details.
// Public endpoint. Called by the receipt page using ?session_id=cs_...

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLAN_LABELS: Record<string, { label: string; cadence: string; description: string }> = {
  snapshot_50: {
    label: "This Week's Snapshot",
    cadence: "One-time · 7-day access",
    description: "Full access to every Metro Detroit hiring signal we surfaced this week — company name, address, hiring count, and predicted spend window.",
  },
  firehose_199: {
    label: "Firehose",
    cadence: "$199/month · cancel anytime",
    description: "Daily access to every Metro Detroit hiring signal across every vertical, plus full pitch packets and CSV exports.",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id || typeof session_id !== "string" || !session_id.startsWith("cs_")) {
      return new Response(JSON.stringify({ error: "Valid session_id required", verified: false }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull the session from Stripe (source of truth)
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["line_items", "line_items.data.price.product", "subscription"],
    });

    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    const plan = (session.metadata?.plan || "") as string;
    const planMeta = PLAN_LABELS[plan] || { label: "Industrial Pulse", cadence: "", description: "" };

    const lineItem = session.line_items?.data?.[0];
    const product = (lineItem?.price?.product && typeof lineItem.price.product !== "string")
      ? lineItem.price.product
      : null;

    const amountTotal = session.amount_total ?? lineItem?.amount_total ?? 0;
    const currency = (session.currency || lineItem?.currency || "usd").toUpperCase();
    const interval = lineItem?.price?.recurring?.interval || null;
    const customerEmail = session.customer_details?.email || session.customer_email || session.metadata?.email || null;

    // Cross-check our DB row (if exists)
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: unlockRow } = await sb
      .from("industrial_pulse_unlocks")
      .select("id, status, plan, week_start, amount_cents")
      .eq("stripe_session_id", session_id)
      .maybeSingle();

    return new Response(JSON.stringify({
      verified: paid,
      payment_status: session.payment_status,
      mode: session.mode,
      plan,
      plan_label: planMeta.label,
      plan_cadence: planMeta.cadence,
      plan_description: planMeta.description,
      product_name: product?.name || null,
      product_description: product?.description || null,
      amount_cents: amountTotal,
      amount_formatted: `$${(amountTotal / 100).toFixed(2)}`,
      currency,
      interval,
      customer_email: customerEmail,
      unlock_status: unlockRow?.status || null,
      week_start: unlockRow?.week_start || null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[verify-industrial-pulse-session]", msg);
    return new Response(JSON.stringify({ error: msg, verified: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

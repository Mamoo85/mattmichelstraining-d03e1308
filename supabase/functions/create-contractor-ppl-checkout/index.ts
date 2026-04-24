import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeSecretKey, isStripeTestMode } from "../_shared/stripe-key.ts";

const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
if (isStripeTestMode()) console.warn("[create-contractor-ppl-checkout] 🧪 TEST MODE");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, contractor_id, contractor_email } = await req.json();

    if (!lead_id || !contractor_id || !contractor_email) {
      return new Response(
        JSON.stringify({ error: "lead_id, contractor_id, and contractor_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch lead with site info for display
    const { data: lead, error: leadErr } = await sb
      .from("contractor_leads")
      .select("id, status, project_type, checkout_locked_by, lock_expires_at, contractor_lead_sites(trade, city, state)")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Guard 1: Already sold — log the miss for FOMO engine
    if (lead.status === "sold") {
      const site = (lead as any).contractor_lead_sites;
      sb.from("contractor_lead_views" as any).insert({
        contractor_id,
        lead_id,
        reason: "sold",
        trade: site?.trade || "",
        city: site?.city || "",
      });
      return new Response(
        JSON.stringify({ error: "lead_claimed", redirect: "/lead-claimed" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const lockExpiry = lead.lock_expires_at ? new Date(lead.lock_expires_at) : null;
    const isLocked = lead.status === "pending_checkout" &&
      lead.checkout_locked_by !== contractor_id &&
      lockExpiry !== null &&
      lockExpiry > now;

    // Guard 2: Soft-locked by another contractor — log the miss for FOMO engine
    if (isLocked) {
      const minutesLeft = Math.ceil((lockExpiry!.getTime() - now.getTime()) / 60000);
      const site = (lead as any).contractor_lead_sites;
      sb.from("contractor_lead_views" as any).insert({
        contractor_id,
        lead_id,
        reason: "locked",
        trade: site?.trade || "",
        city: site?.city || "",
      });
      return new Response(
        JSON.stringify({ error: "locked", minutesLeft }),
        { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atomic lock: only succeeds if lead is still available (eliminates TOCTOU race)
    const { data: locked } = await sb
      .from("contractor_leads")
      .update({
        status: "pending_checkout",
        checkout_locked_by: contractor_id,
        lock_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .eq("id", lead_id)
      .neq("status", "sold")
      .or(`checkout_locked_by.is.null,checkout_locked_by.eq.${contractor_id},lock_expires_at.lt.${new Date().toISOString()}`)
      .select("id")
      .maybeSingle();

    if (!locked) {
      return new Response(
        JSON.stringify({ error: "lead_claimed", redirect: "/lead-claimed" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const site = (lead as any).contractor_lead_sites;
    const rawOrigin = req.headers.get("origin") || "https://www.detroitwebagent.com";
    const ALLOWED_ORIGINS = [
      "https://www.detroitwebagent.com",
      "https://detroitwebagent.com",
      "https://www.mattmichelstraining.com",
      "https://mattmichelstraining.com",
      "http://localhost:5173",
      "http://localhost:8080",
    ];
    const origin = ALLOWED_ORIGINS.includes(rawOrigin) ? rawOrigin : "https://www.detroitwebagent.com";

    // Create Stripe one-time checkout, expires in 30 min (minimum allowed)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: contractor_email,
      expires_at: Math.floor(Date.now() / 1000) + 1830, // 30.5 min — buffer for network latency
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 5000, // $50
          product_data: {
            name: `Exclusive ${site?.trade || "Service"} Lead — ${site?.city || "Metro Detroit"}`,
            description: `One exclusive lead. You get the homeowner's name, phone, and email. No other contractor receives this lead.`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "contractor_lead_payment",
        lead_id,
        contractor_id,
        contractor_email,
        trade: site?.trade || "",
        city: site?.city || "",
      },
      success_url: `${origin}/lead-unlocked?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/contractor-leads`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-CONTRACTOR-PPL-CHECKOUT] Error:", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

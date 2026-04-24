// create-marketplace-lead-checkout — Stripe checkout for a la carte Golden Ticket leads
// Soft-locks the lead for 10 min while buyer completes payment.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Per-product per-lead pricing (cents)
const PRICE_MAP: Record<string, number> = {
  mortgage: 4900,   // $49 — refi-ready dossier
  talent:   4900,   // $49 — newly licensed candidate
  demand:   3900,   // $39 — wholesale buyer signal
  growth:   3900,   // $39 — B2B account intel
  supply:   5900,   // $59 — RFQ / supply opportunity
};

const PRODUCT_LABEL: Record<string, string> = {
  mortgage: "Mortgage Lead Dossier",
  talent:   "Talent Lead Dossier",
  demand:   "Demand Lead Dossier",
  growth:   "Growth Lead Dossier",
  supply:   "Supply Lead Dossier",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, product, buyer_email } = await req.json();
    if (!lead_id || !product || !buyer_email) {
      return new Response(JSON.stringify({ error: "lead_id, product, buyer_email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const unit = PRICE_MAP[product];
    if (!unit) {
      return new Response(JSON.stringify({ error: "invalid product" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Verify lead exists in the unified view before creating any Stripe session
    const { data: leadCheck } = await sb
      .from("unified_lead_marketplace_view")
      .select("id")
      .eq("id", lead_id)
      .maybeSingle();
    if (!leadCheck) {
      return new Response(JSON.stringify({ error: "lead_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomic soft-lock: insert with status='pending'. Fails if already sold/locked-active.
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: existing } = await sb
      .from("marketplace_lead_locks")
      .select("status, expires_at, buyer_email")
      .eq("lead_id", lead_id)
      .eq("product", product)
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      if (existing.status === "sold") {
        return new Response(JSON.stringify({ error: "already_sold" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existing.status === "pending" && existing.expires_at && existing.expires_at > now && existing.buyer_email !== buyer_email) {
        return new Response(JSON.stringify({ error: "locked_by_other" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Refresh our own pending lock or take over expired
      await sb.from("marketplace_lead_locks")
        .update({ status: "pending", buyer_email, expires_at: expiresAt })
        .eq("lead_id", lead_id).eq("product", product);
    } else {
      await sb.from("marketplace_lead_locks").insert({
        lead_id, product, buyer_email, status: "pending", expires_at: expiresAt,
      });
    }

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: buyer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: PRODUCT_LABEL[product] || "Lead Dossier" },
          unit_amount: unit,
        },
        quantity: 1,
      }],
      metadata: {
        type: "marketplace_lead_purchase",
        lead_id, product, buyer_email,
      },
      success_url: `${origin}/lead/${lead_id}?paid=1&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${product}-leads?cancelled=1`,
    });

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[create-marketplace-lead-checkout]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

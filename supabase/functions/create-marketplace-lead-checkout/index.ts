// create-marketplace-lead-checkout — Stripe checkout for a la carte Golden Ticket leads.
// Uses an atomic INSERT (status='soft_lock') covered by the partial unique index
// idx_mll_unique_active ON marketplace_lead_locks(lead_id,product)
// WHERE status IN ('soft_lock','claimed','sold') — only one winner per lead.
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

const PRICE_MAP: Record<string, number> = {
  mortgage: 4900,
  talent:   4900,
  demand:   3900,
  growth:   3900,
  supply:   5900,
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
    const email = String(buyer_email).trim().toLowerCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // SECURITY: Atomic soft-lock via INSERT with status='soft_lock'.
    // The partial unique index idx_mll_unique_active ensures only ONE INSERT wins
    // per (lead_id, product) when status IN ('soft_lock','claimed','sold').
    // Concurrent losers receive a unique constraint violation and are handled below.
    const { error: insertErr } = await sb.from("marketplace_lead_locks").insert({
      lead_id, product, buyer_email: email, status: "soft_lock", expires_at: expiresAt,
    });

    if (insertErr) {
      const { data: existing } = await sb
        .from("marketplace_lead_locks")
        .select("status, expires_at, buyer_email")
        .eq("lead_id", lead_id)
        .eq("product", product)
        .in("status", ["soft_lock", "claimed", "sold"])
        .maybeSingle();

      if (!existing) throw insertErr;

      if (existing.status === "sold" || existing.status === "claimed") {
        return new Response(JSON.stringify({ error: "already_sold" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date().toISOString();
      const activeHold = existing.expires_at && existing.expires_at > now;
      if (activeHold && existing.buyer_email !== email) {
        return new Response(JSON.stringify({ error: "locked_by_other" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Our own lock or expired lock from another buyer — refresh only if still soft_lock.
      const { data: refreshed } = await sb
        .from("marketplace_lead_locks")
        .update({ buyer_email: email, expires_at: expiresAt, locked_at: new Date().toISOString() })
        .eq("lead_id", lead_id)
        .eq("product", product)
        .eq("status", "soft_lock")
        .select("status")
        .maybeSingle();

      if (!refreshed) {
        return new Response(JSON.stringify({ error: "already_sold" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
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
        lead_id, product, buyer_email: email,
      },
      success_url: `${origin}/lead/${lead_id}?paid=1&buyer=${encodeURIComponent(email)}&session={CHECKOUT_SESSION_ID}`,
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

// request-lead-credit — self-serve lead credit request.
// Customer disputes a lead → we issue a Stripe credit invoice item against their subscription
// (applied to the next invoice). Audit-logged so Matt can review.
//
// Body: { email, lead_id, product, reason, lead_value_cents? }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default lead credit amounts per product (in cents)
const DEFAULT_CREDIT_CENTS: Record<string, number> = {
  trade_radar: 800,        // ~$8 per credited lead
  mortgage_radar: 1500,    // ~$15 per credited mortgage lead
  contractor_leads: 5000,  // $50 per credited PPL lead
  techalert: 2000,         // ~$20
  default: 1000,
};

const VALID_REASONS = new Set([
  "invalid_address",
  "duplicate_30day",
  "out_of_area_zip",
  "wrong_signal_type",
  "bad_phone_email",
  "other",
]);

async function notifyMatt(body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return;
  try {
    const params = new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_FROM, Body: body });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch {
    /* fail silently */
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const { email, lead_id, product, reason, lead_value_cents, details } = payload || {};

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!lead_id || typeof lead_id !== "string") {
      return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!product || typeof product !== "string") {
      return new Response(JSON.stringify({ error: "product required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!reason || !VALID_REASONS.has(reason)) {
      return new Response(JSON.stringify({ error: "invalid reason" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Idempotency — don't credit the same lead twice
    const { data: existing } = await sb
      .from("lead_credit_requests")
      .select("id, status, stripe_credit_id")
      .eq("lead_id", lead_id)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        ok: true,
        already_credited: true,
        status: existing.status,
        stripe_credit_id: existing.stripe_credit_id,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const amountCents = typeof lead_value_cents === "number" && lead_value_cents > 0 && lead_value_cents <= 50000
      ? Math.floor(lead_value_cents)
      : (DEFAULT_CREDIT_CENTS[product] ?? DEFAULT_CREDIT_CENTS.default);

    // Find Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];

    let stripeCreditId: string | null = null;
    let status: "credited" | "pending_review" = "pending_review";

    if (customer) {
      // Issue a NEGATIVE invoice item — applied to next invoice as a credit
      const item = await stripe.invoiceItems.create({
        customer: customer.id,
        amount: -amountCents,
        currency: "usd",
        description: `Lead credit · ${product} · ${reason} · lead ${lead_id.slice(0, 8)}`,
        metadata: { lead_id, product, reason, source: "self_serve_credit_flow" },
      });
      stripeCreditId = item.id;
      status = "credited";
    }

    // Audit log
    await sb.from("lead_credit_requests").insert({
      email,
      lead_id,
      product,
      reason,
      details: details || null,
      amount_cents: amountCents,
      status,
      stripe_customer_id: customer?.id || null,
      stripe_credit_id: stripeCreditId,
    });

    // Ping Matt
    await notifyMatt(
      `💰 Lead credit ${status === "credited" ? "issued" : "PENDING (no Stripe customer)"}: $${(amountCents / 100).toFixed(2)} to ${email} · ${product} · ${reason}`
    );

    return new Response(JSON.stringify({
      ok: true,
      status,
      amount_cents: amountCents,
      stripe_credit_id: stripeCreditId,
      message: status === "credited"
        ? `$${(amountCents / 100).toFixed(2)} credit applied to your next invoice.`
        : "Credit logged — Matt will review within 24h.",
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

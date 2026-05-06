// create-aged-lead-checkout — GET redirect to Stripe for aged lead Dutch auction
// Called directly from the SMS link: /functions/v1/create-aged-lead-checkout?lead_id=X&cid=Y
// Price is derived from aged_tier in DB — never trusted from URL params.
// Tier 0 (fresh/fallback): $50, Tier 1: $35, Tier 2: $20, Tier 3: $10

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const SITE_URL = "https://detroitwebagent.com";
const FALLBACK_URL = `${SITE_URL}/contractor-leads`;
const SOLD_URL = `${SITE_URL}/lead-claimed`;

// Dutch auction pricing by aged_tier — derived from DB, not URL params
const TIER_PRICES: Record<number, number> = {
  0: 5000, // $50 — fresh (shouldn't reach checkout at this tier, but safe fallback)
  1: 3500, // $35 — first markdown (48-72h)
  2: 2000, // $20 — second markdown (72-96h)
  3: 1000, // $10 — final clearance (96h+)
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const url = new URL(req.url);
  const lead_id = url.searchParams.get("lead_id");
  const contractor_id = url.searchParams.get("cid");

  if (!lead_id || !contractor_id) {
    return Response.redirect(FALLBACK_URL, 302);
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const [{ data: lead }, { data: contractor }] = await Promise.all([
      sb.from("contractor_leads")
        .select("id, status, aged_tier, project_type, contractor_lead_sites(trade, city, state)")
        .eq("id", lead_id)
        .single(),
      sb.from("contractor_clients")
        .select("id, email, phone, business_name")
        .eq("id", contractor_id)
        .single(),
    ]);

    // Lead already claimed — redirect to sold page
    if (!lead || lead.status === "sold") {
      return Response.redirect(SOLD_URL, 302);
    }

    // Can't create checkout without contractor email
    if (!contractor?.email) {
      return Response.redirect(FALLBACK_URL, 302);
    }

    const site = (lead as any)?.contractor_lead_sites;
    const trade = site?.trade || lead.project_type || "Service";
    const city = site?.city || "Metro Detroit";
    const now = new Date();

    // Price from DB-stored tier — no URL manipulation possible
    const agedTier: number = (lead as any).aged_tier ?? 0;
    const unitAmount = TIER_PRICES[agedTier] ?? 1500;
    const priceLabel = `$${(unitAmount / 100).toFixed(0)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: contractor.email,
      expires_at: Math.floor(now.getTime() / 1000) + 1800, // 30 min
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name: `${priceLabel} Cold Lead — ${trade} in ${city}`,
            description: `Unclaimed homeowner lead. Requested ${trade} quote. Contact info unlocked instantly on payment.`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type: "aged_ppl_lead",
        lead_id,
        contractor_id,
        contractor_email: contractor.email,
        trade,
        city,
        aged_tier: String(agedTier),
      },
      success_url: `${SITE_URL}/lead-unlocked?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: FALLBACK_URL,
    });

    return Response.redirect(session.url!, 302);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-AGED-LEAD-CHECKOUT] Error:", msg);
    return Response.redirect(FALLBACK_URL, 302);
  }
});

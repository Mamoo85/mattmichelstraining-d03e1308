// lead-radar-credit-pack — LR-13
// Creates a Stripe checkout session for prepaid lead credits.
// Packs: 5/$200, 10/$350 (saves $150), 25/$750 (saves $500).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACKS: Record<string, { size: number; cents: number; label: string }> = {
  starter: { size: 5, cents: 20000, label: "5 leads (save $50)" },
  pro: { size: 10, cents: 35000, label: "10 leads (save $150)" },
  scale: { size: 25, cents: 75000, label: "25 leads (save $500)" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { contractor_id, pack, contractor_email } = await req.json();
    const meta = PACKS[pack];
    if (!contractor_id || !meta) {
      return new Response(JSON.stringify({ error: "contractor_id and valid pack (starter|pro|scale) required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-08-27.basil" as any });

    const origin = req.headers.get("origin") || "https://detroitwebagent.com";

    // Pre-create the pending pack row
    const { data: packRow, error: packErr } = await sb
      .from("lead_credit_packs")
      .insert({
        contractor_id,
        pack_size: meta.size,
        price_cents: meta.cents,
        credits_remaining: meta.size,
        status: "pending",
      })
      .select("id")
      .single();

    if (packErr) throw packErr;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: contractor_email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `Lead Credit Pack — ${meta.label}` },
          unit_amount: meta.cents,
        },
        quantity: 1,
      }],
      metadata: {
        type: "lead_credit_pack",
        pack_id: packRow.id,
        contractor_id,
        pack_size: String(meta.size),
      },
      success_url: `${origin}/contractor-leads?credit_pack=success`,
      cancel_url: `${origin}/contractor-leads?credit_pack=cancelled`,
    });

    await sb
      .from("lead_credit_packs")
      .update({ stripe_session_id: session.id })
      .eq("id", packRow.id);

    return new Response(JSON.stringify({ url: session.url, pack_id: packRow.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[lead-radar-credit-pack]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

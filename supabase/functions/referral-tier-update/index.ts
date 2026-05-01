// referral-tier-update — recomputes tier + rewards for a referral partner
// Called after every successful referral conversion.
// Tier rules (v4 locked):
//   3 paid referrals → +1 free month earned
//   5 paid referrals → +$250 cash earned (silver tier)
//   10 paid referrals → 20% lifetime discount applied (platinum tier)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function notifyMatt(msg: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return;
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: TWILIO_FROM, To: ADMIN_PHONE, Body: msg }).toString(),
  }).catch(() => {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { partner_id } = await req.json();
    if (!partner_id) {
      return new Response(JSON.stringify({ error: "partner_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: partner, error } = await sb
      .from("referral_partners")
      .select("*")
      .eq("id", partner_id)
      .single();
    if (error || !partner) throw new Error("partner not found");

    const paid = partner.paid_referrals || 0;

    // Determine tier
    let newTier: "bronze" | "silver" | "gold" | "platinum" = "bronze";
    if (paid >= 10) newTier = "platinum";
    else if (paid >= 5) newTier = "gold";
    else if (paid >= 3) newTier = "silver";

    // Determine cumulative rewards earned (idempotent — based on counts)
    const freeMonths = Math.floor(paid / 3); // every 3rd referral = 1 free month
    const cashCents = paid >= 5 ? 25000 + Math.max(0, paid - 5) * 5000 : 0; // $250 at 5, +$50 each thereafter
    const lifetimeDiscount = paid >= 10 ? 20 : 0;

    const tierChanged = newTier !== partner.current_tier;
    const newReward =
      freeMonths > (partner.free_months_earned || 0) ||
      cashCents > (partner.cash_earned_cents || 0) ||
      lifetimeDiscount > (partner.lifetime_discount_pct || 0);

    await sb
      .from("referral_partners")
      .update({
        current_tier: newTier,
        free_months_earned: freeMonths,
        cash_earned_cents: cashCents,
        lifetime_discount_pct: lifetimeDiscount,
      })
      .eq("id", partner_id);

    if (tierChanged || newReward) {
      await notifyMatt(
        `🎉 Referral milestone: ${partner.name} (${partner.email}) hit ${paid} paid → ${newTier.toUpperCase()}. Months: ${freeMonths}, Cash: $${cashCents / 100}, Discount: ${lifetimeDiscount}%`,
      );
    }

    return new Response(
      JSON.stringify({ ok: true, tier: newTier, free_months: freeMonths, cash_cents: cashCents, lifetime_discount_pct: lifetimeDiscount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

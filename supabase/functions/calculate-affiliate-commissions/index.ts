import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Commission amounts by tier (cents)
const TIER_COMMISSIONS: Record<string, number> = {
  basic: 1500,       // $15
  foundation: 2000,  // $20
  custom: 2500,      // $25
  team_elite: 3000,  // $30
  unknown: 1500,     // default $15
};

const log = (msg: string, data?: any) => {
  const d = data ? ` — ${JSON.stringify(data)}` : "";
  console.log(`[CALCULATE-AFFILIATE-COMMISSIONS] ${msg}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all referral_conversions not yet in affiliate_commissions
    const { data: processed } = await sb
      .from("affiliate_commissions" as any)
      .select("referral_conversion_id");

    const processedIds = new Set((processed || []).map((r: any) => r.referral_conversion_id).filter(Boolean));

    const { data: conversions, error } = await sb
      .from("referral_conversions")
      .select("id, referrer_user_id, referred_user_id, referral_code, subscription_tier, created_at");

    if (error) throw error;
    if (!conversions || conversions.length === 0) {
      log("No new conversions to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newConversions = conversions.filter((c: any) => !processedIds.has(c.id));
    log("New conversions found", { count: newConversions.length });

    let inserted = 0;
    for (const conv of newConversions) {
      const tier = conv.subscription_tier || "unknown";
      const commissionCents = TIER_COMMISSIONS[tier] ?? TIER_COMMISSIONS.unknown;

      const { error: insertError } = await sb
        .from("affiliate_commissions" as any)
        .insert({
          referrer_user_id: conv.referrer_user_id,
          referred_user_id: conv.referred_user_id,
          referral_conversion_id: conv.id,
          commission_amount_cents: commissionCents,
          tier,
          status: "pending",
        });

      if (insertError) {
        log("Insert error", { id: conv.id, error: insertError.message });
        continue;
      }

      inserted++;
      log("Commission recorded", {
        referrer: conv.referrer_user_id,
        tier,
        amount: `$${(commissionCents / 100).toFixed(2)}`,
      });
    }

    return new Response(JSON.stringify({ processed: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CALCULATE-AFFILIATE-COMMISSIONS] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// lead-auto-refund — daily cron. Auto-credits contractor refund_credits_cents
// when a purchased lead has 3+ unreachable attempts and no successful contact within 72h.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const cutoffISO = new Date(Date.now() - 72 * 3600 * 1000).toISOString();

    // Eligible: purchases >=72h old, 3+ unreachable attempts, not yet refunded
    const { data: eligible = [] } = await supabase
      .from("contractor_lead_purchases")
      .select("id, contractor_id, amount_cents, created_at, unreachable_attempts, refunded_at, lead_id")
      .gte("unreachable_attempts", 3)
      .is("refunded_at", null)
      .lte("created_at", cutoffISO)
      .limit(200);

    let refunded = 0;
    let totalCredited = 0;

    for (const purchase of eligible || []) {
      // Credit contractor
      const { data: contractor } = await supabase
        .from("contractor_clients")
        .select("refund_credits_cents")
        .eq("id", purchase.contractor_id)
        .single();

      const newCredit = (contractor?.refund_credits_cents || 0) + (purchase.amount_cents || 0);

      const { error: cErr } = await supabase
        .from("contractor_clients")
        .update({ refund_credits_cents: newCredit })
        .eq("id", purchase.contractor_id);

      if (cErr) continue;

      const { error: pErr } = await supabase
        .from("contractor_lead_purchases")
        .update({ refunded_at: new Date().toISOString() })
        .eq("id", purchase.id);

      if (!pErr) {
        refunded++;
        totalCredited += purchase.amount_cents || 0;
      }
    }

    return new Response(JSON.stringify({ refunded, total_credited_cents: totalCredited }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

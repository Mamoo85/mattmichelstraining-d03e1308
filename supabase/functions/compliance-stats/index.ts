// compliance-stats — read-only KPI endpoint for TCPA/10DLC posture monitoring
// Returns 7-day SMS counts: sent, opt-outs, quiet-hours blocks, invalid numbers + recent compliance_blocks

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Run all queries in parallel
    const [smsSentRes, optOutsRes, blocksRes, recentBlocksRes, totalOptOutsRes] = await Promise.all([
      sb.from("system_comms_log")
        .select("id", { count: "exact", head: true })
        .eq("channel", "sms")
        .eq("status", "sent")
        .gte("created_at", sevenDaysAgo),
      sb.from("sms_opt_outs")
        .select("id", { count: "exact", head: true })
        .gte("opted_out_at", sevenDaysAgo),
      sb.from("compliance_blocks")
        .select("reason")
        .gte("created_at", sevenDaysAgo),
      sb.from("compliance_blocks")
        .select("phone, product, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      sb.from("sms_opt_outs").select("id", { count: "exact", head: true }),
    ]);

    // Bucket compliance_blocks by reason
    const blocksByReason: Record<string, number> = {};
    (blocksRes.data || []).forEach((row: { reason: string }) => {
      const key = row.reason || "unknown";
      blocksByReason[key] = (blocksByReason[key] || 0) + 1;
    });

    // Hash phone numbers for the recent-blocks table (privacy)
    const recentBlocks = (recentBlocksRes.data || []).map((b: { phone: string; product: string | null; reason: string; created_at: string }) => ({
      phone_masked: b.phone ? `${b.phone.slice(0, 5)}***${b.phone.slice(-2)}` : "—",
      product: b.product || "—",
      reason: b.reason || "—",
      created_at: b.created_at,
    }));

    return new Response(JSON.stringify({
      window_days: 7,
      sms_sent_7d: smsSentRes.count ?? 0,
      opt_outs_7d: optOutsRes.count ?? 0,
      opt_outs_total: totalOptOutsRes.count ?? 0,
      blocks_7d_total: (blocksRes.data || []).length,
      blocks_by_reason: blocksByReason,
      recent_blocks: recentBlocks,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[compliance-stats] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

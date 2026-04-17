// lead-quality-scorer — scores contractor_leads 1-10 based on phone-verified, value, urgency
// Triggered: on demand or via cron. Updates contractor_leads.quality_score + bidding_mode flag.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function scoreLeads(lead: any): { score: number; bidding: boolean } {
  let score = 5;

  // Phone verified (E.164 + 10 digits)
  const phone = (lead.phone || "").replace(/\D/g, "");
  if (phone.length === 10 || phone.length === 11) score += 2;
  if (lead.phone_verified === true) score += 1;

  // Value signals
  const valueText = `${lead.job_description || ""} ${lead.notes || ""}`.toLowerCase();
  const highValueKeywords = ["full replacement", "new install", "whole house", "commercial", "emergency", "burst", "no heat", "no hot water", "leak"];
  if (highValueKeywords.some((k) => valueText.includes(k))) score += 1;

  // Urgency
  const urgencyKeywords = ["emergency", "asap", "today", "tonight", "now", "urgent"];
  if (urgencyKeywords.some((k) => valueText.includes(k))) score += 1;

  // Email present
  if (lead.email && lead.email.includes("@")) score += 1;

  score = Math.min(10, Math.max(1, score));
  const bidding = score >= 8;
  return { score, bidding };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Score unscored or recent leads
    const sinceISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: leads = [] } = await supabase
      .from("contractor_leads")
      .select("*")
      .gte("created_at", sinceISO)
      .limit(500);

    let scored = 0;
    let biddingFlagged = 0;
    for (const lead of leads || []) {
      const { score, bidding } = scoreLeads(lead);
      const { error } = await supabase
        .from("contractor_leads")
        .update({ quality_score: score, bidding_mode: bidding })
        .eq("id", lead.id);
      if (!error) {
        scored++;
        if (bidding) biddingFlagged++;
      }
    }

    return new Response(JSON.stringify({ scored, bidding_flagged: biddingFlagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

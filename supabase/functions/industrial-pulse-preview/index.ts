// industrial-pulse-preview (Channel 3 — public)
// GET → returns the 3 most recent high-confidence signals with company_name BLURRED.
// Powers the public /industrial-pulse landing page (curiosity-gap teaser).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function redactCompany(name: string): string {
  if (!name) return "[REDACTED]";
  // Keep first letter of each word, replace rest with •
  return name.split(" ").map(word => {
    if (word.length <= 1) return word;
    return word[0] + "•".repeat(Math.min(word.length - 1, 6));
  }).join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Last 7 days, confidence >= 7, take top 3
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: signals, error } = await sb
      .from("industry_pulse_signals")
      .select("id, company_name, location, industry, hiring_roles, hiring_count, predicted_needs, confidence, detected_at")
      .gte("detected_at", sevenDaysAgo)
      .gte("confidence", 7)
      .order("confidence", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(3);

    if (error) throw error;

    // Total count this week (un-redacted count is OK as proof)
    const { count: weekCount } = await sb
      .from("industry_pulse_signals")
      .select("id", { count: "exact", head: true })
      .gte("detected_at", sevenDaysAgo)
      .gte("confidence", 7);

    const teasers = (signals || []).map(s => ({
      id: s.id,
      redacted_company: redactCompany(s.company_name || ""),
      location: s.location,
      industry: s.industry,
      hiring_roles: s.hiring_roles?.slice(0, 2) || [],
      hiring_count: s.hiring_count,
      predicted_needs: s.predicted_needs?.slice(0, 3) || [],
      confidence: s.confidence,
      detected_at: s.detected_at,
    }));

    return new Response(JSON.stringify({
      ok: true,
      teasers,
      total_this_week: weekCount || 0,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[industrial-pulse-preview]", msg);
    return new Response(JSON.stringify({ error: msg, teasers: [], total_this_week: 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

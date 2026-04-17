// build-daily-text-targets — Daily 8am ET cron + manual admin trigger
// Pulls high-value contractors from prospect_pool for today's manual texting list.
// Writes pre-written SMS scripts to daily_text_targets table.
// ALWAYS succeeds: falls back to seeded city/trade list if no prospects available.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRADES = ["roofing", "hvac", "electrical", "plumbing", "general_contractor", "remodeling"];
const CITIES = [
  "Grosse Pointe", "Warren", "Sterling Heights", "Royal Oak", "Troy",
  "Dearborn", "Southfield", "Livonia", "Canton", "Macomb",
  "Shelby Township", "Clinton Township", "St. Clair Shores", "Ferndale", "Eastpointe"
];

function buildSMS(businessName: string, trade: string): string {
  const tradeLabel = (trade || "contracting").replace(/_/g, " ");
  return `Hey — Matt from Detroit Web Agency. Quick question: do you have old estimates from the last couple years that never closed? I help ${tradeLabel} companies re-text those dead leads. You only pay $50 when one actually replies "yes." Zero upfront cost, zero risk. Here's how it works: detroitwebagent.com/dead-lead-intake — if it sounds interesting, shoot me a text back or call (313) 992-1219.`;
}

function buildFallbackTargets(): any[] {
  return CITIES.slice(0, 10).map((city, i) => {
    const trade = TRADES[i % TRADES.length];
    return {
      business_name: `[Search Google Maps: "${trade} contractor ${city}"]`,
      phone: null,
      trade,
      city,
      google_reviews: null,
      website_url: null,
      suggested_text: `Search Google Maps for "${trade} contractor ${city}" — find a business with 20+ reviews, grab their phone number, and text: ${buildSMS("them", trade)}`,
      status: "pending",
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  try {
    // Skip if today's list already built
    const { count } = await sb
      .from("daily_text_targets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`);

    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Already built today's list", count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to pull from prospect_pool — graceful if table is empty / missing
    let rows: any[] = [];
    try {
      const { data: prospects, error: prospectErr } = await sb
        .from("prospect_pool")
        .select("business_name, phone, audience_type, city, website, lead_score")
        .in("audience_type", TRADES)
        .not("phone", "is", null)
        .order("lead_score", { ascending: false, nullsFirst: false })
        .limit(100);

      if (!prospectErr && prospects && prospects.length > 0) {
        // Dedupe against last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: recent } = await sb
          .from("daily_text_targets")
          .select("business_name")
          .gte("created_at", thirtyDaysAgo);
        const recentNames = new Set((recent || []).map((r: any) => r.business_name?.toLowerCase()));
        const fresh = prospects.filter((p: any) => !recentNames.has(p.business_name?.toLowerCase()));

        rows = fresh.slice(0, 10).map((p: any) => ({
          business_name: p.business_name,
          phone: p.phone,
          trade: p.audience_type,
          city: p.city,
          google_reviews: null,
          website_url: p.website,
          suggested_text: buildSMS(p.business_name, p.audience_type),
          status: "pending",
        }));
      }
    } catch (e) {
      console.warn("[build-daily-text-targets] prospect_pool query failed, using fallback:", e);
    }

    // Always fall back to seeded targets if real prospects are unavailable
    const source = rows.length > 0 ? "prospect_pool" : "fallback";
    if (rows.length === 0) rows = buildFallbackTargets();

    const { error: insertErr } = await sb.from("daily_text_targets").insert(rows);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ ok: true, source, count: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[build-daily-text-targets] fatal:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

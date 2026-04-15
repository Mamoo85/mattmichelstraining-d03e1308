// build-daily-text-targets — Daily 8am ET cron
// Pulls 10 high-value contractors from pipeline_prospects for today's manual texting list.
// Writes pre-written SMS scripts to daily_text_targets table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const TRADES = ["roofing", "hvac", "electrical", "plumbing", "general_contractor", "remodeling"];
const CITIES = [
  "Grosse Pointe", "Warren", "Sterling Heights", "Royal Oak", "Troy",
  "Dearborn", "Southfield", "Livonia", "Canton", "Macomb",
  "Shelby Township", "Clinton Township", "St. Clair Shores", "Ferndale", "Eastpointe"
];

function buildSMS(businessName: string, trade: string): string {
  const ownerName = businessName.split(/\s+/)[0]; // rough first-word guess
  const tradeLabel = trade?.replace(/_/g, " ") || "contracting";

  return `Hey — Matt from Detroit Web Agency. Quick question: do you have old estimates from the last couple years that never closed? I help ${tradeLabel} companies re-text those dead leads. You only pay $50 when one actually replies "yes." Zero upfront cost, zero risk. Here's how it works: detroitwebagent.com/dead-lead-intake — if it sounds interesting, shoot me a text back or call (313) 992-1219.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get today's date to avoid re-seeding
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await sb
      .from("daily_text_targets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`);

    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ skipped: true, reason: "Already built today's list", count }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pull from pipeline_prospects — contractors with phone, 20+ reviews, not recently contacted
    const { data: prospects } = await sb
      .from("pipeline_prospects")
      .select("business_name, phone, industry, city, website, google_reviews")
      .in("industry", TRADES)
      .not("phone", "is", null)
      .gte("google_reviews", 15)
      .order("google_reviews", { ascending: false })
      .limit(100);

    if (!prospects || prospects.length === 0) {
      // Fallback: generate from known cities/trades for manual Google Maps lookup
      const fallbackTargets = CITIES.slice(0, 10).map((city, i) => ({
        business_name: `[Search Google Maps: "${TRADES[i % TRADES.length]} contractor ${city}"]`,
        phone: null,
        trade: TRADES[i % TRADES.length],
        city,
        google_reviews: null,
        website_url: null,
        suggested_text: `Search Google Maps for "${TRADES[i % TRADES.length]} contractor ${city}" — find a business with 20+ reviews, grab their phone number, and text: ${buildSMS("them", TRADES[i % TRADES.length])}`,
        status: "pending",
      }));

      const { error } = await sb.from("daily_text_targets").insert(fallbackTargets);
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, source: "fallback", count: fallbackTargets.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Filter out anyone already in daily_text_targets (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recentTargets } = await sb
      .from("daily_text_targets")
      .select("business_name")
      .gte("created_at", thirtyDaysAgo);

    const recentNames = new Set((recentTargets || []).map((r: any) => r.business_name?.toLowerCase()));
    const fresh = prospects.filter((p: any) => !recentNames.has(p.business_name?.toLowerCase()));
    const selected = fresh.slice(0, 10);

    const rows = selected.map((p: any) => ({
      business_name: p.business_name,
      phone: p.phone,
      trade: p.industry,
      city: p.city,
      google_reviews: p.google_reviews,
      website_url: p.website,
      suggested_text: buildSMS(p.business_name, p.industry),
      status: "pending",
    }));

    if (rows.length > 0) {
      const { error } = await sb.from("daily_text_targets").insert(rows);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, source: "pipeline", count: rows.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[build-daily-text-targets]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});

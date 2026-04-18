// apify-thomasnet-pull — On-demand industrial supplier prospecting via ThomasNet Actor.
// Triggers zen-studio/thomasnet-suppliers Apify Actor for Metro Detroit boiler/HVAC/machine shops,
// stores results in industry_pulse_signals as TechAlert sales prospects.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;

const ACTOR = "zen-studio~thomasnet-suppliers";

// Default search categories — Metro Detroit industrial verticals that buy from ThomasNet
const DEFAULT_CATEGORIES = [
  "boiler manufacturers",
  "machine shops",
  "metal fabricators",
  "industrial equipment",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!APIFY_API_TOKEN) {
    return new Response(JSON.stringify({ error: "APIFY_API_TOKEN missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { /* default */ }
  const categories: string[] = body.categories?.length ? body.categories : DEFAULT_CATEGORIES;
  const location = body.location || "Michigan";
  const maxItems = Number(body.maxItems) || 30;

  // Run the Actor SYNCHRONOUSLY (Apify run-sync-get-dataset-items) so we can return results inline
  // for the admin button. Webhook callback not needed for this on-demand flow.
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR)}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}&timeout=120`;
  let items: any[] = [];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchQueries: categories,
        location,
        maxItems,
      }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error(`ThomasNet Actor failed HTTP ${res.status}: ${t.slice(0, 500)}`);
      return new Response(JSON.stringify({ error: "Actor run failed", status: res.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    items = await res.json();
  } catch (e) {
    console.error("ThomasNet fetch error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Ingest into industry_pulse_signals as B2B prospects (sector="industrial_supplier")
  let inserted = 0;
  for (const it of items) {
    const company = it.companyName || it.name || it.title;
    if (!company) continue;
    try {
      const { error } = await sb.from("industry_pulse_signals").upsert({
        company_name: company,
        location: it.location || it.city || location,
        sector: "industrial_supplier",
        signal_type: "thomasnet_listing",
        industry: it.category || it.industry || "industrial",
        confidence: 6,
        source_urls: it.url ? [it.url] : null,
        recommended_pitch: `${company} listed on ThomasNet (${it.category || "industrial"}). Pitch TechAlert for verified licensed tradesperson hiring — boiler operators, electricians, HVAC techs.`,
        detected_at: new Date().toISOString(),
        client_tag: "techalert_prospect",
      }, { onConflict: "company_name,sector", ignoreDuplicates: false });
      if (!error) inserted++;
    } catch (err) {
      console.error("ingest thomasnet error:", err);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    items_received: items.length,
    inserted,
    categories,
    location,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

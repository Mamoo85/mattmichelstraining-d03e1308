// apify-thomasnet-pull — Michigan industrial supplier discovery via Google Maps (DataForSEO).
//
// HISTORY:
//  v1: Apify actor `zen-studio~thomasnet-suppliers-scraper` — returned 403, deprecated.
//  v2: Direct Firecrawl scrape of ThomasNet category pages — ThomasNet now gates the
//      entire public directory behind a login wall. Both legacy /suppliers/<state>/<cat>
//      URLs AND the /suppliers/search endpoint return "Register to continue" + "page not
//      found" markdown. Stealth proxies don't help — there is no public HTML to scrape.
//  v3 (current): DataForSEO Google Maps Live Advanced — searches "<category> Michigan"
//      and returns business names + websites + phones. Free public data, no gating, ~$0.005
//      per search. Same downstream behavior: upserts into industry_pulse_signals as
//      techalert_prospect rows.
//
// Function name kept (`apify-thomasnet-pull`) so admin UI buttons + crons keep working.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";

// Default category × city searches. Each one ~$0.005 = ~$0.10 per full run.
// DataForSEO Maps responds best to "<keyword> near <city>" with location_name="United States".
const DEFAULT_TARGETS: { keyword: string; category: string; location: string }[] = [
  { keyword: "boiler manufacturers near Detroit Michigan", category: "boiler manufacturers", location: "United States" },
  { keyword: "machine shops near Detroit Michigan",        category: "machine shops",        location: "United States" },
  { keyword: "metal fabricators near Detroit Michigan",    category: "metal fabricators",    location: "United States" },
  { keyword: "industrial equipment suppliers near Detroit Michigan", category: "industrial equipment", location: "United States" },
  { keyword: "machine shops near Grand Rapids Michigan",   category: "machine shops",        location: "United States" },
  { keyword: "metal fabricators near Lansing Michigan",    category: "metal fabricators",    location: "United States" },
];

interface ScrapedSupplier {
  company_name: string;
  city?: string;
  url?: string;
  phone?: string;
  category: string;
  rating?: number | null;
  reviews?: number | null;
}

async function mapsSearch(keyword: string, location: string, limit: number): Promise<ScrapedSupplier[]> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return [];
  try {
    const res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{
        keyword,
        location_name: location,
        language_name: "English",
        depth: Math.min(limit, 100),
      }]),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    if (data?.status_code !== 20000) {
      console.error(`[dataforseo] error for "${keyword}" @ ${location}: ${data?.status_message}`);
      return [];
    }
    const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    // Pull "city" out of "address_info.city" if present, else from address string
    return items
      .filter((it: any) => it.type === "maps_search" && it.title)
      .slice(0, limit)
      .map((it: any) => {
        const cityFromAddrInfo = it.address_info?.city;
        const cityFromAddr = typeof it.address === "string"
          ? (it.address.match(/,\s*([A-Za-z .'-]+),\s*MI\b/)?.[1] || undefined)
          : undefined;
        return {
          company_name: String(it.title).trim(),
          city: cityFromAddrInfo || cityFromAddr,
          url: it.url || it.domain || undefined,
          phone: it.phone || undefined,
          rating: it.rating?.value ?? null,
          reviews: it.rating?.votes_count ?? null,
          category: "", // filled by caller
        };
      });
  } catch (e) {
    console.error(`[dataforseo] exception for "${keyword}":`, e instanceof Error ? e.message : String(e));
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    return new Response(JSON.stringify({ error: "Discovery service not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { /* default */ }

  // Accept either v3-style targets ({keyword, category, location}) or
  // v2-style targets ({url, category}) — v2 ones are silently ignored now.
  const rawTargets = Array.isArray(body.targets) ? body.targets : [];
  const targets: { keyword: string; category: string; location: string }[] = rawTargets
    .filter((t: any) => t && typeof t.keyword === "string" && typeof t.category === "string")
    .map((t: any) => ({
      keyword: t.keyword,
      category: t.category,
      location: t.location || "United States",
    }));
  const useTargets = targets.length > 0 ? targets : DEFAULT_TARGETS;
  const maxItems = Number(body.maxItems) || 30;

  const allSuppliers: ScrapedSupplier[] = [];
  const perCategory: Record<string, number> = {};

  for (const t of useTargets) {
    const list = (await mapsSearch(t.keyword, t.location, maxItems)).map(s => ({ ...s, category: t.category }));
    perCategory[t.category] = (perCategory[t.category] || 0) + list.length;
    allSuppliers.push(...list);
    console.log(`[supplier-discovery] ${t.category} @ ${t.location}: ${list.length} businesses`);
  }

  // Dedupe by company_name (case-insensitive)
  const seen = new Set<string>();
  const unique = allSuppliers.filter(s => {
    const k = s.company_name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let inserted = 0;
  for (const it of unique) {
    try {
      const ratingNote = it.rating ? ` (Google ${it.rating}★, ${it.reviews ?? 0} reviews)` : "";
      // Skip if already exists (no unique constraint to upsert against)
      const { data: existing } = await sb
        .from("industry_pulse_signals")
        .select("id")
        .eq("company_name", it.company_name)
        .eq("sector", "industrial_supplier")
        .maybeSingle();
      if (existing) continue;

      const { error } = await sb.from("industry_pulse_signals").insert({
        company_name: it.company_name,
        location: it.city ? `${it.city}, MI` : "Michigan",
        sector: "industrial_supplier",
        signal_type: "google_maps_listing",
        industry: it.category,
        confidence: 6,
        source_urls: it.url ? [it.url] : null,
        recommended_pitch: `${it.company_name}${ratingNote} — Michigan ${it.category}. Pitch TechAlert for verified licensed tradesperson hiring (boiler operators, electricians, HVAC techs, machinists).`,
        detected_at: new Date().toISOString(),
        client_tag: "techalert_prospect",
      });
      if (!error) inserted++;
      else console.error("[insert] error:", error.message);
    } catch (err) {
      console.error("ingest supplier error:", err);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    items_received: unique.length,
    inserted,
    categories: useTargets.map(t => t.category),
    per_category: perCategory,
    source: "google_maps",
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

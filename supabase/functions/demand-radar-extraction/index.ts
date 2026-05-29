// demand-radar-extraction — Demand Radar Extraction Agent
//
// ROLE: Market intelligence operative. Identify active, high-intent home service
// businesses (HVAC, Plumbing, Electrical, Roofing) within target geographies.
//
// PROTOCOL:
//  - SECTOR BALANCING: enforce a strict 25/25/25/25 split across the 4 verticals.
//  - DISCOVERY: Google Places Text Search per vertical per zip.
//  - QUALIFICATION: drop entities flagged as sole-prop / zero employees; require
//    operational velocity signal (rating count >= 5 OR website present).
//  - FIELDS: company_name, primary_domain, physical_address, sector.
//  - QUEUE: push to demand_radar_targets with enrichment_status='pending'.
//  - CONSTRAINT: never search for CEO email/phone. Identify the entity + domain only.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SECTORS = ["hvac", "plumbing", "electrical", "roofing"] as const;
type Sector = typeof SECTORS[number];

const SECTOR_QUERIES: Record<Sector, string> = {
  hvac: "HVAC contractor",
  plumbing: "plumbing contractor",
  electrical: "electrical contractor",
  roofing: "roofing contractor",
};

// Default Metro Detroit zips. Override via { zips: [...], per_sector: N } in body.
const DEFAULT_ZIPS = [
  "48201", "48202", "48207", "48214", "48226", // Detroit core
  "48075", "48076", "48084", "48098",          // Southfield/Troy
  "48124", "48126", "48127",                   // Dearborn
  "48180", "48183",                            // Taylor/Trenton
  "48230", "48236",                            // Grosse Pointe
  "48312", "48315",                            // Sterling Heights
];

interface DiscoveredBusiness {
  company_name: string;
  primary_domain: string | null;
  physical_address: string | null;
  sector: Sector;
  place_id: string;
  rating_count: number;
}

async function placesTextSearch(query: string, location: string): Promise<any[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      query + " in " + location
    )}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error("[demand-radar] places error:", e);
    return [];
  }
}

async function placeDetails(placeId: string): Promise<any | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_address,user_ratings_total,business_status&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result || null;
  } catch {
    return null;
  }
}

function normalizeDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const u = new URL(website);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Qualification: drop sole-prop / zero-employee proxies.
 * Heuristic (no payroll API available cheaply):
 *  - require rating_count >= 5  (real customer footprint), OR
 *  - require a real website (operational velocity)
 *  - business_status must be OPERATIONAL
 */
function qualifies(detail: any, ratingCount: number, domain: string | null): boolean {
  if (detail?.business_status && detail.business_status !== "OPERATIONAL") return false;
  if (ratingCount >= 5) return true;
  if (domain) return true;
  return false;
}

async function discoverSector(sector: Sector, zips: string[], cap: number): Promise<DiscoveredBusiness[]> {
  const found = new Map<string, DiscoveredBusiness>();
  for (const zip of zips) {
    if (found.size >= cap) break;
    const results = await placesTextSearch(SECTOR_QUERIES[sector], zip);
    for (const r of results) {
      if (found.size >= cap) break;
      if (!r.place_id || found.has(r.place_id)) continue;
      const detail = await placeDetails(r.place_id);
      const domain = normalizeDomain(detail?.website || r.website);
      const ratingCount = detail?.user_ratings_total ?? r.user_ratings_total ?? 0;
      if (!qualifies(detail, ratingCount, domain)) continue;
      found.set(r.place_id, {
        company_name: detail?.name || r.name,
        primary_domain: domain,
        physical_address: detail?.formatted_address || r.formatted_address || null,
        sector,
        place_id: r.place_id,
        rating_count: ratingCount,
      });
    }
  }
  return Array.from(found.values());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const startedAt = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try {
    body = req.method === "POST" ? await req.json() : {};
  } catch {
    body = {};
  }
  const zips: string[] = Array.isArray(body.zips) && body.zips.length ? body.zips : DEFAULT_ZIPS;
  const perSector: number = Math.max(1, Math.min(100, Number(body.per_sector) || 25));

  // SECTOR BALANCING: identical cap per vertical → 25/25/25/25
  const bySector: Record<Sector, DiscoveredBusiness[]> = {
    hvac: [], plumbing: [], electrical: [], roofing: [],
  };
  for (const sector of SECTORS) {
    bySector[sector] = await discoverSector(sector, zips, perSector);
  }

  // Truncate to the smallest sector to enforce strict 25% ratio
  const minCount = Math.min(...SECTORS.map((s) => bySector[s].length));
  let queued = 0;
  const finalCounts: Record<string, number> = {};
  for (const sector of SECTORS) {
    const slice = bySector[sector].slice(0, minCount);
    finalCounts[sector] = slice.length;
    for (const biz of slice) {
      const { error } = await sb.from("demand_radar_targets").upsert(
        {
          company_name: biz.company_name,
          primary_domain: biz.primary_domain,
          physical_address: biz.physical_address,
          sector: biz.sector,
          place_id: biz.place_id,
          rating_count: biz.rating_count,
          enrichment_status: "pending",
          discovered_at: new Date().toISOString(),
        },
        { onConflict: "place_id", ignoreDuplicates: false }
      );
      if (!error) queued++;
    }
  }

  const summary = {
    ok: true,
    zips_scanned: zips.length,
    per_sector_target: perSector,
    balanced_to: minCount,
    queued_for_enrichment: queued,
    by_sector: finalCounts,
    raw_discovered_by_sector: Object.fromEntries(SECTORS.map((s) => [s, bySector[s].length])),
    duration_ms: Date.now() - startedAt,
  };
  console.log(`[demand-radar-extraction] ${JSON.stringify(summary)}`);

  return new Response(JSON.stringify(summary), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

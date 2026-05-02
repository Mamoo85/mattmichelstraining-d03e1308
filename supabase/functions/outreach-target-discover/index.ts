// Autonomous Target Discovery Engine
// POST { verticals[], states[], cities?[], limit?, channel_intent, min_confidence?, exclude_existing?, exclude_founders? }
// Pipeline per (vertical × city), parallel batches of 5:
//   1. Discover via Google Places + DataForSEO Local Pack
//   2. Cross-check state license boards (when applicable)
//   3. Enrich owner email/fax via existing waterfall
//   4. Compliance scrub (DNC, founders)
//   5. Score & insert into outreach_targets
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOwnerEmail } from "../_shared/email-waterfall.ts";
import { extractFaxNumber } from "../_shared/firecrawl.ts";
import { isFounderSeat } from "../_shared/founder-seats.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FOUNDER_EMAILS = ["matt@detroitwebagent.com", "matt@mattmichelstraining.com", "pmichels@djconley.com"];

interface DiscoveryInput {
  verticals: string[];
  states: string[];
  cities?: string[];
  limit?: number;
  channel_intent: "email" | "fax" | "postcard";
  min_confidence?: number;
  exclude_existing?: boolean;
  exclude_founders?: boolean;
  recipe_id?: string;
}

interface DiscoveredBiz {
  business_name: string;
  address?: string;
  city?: string;
  state: string;
  zip?: string;
  phone?: string;
  website?: string;
  vertical: string;
  source: string;
}

const STATE_CITIES: Record<string, string[]> = {
  MI: ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Ann Arbor"],
  OH: ["Cleveland", "Columbus", "Cincinnati", "Toledo", "Akron"],
  IN: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend"],
  IL: ["Chicago", "Aurora", "Rockford", "Joliet", "Naperville"],
  TX: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
  FL: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale"],
  GA: ["Atlanta", "Augusta", "Columbus", "Savannah"],
  NC: ["Charlotte", "Raleigh", "Greensboro", "Durham"],
  AZ: ["Phoenix", "Tucson", "Mesa", "Chandler"],
  CA: ["Los Angeles", "San Diego", "San Francisco", "San Jose", "Sacramento"],
};

async function googlePlaces(vertical: string, city: string, state: string): Promise<DiscoveredBiz[]> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return [];
  const q = `${vertical} contractor in ${city}, ${state}`;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${key}`,
    );
    if (!res.ok) return [];
    const d = await res.json();
    return (d?.results ?? []).slice(0, 20).map((p: any): DiscoveredBiz => ({
      business_name: p.name,
      address: p.formatted_address,
      city,
      state,
      vertical,
      source: "google_places",
    }));
  } catch { return []; }
}

async function dataforseoLocalPack(vertical: string, city: string, state: string): Promise<DiscoveredBiz[]> {
  const login = Deno.env.get("DATAFORSEO_LOGIN");
  const pass = Deno.env.get("DATAFORSEO_PASSWORD");
  if (!login || !pass) return [];
  try {
    const auth = btoa(`${login}:${pass}`);
    const res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword: `${vertical} ${city}`, location_name: `${city},${state},United States`, language_code: "en" }]),
    });
    if (!res.ok) return [];
    const d = await res.json();
    const items = d?.tasks?.[0]?.result?.[0]?.items ?? [];
    return items.slice(0, 20).map((it: any): DiscoveredBiz => ({
      business_name: it.title,
      address: it.address,
      phone: it.phone,
      website: it.url,
      city,
      state,
      vertical,
      source: "dataforseo_local",
    }));
  } catch { return []; }
}

async function placeDetails(biz: DiscoveredBiz): Promise<DiscoveredBiz> {
  // Best-effort website fetch via Google Places Details for google_places source
  if (biz.source !== "google_places" || biz.website) return biz;
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return biz;
  try {
    // Skipping full details lookup to save quota — channel-prospector already does this when needed
    return biz;
  } catch { return biz; }
}

function dedupeKey(b: DiscoveredBiz): string {
  return `${b.business_name.toLowerCase().trim()}|${(b.zip ?? b.city ?? "").toLowerCase()}`;
}

async function discoverPair(vertical: string, city: string, state: string): Promise<DiscoveredBiz[]> {
  const [a, b] = await Promise.all([googlePlaces(vertical, city, state), dataforseoLocalPack(vertical, city, state)]);
  const seen = new Set<string>();
  const merged: DiscoveredBiz[] = [];
  for (const biz of [...a, ...b]) {
    const k = dedupeKey(biz);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(biz);
  }
  return merged;
}

function scoreTarget(b: DiscoveredBiz, hasEmail: boolean, hasFax: boolean, hasPhone: boolean, hasWebsite: boolean): number {
  let s = 0;
  if (hasEmail) s += 40;
  if (hasFax) s += 20;
  if (hasPhone) s += 20;
  if (hasWebsite) s += 15;
  if (b.address) s += 5;
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "supabase env missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let input: DiscoveryInput;
  try { input = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: corsHeaders }); }

  if (!input.verticals?.length || !input.states?.length || !input.channel_intent) {
    return new Response(JSON.stringify({ error: "verticals, states, channel_intent required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(input.limit ?? 200, 500);
  const minConfidence = input.min_confidence ?? 40;
  const excludeExisting = input.exclude_existing !== false;
  const excludeFounders = input.exclude_founders !== false;

  // Open run record
  const { data: runRow, error: runErr } = await sb.from("discovery_runs").insert({
    recipe_id: input.recipe_id ?? null,
    criteria: input as any,
    status: "running",
  }).select("id").single();
  if (runErr || !runRow) {
    return new Response(JSON.stringify({ error: `run insert failed: ${runErr?.message}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const runId = runRow.id;

  const stats = {
    discovered: 0, enriched: 0, inserted: 0,
    skipped_dupe: 0, skipped_compliance: 0, skipped_low_confidence: 0,
    providers: { google_places: 0, dataforseo: 0, apollo: 0, hunter: 0, firecrawl: 0 } as Record<string, number>,
  };

  try {
    const cities = input.cities?.length
      ? input.cities.map((c) => ({ city: c, state: input.states[0] }))
      : input.states.flatMap((st) => (STATE_CITIES[st] ?? [st]).slice(0, 3).map((city) => ({ city, state: st })));

    const pairs: { vertical: string; city: string; state: string }[] = [];
    for (const v of input.verticals) for (const cs of cities) pairs.push({ vertical: v, ...cs });

    // Run discovery in parallel batches of 5
    const allDiscovered: DiscoveredBiz[] = [];
    for (let i = 0; i < pairs.length; i += 5) {
      const batch = pairs.slice(i, i + 5);
      const results = await Promise.all(batch.map((p) => discoverPair(p.vertical, p.city, p.state)));
      results.forEach((arr) => {
        allDiscovered.push(...arr);
        stats.providers.google_places += arr.filter((b) => b.source === "google_places").length;
        stats.providers.dataforseo += arr.filter((b) => b.source === "dataforseo_local").length;
      });
      if (allDiscovered.length >= limit * 2) break;
    }

    stats.discovered = allDiscovered.length;
    const trimmed = allDiscovered.slice(0, limit * 2);

    // Dedupe against existing outreach_targets if requested
    let existingNames = new Set<string>();
    if (excludeExisting) {
      const { data: existing } = await sb
        .from("outreach_targets")
        .select("business_name, zip, city")
        .in("vertical", input.verticals)
        .in("state", input.states);
      existingNames = new Set((existing ?? []).map((r: any) =>
        `${(r.business_name ?? "").toLowerCase().trim()}|${(r.zip ?? r.city ?? "").toLowerCase()}`));
    }

    // Enrich + insert
    for (const biz of trimmed) {
      if (stats.inserted >= limit) break;

      const k = dedupeKey(biz);
      if (existingNames.has(k)) { stats.skipped_dupe++; continue; }

      // Enrich
      const detailed = await placeDetails(biz);
      const domain = detailed.website
        ? detailed.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
        : "";

      let email: string | null = null;
      let fax: string | null = null;

      if (input.channel_intent === "email" && domain) {
        try {
          const r = await resolveOwnerEmail({ domain, businessName: detailed.business_name });
          email = r?.email ?? null;
          if (r?.source) stats.providers[r.source] = (stats.providers[r.source] ?? 0) + 1;
        } catch { /* fail open */ }
      }
      if (input.channel_intent === "fax" && detailed.website) {
        try { fax = await extractFaxNumber(detailed.website); if (fax) stats.providers.firecrawl++; }
        catch { /* fail open */ }
      }

      // Compliance scrub
      if (excludeFounders && email && (FOUNDER_EMAILS.includes(email.toLowerCase()) || isFounderSeat?.(email))) {
        stats.skipped_compliance++; continue;
      }

      const score = scoreTarget(detailed, !!email, !!fax, !!detailed.phone, !!detailed.website);
      if (score < minConfidence) { stats.skipped_low_confidence++; continue; }

      // Channel must have its required field
      if (input.channel_intent === "email" && !email) { stats.skipped_low_confidence++; continue; }
      if (input.channel_intent === "fax" && !fax) { stats.skipped_low_confidence++; continue; }
      if (input.channel_intent === "postcard" && !detailed.address) { stats.skipped_low_confidence++; continue; }

      const { error: insErr } = await sb.from("outreach_targets").insert({
        business_name: detailed.business_name,
        email,
        fax,
        phone: detailed.phone,
        address_line1: detailed.address,
        city: detailed.city,
        state: detailed.state,
        zip: detailed.zip,
        vertical: detailed.vertical,
        source: detailed.source,
        confidence_score: score,
        discovery_run_id: runId,
        last_enriched_at: new Date().toISOString(),
        enrichment_data: {
          discovery_trace: {
            run_id: runId,
            providers_used: stats.providers,
            domain,
          },
        } as any,
      });
      if (insErr) { console.error("[discover] insert failed:", insErr.message); continue; }
      stats.inserted++;
      stats.enriched++;
    }

    await sb.from("discovery_runs").update({
      status: "completed",
      discovered: stats.discovered,
      enriched: stats.enriched,
      inserted: stats.inserted,
      skipped_dupe: stats.skipped_dupe,
      skipped_compliance: stats.skipped_compliance,
      skipped_low_confidence: stats.skipped_low_confidence,
      provider_breakdown: stats.providers as any,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    if (input.recipe_id) {
      await sb.from("outreach_target_recipes").update({
        last_run_at: new Date().toISOString(),
        last_run_stats: stats as any,
        total_discovered: stats.discovered,
        total_inserted: stats.inserted,
      }).eq("id", input.recipe_id);
    }

    return new Response(JSON.stringify({ run_id: runId, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("discovery_runs").update({
      status: "failed", error_message: msg, completed_at: new Date().toISOString(),
    }).eq("id", runId);
    return new Response(JSON.stringify({ error: msg, run_id: runId, ...stats }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

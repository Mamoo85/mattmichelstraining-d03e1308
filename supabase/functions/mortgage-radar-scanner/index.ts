// Mortgage Radar daily scanner — FCRA-clean pre-trigger mortgage signals
// Sources (all public/behavioral, NOT bureau): BSEED permits, MI SOS new LLCs,
// county foreclosure/lis pendens, FSBO, divorce filings, property-tax cures,
// job changes. Property-level dedup: repeat signals on the same address roll
// up into one lead with a higher score and full signal_history.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendSMS } from "../_shared/twilio.ts";
import {
  validateLead,
  quarantineRaw,
  highQuarantineRateAlerts,
  type ScanRunStats,
} from "../_shared/anti-hallucination.ts";
import { scrapeZillowFSBO, scrapeEstateSales } from "../_shared/scrapers-public-listings.ts";
import {
  scrapeForeclosureNotices,
  scrapeProbateFilings,
  scrapeTaxDelinquency,
  scrapeFixerUpperListings,
} from "../_shared/scrapers-county-records.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const ADMIN_EMAIL = "matt@detroitwebagent.com";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const DWA_PHONE = "+13139921219";

function streetViewUrl(address: string, city: string, zip: string): string {
  if (!GOOGLE_MAPS_API_KEY || !address) return "";
  const loc = encodeURIComponent(`${address}, ${city || ""} ${zip || ""}, MI`);
  return `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${loc}&fov=80&key=${GOOGLE_MAPS_API_KEY}`;
}



interface RawSignal {
  full_name?: string;
  address?: string;
  city?: string;
  zip?: string;
  signal_type: string;
  signal_source: string;
  signal_detail?: string;
  signal_url?: string;
  signal_date?: string;
  estimated_equity?: number;
  estimated_loan_amount?: number;
  source_id?: string;            // ID in originating table; marked after successful upsert
  source_method?: "llm_search" | "scraper" | "api"; // provenance — drives validation strictness
  // Populated by validateLead() gate before insert. Never trust LLM-supplied lat/lon.
  lat?: number;
  lon?: number;
  formatted_address?: string;
}

const BASE_SCORES: Record<string, number> = {
  renovation_permit: 9,
  kitchen_addition_permit: 9,
  fsbo_listing: 8,
  lis_pendens: 9,
  foreclosure_notice: 9,
  divorce_filing: 7,
  new_llc_self_employed: 6,
  property_tax_cure: 7,
  high_equity_low_rate: 6,
  job_change_high_income: 7,
  probate_filing: 8,
  estate_sale: 7,
  tax_delinquency: 8,
  fixer_upper_listing: 7,
  sba_loan_approved: 6,
};

const OPENERS: Record<string, { opener: string; window: string }> = {
  renovation_permit: {
    opener: "Hey {name} — saw the permit on the {address} project. A lot of folks doing this size of reno are pulling cash out instead of using a HELOC. Happy to run numbers on both, no pressure.",
    window: "11am–1pm or 5pm–7pm",
  },
  fsbo_listing: {
    opener: "Hi {name} — saw your home is for sale by owner. When the next purchase comes around I help local buyers structure financing and lock in rates early. Worth 5 min when you're ready?",
    window: "5pm–8pm weekdays / weekends",
  },
  lis_pendens: {
    opener: "Hi {name} — I work with families in this exact spot. There are 2–3 refi options that can stop the clock if we move in the next couple weeks. Can I send the comparison?",
    window: "9am–11am",
  },
  foreclosure_notice: {
    opener: "Hi {name} — I work with families in this exact spot. There are 2–3 refi options that can stop the clock if we move in the next couple weeks. Can I send the comparison?",
    window: "9am–11am",
  },
  divorce_filing: {
    opener: "Hi {name} — when something like this comes up, the mortgage piece is usually the last thing handled. I can quietly pre-qualify you for a buyout refi so you have options on the table.",
    window: "lunch hour or 6pm+",
  },
  new_llc_self_employed: {
    opener: "Hi {name} — congrats on the new business. Most lenders want 2 yrs of self-employed tax returns; I work with bank-statement loans that get around that. Want me to run numbers?",
    window: "10am–noon",
  },
  property_tax_cure: {
    opener: "Hi {name} — saw the tax position get cured. If the cash came out of savings and you'd rather rebuild reserves, a quick cash-out refi might make sense. 5 min call?",
    window: "5pm–7pm",
  },
  high_equity_low_rate: {
    opener: "Hi {name} — your home has a lot of trapped equity right now. If you're sitting on a sub-4 rate I have a couple of HELOC options that don't touch the first mortgage.",
    window: "afternoon",
  },
  job_change_high_income: {
    opener: "Hi {name} — congrats on the move. New role often means relocation or a step-up purchase. I help structure financing before the listing rush. Worth 10 min?",
    window: "lunch or evening",
  },
  probate_filing: {
    opener: "Hi {name} — I work with families who inherited property and aren't sure of the best path forward financially. Whether that's a sale, a buyout, or an estate refi — I can walk through the options quietly. No rush.",
    window: "10am–noon or 6pm+",
  },
  estate_sale: {
    opener: "Hi {name} — saw the estate sale at {address}. If there's real property involved in the estate, I work with families on financing the transition — buyout, bridge, or cash-out. Worth a quick call?",
    window: "10am–2pm",
  },
  tax_delinquency: {
    opener: "Hi {name} — I work with homeowners who need to restructure their position fast. A cash-out refi can often clear tax delinquency and rebuild cushion at the same time. Can I run the numbers for you?",
    window: "9am–11am",
  },
  fixer_upper_listing: {
    opener: "Hi {name} — saw the listing on {address}. Buyers of fixer-uppers often use renovation loans (203k or Fannie HomeStyle) that roll purchase and rehab into one payment. Happy to explain if that's useful.",
    window: "5pm–8pm weekdays / weekends",
  },
  sba_loan_approved: {
    opener: "Hi {name} — congrats on the SBA approval. A lot of new business owners don't realize they can still qualify for a home purchase using bank-statement or business-bank lending programs even with a new LLC. Worth knowing about.",
    window: "10am–noon",
  },
};

function scoreFor(signal_type: string): number {
  return BASE_SCORES[signal_type] ?? 5;
}

function openerFor(signal_type: string): { opener: string; window: string } {
  return OPENERS[signal_type] ?? {
    opener: "Hi {name} — saw a public record on {address} and thought it might be worth a quick mortgage chat.",
    window: "10am–6pm local",
  };
}

// === SOURCES ===

async function scanBSEEDPermits(): Promise<RawSignal[]> {
  try {
    // Real field names verified against ArcGIS schema (lowercase)
    const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_trades_permits/FeatureServer/0/query?where=1%3D1&outFields=address,zip_code,permit_type,work_description,issued_date,contact_business_name&resultRecordCount=100&f=json&orderByFields=issued_date+DESC";
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    const out: RawSignal[] = [];
    for (const f of (j.features || [])) {
      const a = f.attributes || {};
      const desc = String(a.work_description || "").toLowerCase();
      const isReno = /kitchen|addition|remodel|bath|whole house|finish basement|roof/.test(desc);
      if (!isReno) continue;
      out.push({
        address: a.address || "",
        city: "Detroit",
        zip: String(a.zip_code || "").slice(0, 5) || undefined,
        signal_type: "renovation_permit",
        signal_source: "BSEED",
        signal_detail: String(a.work_description || "Renovation permit").slice(0, 200),
        signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : undefined,
      });
    }
    return out.slice(0, 50);
  } catch (e) {
    console.warn("[scanBSEEDPermits]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Sonar OSINT helper — used for FSBO, foreclosure, divorce, SOS, job changes.
// Cheap, returns JSON. Falls back to [] gracefully if not configured.
async function sonarSearch(prompt: string, schemaHint: string): Promise<any[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are a public-records OSINT researcher. Return ONLY a valid JSON array (no prose, no markdown fence). Each item: ${schemaHint}. Empty array if nothing found. Public sources only — no credit bureau data.` },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn("[sonarSearch]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// Phase C: deterministic scrape of Detroit/Oakland/Macomb Legal News public foreclosure notices.
// Replaces Sonar/Perplexity LLM discovery — every address is on a real, fetched legal-notice page.
async function scanForeclosureNotices(): Promise<RawSignal[]> {
  const items = await scrapeForeclosureNotices({ perSourceCap: 8 });
  return items.map((i) => ({
    address: i.address,
    city: i.city,
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// Phase B: deterministic Firecrawl scrape of Zillow FSBO city pages.
// Replaces LLM "discovery" — every address comes from a real Zillow page.
async function scanFSBOListings(): Promise<RawSignal[]> {
  const items = await scrapeZillowFSBO({ perCityCap: 5 });
  return items.map((i) => ({
    address: i.address,
    city: i.city,
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

async function scanDivorceFilings(): Promise<RawSignal[]> {
  const items = await sonarSearch(
    "Find recent (last 30 days) divorce / dissolution-of-marriage filings in Wayne, Oakland, or Macomb County Michigan circuit court public records. Include petitioner name, last-known property address if available, city, ZIP, filing date, source URL.",
    `{ "full_name": string, "address": string, "city": string, "zip": string, "signal_date": "YYYY-MM-DD", "signal_url": string, "signal_detail": string }`,
  );
  return items.map((i: any) => ({
    full_name: i.full_name || undefined,
    address: i.address || "",
    city: i.city || undefined,
    zip: typeof i.zip === "string" ? i.zip.slice(0, 5) : undefined,
    signal_type: "divorce_filing",
    signal_source: "CircuitCourt",
    signal_detail: i.signal_detail || "Divorce filing",
    signal_url: i.signal_url || undefined,
    signal_date: i.signal_date || undefined,
    source_method: "llm_search",
  })).filter(s => s.address);
}

// DATA SOURCE: BSEED ArcGIS — Detroit Open Data. Filters for high-cost permits
// (estimated construction value >= $100k). Large-dollar projects signal homeowners
// with significant equity who may want cash-out refi instead of draining savings.
async function scanHighEquityLowRate(): Promise<RawSignal[]> {
  try {
    // bseed_building_permits has amt_estimated_contractor_cost — correct layer for cost filtering
    const url = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_building_permits/FeatureServer/0/query?where=amt_estimated_contractor_cost+%3E%3D+100000&outFields=address,zip_code,work_description,issued_date,amt_estimated_contractor_cost&resultRecordCount=30&f=json&orderByFields=issued_date+DESC";
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    const out: RawSignal[] = [];
    for (const f of (j.features || [])) {
      const a = f.attributes || {};
      const cost = Number(a.amt_estimated_contractor_cost || 0);
      if (cost < 100000) continue;
      const desc = String(a.work_description || "Major renovation").slice(0, 200);
      out.push({
        address: a.address || undefined,
        city: "Detroit",
        zip: String(a.zip_code || "").slice(0, 5) || undefined,
        signal_type: "high_equity_renovation",
        signal_source: "BSEED_HighValue",
        signal_detail: `$${cost.toLocaleString()} permit — ${desc}`,
        signal_date: a.issued_date ? new Date(a.issued_date).toISOString().slice(0, 10) : undefined,
        estimated_equity: Math.round(cost * 2.5),
      });
    }
    return out.slice(0, 20);
  } catch (e) {
    console.warn("[scanHighEquityLowRate]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function scanNewMichiganLLCs(sb: ReturnType<typeof createClient>): Promise<RawSignal[]> {
  try {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data } = await (sb.from as any)("industry_pulse_signals")
      .select("id, business_name, city, created_at")
      .eq("signal_type", "new_business")
      .gte("created_at", since)
      .is("pitched_mortgage_radar_at", null)
      .order("created_at", { ascending: false })
      .limit(25);
    const out: RawSignal[] = [];
    for (const row of (data || [])) {
      const city = row.city || "Metro Detroit";
      const biz = row.business_name || "Unknown Business";
      out.push({
        full_name: biz,
        address: `${biz}, ${city}`,
        city,
        signal_type: "new_llc_self_employed",
        signal_source: "MI_SOS",
        signal_detail: `New LLC: ${biz} — self-employed owner may need bank-statement or DSCR loan`,
        signal_date: row.created_at?.slice(0, 10),
        source_id: row.id,
      });
    }
    return out;
  } catch (e) {
    console.warn("[scanNewMichiganLLCs]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function scanJobChanges(): Promise<RawSignal[]> { return []; }

// Phase C: deterministic scrape of probate court public notices via Legal News.
async function scanProbateFilings(): Promise<RawSignal[]> {
  const items = await scrapeProbateFilings({ perSourceCap: 6 });
  return items.map((i) => ({
    full_name: i.full_name,
    address: i.address,
    city: i.city,
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// Phase B: deterministic Firecrawl scrape of EstateSales.net MI city pages.
async function scanEstateSales(): Promise<RawSignal[]> {
  const items = await scrapeEstateSales({ perCityCap: 4 });
  return items.map((i) => ({
    address: i.address,
    city: i.city,
    zip: i.zip,
    signal_type: i.signal_type,
    signal_source: i.signal_source,
    signal_detail: i.signal_detail,
    signal_url: i.signal_url,
    signal_date: i.signal_date,
    source_method: "scraper" as const,
  }));
}

// Tax delinquency — county treasurers publish these publicly in Michigan
async function scanTaxDelinquency(): Promise<RawSignal[]> {
  const items = await sonarSearch(
    "Find recent property tax delinquency notices published by Wayne County, Oakland County, or Macomb County Michigan treasurer's office for the current tax year. Include property owner name, property address, city, ZIP, amount owed, source URL. These are published public records.",
    `{ "full_name": string, "address": string, "city": string, "zip": string, "signal_url": string, "signal_detail": string }`,
  );
  return items.map((i: any) => ({
    full_name: i.full_name || undefined,
    address: i.address || "",
    city: i.city || undefined,
    zip: typeof i.zip === "string" ? i.zip.slice(0, 5) : undefined,
    signal_type: "tax_delinquency",
    signal_source: "CountyTreasurer",
    signal_detail: i.signal_detail || "Property tax delinquency",
    signal_url: i.signal_url || undefined,
    signal_date: new Date().toISOString().slice(0, 10),
    source_method: "llm_search",
  })).filter(s => s.address);
}

// Fixer-upper listings — buyer needs renovation loan, seller may need bridge financing
async function scanFixerUpperListings(): Promise<RawSignal[]> {
  const items = await sonarSearch(
    "Find current real estate listings in Metro Detroit (Wayne, Oakland, Macomb counties) Michigan that use terms like 'as-is', 'handyman special', 'TLC', 'fixer upper', 'needs work', or 'investor special'. Sources: Zillow, Realtor.com, Redfin. Include address, city, ZIP, list price, listing URL.",
    `{ "address": string, "city": string, "zip": string, "signal_url": string, "signal_detail": string, "estimated_loan_amount": number }`,
  );
  return items.map((i: any) => ({
    address: i.address || "",
    city: i.city || undefined,
    zip: typeof i.zip === "string" ? i.zip.slice(0, 5) : undefined,
    signal_type: "fixer_upper_listing",
    signal_source: "MLS_Fixer",
    signal_detail: i.signal_detail || "As-is / fixer-upper listing",
    signal_url: i.signal_url || undefined,
    signal_date: new Date().toISOString().slice(0, 10),
    estimated_loan_amount: typeof i.estimated_loan_amount === "number" ? i.estimated_loan_amount : undefined,
    source_method: "llm_search",
  })).filter(s => s.address);
}

// SBA loan approvals via USASpending.gov — new self-employed owner who just got capital
// needs a home purchase or HELOC. USASpending is the verified working federal API.
async function scanSBAApprovals(): Promise<RawSignal[]> {
  try {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const body = {
      subawards: false,
      page: 1,
      limit: 50,
      sort: "Issued Date",
      order: "desc",
      fields: ["Award ID", "Recipient Name", "Loan Value", "Issued Date", "recipient_location_city_name", "recipient_location_state_code", "recipient_location_address_line1"],
      filters: {
        award_type_codes: ["08"], // SBA loan guarantees
        place_of_performance_locations: [{ country: "USA", state: "MI" }],
        time_period: [{ start_date: cutoff, end_date: new Date().toISOString().slice(0, 10) }],
      },
    };
    const r = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    // Normalize: USASpending API may return results under different keys
    const rawArr = j?.results ?? j?.data ?? j?.awards ?? [];
    const records: any[] = Array.isArray(rawArr) ? rawArr : [];
    if (!records.length && j) {
      console.warn("[scanSBAApprovals] Ingestion Pipeline — unexpected response shape, keys:", Object.keys(j).slice(0, 8).join(","));
    }
    const metro = /detroit|dearborn|livonia|warren|sterling|troy|pontiac|southfield|ann arbor|canton|westland|farmington|royal oak|grosse pointe|hamtramck/i;
    return records
      .filter((rec: any) => metro.test(rec.recipient_location_city_name || rec.city || "") && Number(rec["Loan Value"] ?? rec.loan_value ?? rec.award_amount ?? 0) >= 50_000)
      .map((rec: any) => ({
        full_name: rec["Recipient Name"] ?? rec.recipient_name ?? rec.awardee_name ?? undefined,
        address: rec.recipient_location_address_line1 ?? rec.address ?? "",
        city: rec.recipient_location_city_name || undefined,
        signal_type: "sba_loan_approved",
        signal_source: "USASpending",
        signal_detail: `SBA loan: $${Number(rec["Loan Value"] || 0).toLocaleString()} approved for ${rec["Recipient Name"] || "business"} in ${rec.recipient_location_city_name || "MI"}`,
        signal_date: rec["Issued Date"] ? String(rec["Issued Date"]).slice(0, 10) : undefined,
        estimated_loan_amount: rec["Loan Value"] ? Math.round(Number(rec["Loan Value"]) * 0.7) : undefined,
      }))
      .filter((s: RawSignal) => s.address)
      .slice(0, 30);
  } catch (e) {
    console.warn("[scanSBAApprovals]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function notifyClients(sb: ReturnType<typeof createClient>, zip: string | undefined, score: number): Promise<string[]> {
  if (!zip || score < 7) return [];
  const { data: clients } = await (sb.from as any)("mortgage_radar_clients")
    .select("id, zip_codes")
    .eq("active", true);
  const matched = (clients || []).filter((c: any) => Array.isArray(c.zip_codes) && c.zip_codes.includes(zip));
  return matched.map((c: any) => c.id);
}

// Property-level dedup: address + zip is the unique key.
// If the same property emits a new signal type, score is bumped (capped 10),
// and the new signal is appended to signal_history.
async function upsertWithDedup(sb: ReturnType<typeof createClient>, s: RawSignal): Promise<{ id: string; created: boolean } | null> {
  if (!s.address) return null;
  // Phase B trust gate: LLM-only-sourced leads are capped at 3 until a 2nd source confirms.
  // Deterministic scrapers + APIs use full base score immediately.
  const rawBase = scoreFor(s.signal_type);
  const baseScore = s.source_method === "llm_search" ? Math.min(3, rawBase) : rawBase;
  const { opener, window } = openerFor(s.signal_type);

  const lookupAddress = s.address.toLowerCase();
  const { data: existing } = await (sb.from as any)("mortgage_radar_leads")
    .select("id, score, signal_count, signal_history, signal_type")
    .eq("zip", s.zip || "")
    .ilike("address", s.address)
    .maybeSingle();

  if (existing) {
    // Same property, new signal — bump score, append history (only if signal type is new or > 30 days old)
    const history: any[] = Array.isArray(existing.signal_history) ? existing.signal_history : [];
    const alreadyLogged = history.some((h: any) =>
      h.signal_type === s.signal_type &&
      h.signal_date === (s.signal_date || null)
    );
    if (alreadyLogged) return { id: existing.id, created: false };

    history.push({
      signal_type: s.signal_type,
      signal_source: s.signal_source,
      signal_detail: s.signal_detail || null,
      signal_date: s.signal_date || null,
      detected_at: new Date().toISOString(),
    });

    // Repeat signal on same property = stronger intent. Bump by +1, capped at 10.
    const newScore = Math.min(10, Math.max(existing.score, baseScore) + 1);

    await (sb.from as any)("mortgage_radar_leads")
      .update({
        score: newScore,
        signal_count: (existing.signal_count || 1) + 1,
        signal_history: history,
        last_signal_at: new Date().toISOString(),
        // Keep latest signal as the "headline"
        signal_type: s.signal_type,
        signal_source: s.signal_source,
        signal_detail: s.signal_detail || null,
        signal_url: s.signal_url || null,
        signal_date: s.signal_date || null,
        suggested_opener: opener,
        best_call_window: window,
      })
      .eq("id", existing.id);
    return { id: existing.id, created: false };
  }

  // New property — insert
  const row = {
    full_name: s.full_name || null,
    address: s.formatted_address || s.address,
    city: s.city || null,
    state: "MI",
    zip: s.zip || null,
    signal_type: s.signal_type,
    signal_source: s.signal_source,
    signal_detail: s.signal_detail || null,
    signal_url: s.signal_url || null,
    signal_date: s.signal_date || null,
    estimated_equity: s.estimated_equity || null,
    estimated_loan_amount: s.estimated_loan_amount || null,
    score: baseScore,
    signal_count: 1,
    last_signal_at: new Date().toISOString(),
    signal_history: [{
      signal_type: s.signal_type,
      signal_source: s.signal_source,
      signal_detail: s.signal_detail || null,
      signal_date: s.signal_date || null,
      detected_at: new Date().toISOString(),
    }],
    suggested_opener: opener,
    best_call_window: window,
    // Use validated coordinates for Street View when available — kills the fuzzy-match bug.
    street_view_url: s.lat != null && s.lon != null && GOOGLE_MAPS_API_KEY
      ? `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${s.lat},${s.lon}&fov=80&key=${GOOGLE_MAPS_API_KEY}`
      : streetViewUrl(s.address || "", s.city || "", s.zip || ""),
    lat: s.lat ?? null,
    lon: s.lon ?? null,
    raw: s as unknown as Record<string, unknown>,
  };
  const { data: ins, error } = await (sb.from as any)("mortgage_radar_leads")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) {
    // Race: another concurrent insert. Fall back to upsert lookup.
    if (String(error.message || "").includes("duplicate")) {
      const { data: again } = await (sb.from as any)("mortgage_radar_leads")
        .select("id").eq("zip", s.zip || "").ilike("address", s.address).maybeSingle();
      return again ? { id: again.id, created: false } : null;
    }
    console.warn("[upsertWithDedup] insert error:", error.message);
    return null;
  }
  return ins ? { id: ins.id, created: true } : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const startedAt = new Date().toISOString();

  const results = await Promise.allSettled([
    scanBSEEDPermits(),
    scanForeclosureNotices(),
    scanFSBOListings(),
    scanDivorceFilings(),
    scanNewMichiganLLCs(sb),
    scanHighEquityLowRate(),
    scanJobChanges(),
    scanProbateFilings(),
    scanEstateSales(),
    scanTaxDelinquency(),
    scanFixerUpperListings(),
    scanSBAApprovals(),
  ]);

  const signals: RawSignal[] = [];
  const sourceBreakdown: Record<string, number> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const s of r.value) {
        signals.push(s);
        sourceBreakdown[s.signal_source] = (sourceBreakdown[s.signal_source] || 0) + 1;
      }
    } else {
      console.warn("[scanner] source rejected:", r.reason);
    }
  }

  let inserted = 0;
  let updated = 0;
  let quarantined = 0;
  let alertsQueued = 0;
  let inlineEnriched = 0;
  let queuedForEnrich = 0;
  let hotSmsFired = 0;
  let inlineEnrichBudget = 5; // first 5 new leads per run get inline enrich; rest go to queue
  const acceptedBySource: Record<string, number> = {};
  const quarantinedBySource: Record<string, number> = {};

  for (const s of signals) {
    // ===== ANTI-HALLUCINATION GATE =====
    // Validates address (Google Address Validation), checks placeholder fingerprints,
    // checks cross-run quarantine history, and demands a real source URL for LLM-sourced leads.
    const gate = await validateLead(sb, s, { sourceMethod: s.source_method || "scraper" });
    if (!gate.pass) {
      await quarantineRaw(sb, s, gate.reject_code || "unknown", gate.reject_reason || "validation failed", s.source_method || "unknown");
      quarantined += 1;
      quarantinedBySource[s.signal_source] = (quarantinedBySource[s.signal_source] || 0) + 1;
      continue;
    }
    // Stamp validated lat/lon and formatted address onto the signal so upsertWithDedup persists them.
    s.lat = gate.lat;
    s.lon = gate.lon;
    s.formatted_address = gate.formatted;

    const res = await upsertWithDedup(sb, s);
    if (!res) continue;
    if (res.created) inserted += 1; else updated += 1;
    acceptedBySource[s.signal_source] = (acceptedBySource[s.signal_source] || 0) + 1;

    // Mark originating row as processed after successful upsert
    if (s.source_id) {
      await (sb.from as any)("industry_pulse_signals")
        .update({ pitched_mortgage_radar_at: new Date().toISOString() })
        .eq("id", s.source_id);
    }

    // Enrichment: inline first 5 new leads, queue the rest
    if (res.created) {
      if (inlineEnrichBudget > 0) {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/mortgage-radar-enrich`, {
            method: "POST",
            headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
            body: JSON.stringify({ lead_id: res.id }),
          });
          if (r.ok) { inlineEnriched += 1; inlineEnrichBudget -= 1; }
        } catch (_) { /* fall through to queue */ }
      } else {
        await (sb.from as any)("mortgage_radar_enrich_queue")
          .upsert({ lead_id: res.id, status: "pending" }, { onConflict: "lead_id" });
        queuedForEnrich += 1;
      }
    }

    // Phase B: respect the trust cap. Unverified LLM-only leads cannot trigger hot SMS.
    const rawScore = scoreFor(s.signal_type);
    const score = s.source_method === "llm_search" ? Math.min(3, rawScore) : rawScore;
    const matchedClientIds = await notifyClients(sb, s.zip, score);
    if (matchedClientIds.length > 0) {
      await (sb.from as any)("mortgage_radar_leads")
        .update({ notified_client_ids: matchedClientIds })
        .eq("id", res.id);
      alertsQueued += matchedClientIds.length;

      // Hot lead SMS (score >= 9) to matched clients with phone on file
      if (score >= 9 && res.created) {
        const { data: hotClients } = await (sb.from as any)("mortgage_radar_clients")
          .select("phone, business_name")
          .in("id", matchedClientIds);
        for (const c of (hotClients || [])) {
          if (c.phone) {
            const sigLabel = s.signal_type.replace(/_/g, " ");
            const dashLink = `https://detroitwebagent.com/my-mortgage-radar?lead=${res.id}`;
            const streetView = s.address ? `https://maps.google.com/?q=${encodeURIComponent(s.address)}` : "";
            const hotMsg = `🔥 HOT MORTGAGE LEAD (${score}/10)\n${s.address || ""}\nSignal: ${sigLabel}\n\n📍 ${streetView}\n📊 Intel + outreach: ${dashLink}\n\nManual send only — TCPA. Reply STOP to opt out. — DWA`;
            await sendSMS(c.phone, DWA_PHONE, hotMsg, "mortgage_radar_hot_lead");
            hotSmsFired += 1;
          }
        }
      }
    }
  }

  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [ADMIN_EMAIL],
          subject: `🏠 Mortgage Radar — ${inserted} new, ${updated} updated, ${alertsQueued} alerts, ${hotSmsFired} hot SMS`,
          html: `<p><strong>Mortgage Radar daily run</strong></p>
            <p>Started: ${startedAt}<br>Signals fetched: ${signals.length}<br>New leads: ${inserted}<br>Updated (repeat signals): ${updated}<br>Client alerts queued: ${alertsQueued}<br>Inline-enriched: ${inlineEnriched}<br>Queued for enrich: ${queuedForEnrich}<br>Hot lead SMS fired: ${hotSmsFired}</p>
            <pre>${JSON.stringify(sourceBreakdown, null, 2)}</pre>`,
        }),
      });
    } catch (e) {
      console.warn("[mortgage-radar-scanner] digest send failed:", e instanceof Error ? e.message : String(e));
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    started_at: startedAt,
    signals_fetched: signals.length,
    inserted,
    updated,
    alerts_queued: alertsQueued,
    inline_enriched: inlineEnriched,
    queued_for_enrich: queuedForEnrich,
    hot_sms_fired: hotSmsFired,
    source_breakdown: sourceBreakdown,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

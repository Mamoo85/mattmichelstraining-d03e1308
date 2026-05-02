// hire-alert-scanner — daily 7am ET
// Scans MIOSHA license DB and job boards for available licensed tradespeople.
// Enriches top candidates via NPI + Sonar OSINT + PDL before sending alerts.
// Alerts field service clients when new actionable candidates appear.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { generateJSON } from "../_shared/ai.ts";
import { withBreaker } from "../_shared/circuit-breaker.ts";
import { isPlausibleHumanName } from "../_shared/sanitize-candidate.ts";
import { fetchHireSignals } from "../_shared/signal-waterfall.ts";
import { fetchLicenses } from "../_shared/license-waterfall.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const SNOV_USER_ID = Deno.env.get("SNOV_USER_ID") || "";
const SNOV_API_KEY = Deno.env.get("SNOV_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// NPI taxonomy codes that command premium scoring (+1 to +3 points)
const TAXONOMY_PREMIUM_MAP: Record<string, number> = {
  "Certified Registered Nurse Anesthetist": 3,
  "Nurse Practitioner": 2,
  "Nurse Anesthetist, Certified Registered": 3,
  "Clinical Nurse Specialist": 2,
  "Registered Nurse": 1,
  "Certified Nurse Midwife": 2,
  "Physician Assistant": 2,
  "Surgical/Operating Room": 2,
  "Critical Care": 2,
  "Emergency": 1,
  "Intensive Care": 2,
};
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN") || "";
const APIFY_WEBHOOK_SECRET = Deno.env.get("APIFY_WEBHOOK_SECRET") || "";

// Apify Actor IDs — update if Matt swaps Actors in his Apify account
const APIFY_ACTORS = {
  miosha: "transparent_meteorite~m2training",  // Matt's MIOSHA Excel scraper (auto-rebuilt from m2training repo)
  indeed: "misceres~indeed-scraper",            // Most popular maintained Indeed scraper
  linkedin: "harvestapi~linkedin-profile-scraper",  // Active LinkedIn profile scraper (Proxycurl replacement)
};

const APIFY_INPUTS = {
  miosha: {
    licenses: [
      "boiler", "electrical", "plumbing", "hvac", "mechanical",
      "cosmetology", "esthetics", "barbering",
      "real estate broker", "real estate salesperson",
      "insurance agent", "insurance adjuster",
      "pharmacy technician", "pharmacist",
      "respiratory therapist", "physical therapist", "occupational therapist",
      "speech language pathologist", "audiologist",
      "professional engineer", "architect",
    ],
    state: "MI",
  },
  indeed: {
    // Trades + healthcare — covers both TechAlert verticals
    position: "boiler operator OR HVAC technician OR master electrician OR plumber OR CNA OR registered nurse OR LPN OR home health aide",
    country: "US",
    location: "Detroit, MI",
    maxItems: 50,
    parseCompanyDetails: false,
    saveOnlyUniqueItems: true,
  },
  linkedin: {
    // LinkedIn Actor enriches profiles by URL — we'll feed it candidates the scanner already found
    // For now, send a search-by-keyword to seed the dataset; downstream we'll wire URL-based enrichment
    searchQueries: [
      "boiler operator Detroit Michigan",
      "master electrician Detroit",
      "HVAC technician Metro Detroit",
      "CNA certified nursing assistant Metro Detroit open to work",
      "registered nurse RN Detroit Michigan open to work",
      "LPN licensed practical nurse Detroit Michigan",
    ],
    maxResultsPerQuery: 20,
  },
};

async function dispatchApifyRuns(sb: any): Promise<void> {
  if (!APIFY_API_TOKEN || !APIFY_WEBHOOK_SECRET) {
    console.warn("[apify-dispatch] APIFY_API_TOKEN or APIFY_WEBHOOK_SECRET missing — skipping");
    return;
  }
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // Include batch_id in URL too — guarantees the handler can recover batch context even if payloadTemplate fails
  const webhookUrl = `${SUPABASE_URL}/functions/v1/apify-results-handler?secret=${encodeURIComponent(APIFY_WEBHOOK_SECRET)}&batch_id=${encodeURIComponent(batchId)}`;

  // Insert batch row up front so the webhook handler can find it
  await sb.from("apify_run_batches").insert({ batch_id: batchId, run_at: new Date().toISOString() });

  // Webhook spec — fires when run succeeds or fails. customData carries our batch_id.
  const webhooks = [{
    eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
    requestUrl: webhookUrl,
    payloadTemplate: JSON.stringify({
      eventType: "{{eventType}}",
      eventData: { actorId: "{{eventData.actorId}}", actorRunId: "{{eventData.actorRunId}}", customData: { batch_id: batchId } },
      resource: "{{resource}}",
    }),
  }];

  // Only dispatch the custom MIOSHA Actor (free compute ~$0.01/run).
  // Indeed + LinkedIn Apify Store actors charge per result and burned the free credit.
  // Sonar OSINT already handles job board + LinkedIn enrichment at $0.005/candidate.
  const sources: Array<keyof typeof APIFY_ACTORS> = ["miosha"];
  const dispatches = sources.map(async (src) => {
    const actor = APIFY_ACTORS[src];
    const input = APIFY_INPUTS[src];
    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?token=${APIFY_API_TOKEN}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, webhooks }),
        signal: AbortSignal.timeout(15_000),
      });
      const rawBody = await res.text();
      let data: any = {};
      try { data = JSON.parse(rawBody); } catch { /* non-JSON */ }
      const runId = data?.data?.id || null;
      if (!runId) {
        // Surface the actual Apify error (404 wrong slug, 401 bad token, 402 out of credits, etc.)
        console.error(`[apify-dispatch] ${src} actor=${actor} HTTP ${res.status} body=${rawBody.slice(0, 500)}`);
      } else {
        console.log(`[apify-dispatch] ${src} → ${runId} (HTTP ${res.status})`);
        const updates: Record<string, unknown> = {};
        updates[`${src}_run_id`] = runId;
        await sb.from("apify_run_batches").update(updates).eq("batch_id", batchId);
      }
    } catch (e) {
      console.error(`[apify-dispatch] ${src} dispatch error:`, e instanceof Error ? e.message : String(e));
    }
  });
  await Promise.allSettled(dispatches);
  console.log(`[apify-dispatch] batch ${batchId} dispatched`);
}

// Healthcare role detection for NPI routing
const HEALTHCARE_KEYWORDS = ["rn", "registered nurse", "lpn", "licensed practical nurse", "practical nurse", "cna", "certified nursing assistant", "nurse aide", "nursing assistant", "director of nursing", "don", "nursing director", "home health aide", "home health", "hha", "nurse", "nursing"];

// Normalize a license type (and optional source hint) to a canonical trade slug.
// Mirrors the logic used in the candidate-quality-scorer + the trade backfill migration.
function classifyTradeForCandidate(licenseType?: string | null, source?: string | null): string | null {
  if (!licenseType) {
    if (source === "miosha") return "other_trade";
    return null;
  }
  const lt = licenseType.toLowerCase();
  if (lt.includes("boiler") || lt.includes("stationary")) return "boiler";
  if (lt.includes("hvac") || lt.includes("refrigeration") || lt.includes("mechanical")) return "hvac";
  if (lt.includes("plumb")) return "plumbing";
  if (lt.includes("electric")) return "electrical";
  if (lt.includes("nurse practitioner")) return "nurse_practitioner";
  if (lt.includes("nurse") || lt.includes("lpn") || lt.includes("rn") || lt.includes("cna")) return "nursing";
  if (lt.includes("home health") || lt.includes("aide")) return "home_health";
  if (lt.includes("weld")) return "welding";
  return "other_trade";
}

function isHealthcareRole(licenseType?: string): boolean {
  if (!licenseType) return false;
  const lower = licenseType.toLowerCase();
  return HEALTHCARE_KEYWORDS.some((kw) => lower.includes(kw));
}

async function notifyMatt(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from: "Detroit Web Agency <matt@detroitwebagent.com>",
        to: ["matt@detroitwebagent.com"],
        subject,
        html,
      }),
    });
  } catch (e) {
    console.error("[notifyMatt] email failed:", e instanceof Error ? e.message : String(e));
  }
}

async function firecrawlSearch(query: string): Promise<Array<{ url: string; markdown: string; title: string }>> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 5 }),
      signal: AbortSignal.timeout(15_000),
    });
    // Read as text first — Firecrawl returns HTML error pages on 404/5xx, which crashes res.json()
    const text = await res.text();
    if (!res.ok) {
      console.warn(`[hire-alert-scanner] Firecrawl HTTP ${res.status}: ${text.slice(0, 120)}`);
      return [];
    }
    if (!text || !text.trim().startsWith("{")) {
      console.warn(`[hire-alert-scanner] Firecrawl non-JSON response: ${text.slice(0, 120)}`);
      return [];
    }
    const data = JSON.parse(text);
    return data?.data || [];
  } catch (e) {
    console.error("[hire-alert-scanner] Firecrawl error:", e instanceof Error ? e.message : e);
    return [];
  }
}

interface RawCandidate {
  full_name: string;
  phone?: string;
  email?: string;
  license_type?: string;
  license_number?: string;
  license_expiry?: string;
  city?: string;
  zip?: string;
  source: "miosha" | "firecrawl" | "registry";
  raw_data?: Record<string, unknown>;
}

interface ScoredCandidate extends RawCandidate {
  availability_score: number;
  score_reason: string;
  linkedin_url?: string;
  facebook_url?: string;
  current_employer?: string;
  current_title?: string;
  years_experience?: number;
  qualifications_summary?: string;
  hiring_recommendation?: string;
  enrichment_status?: string;
  // NPI fields
  npi_number?: string;
  npi_business_phone?: string;
  npi_taxonomy?: string;
  npi_practice_address?: string;
  // PDL fields
  pdl_mobile_phone?: string;
  pdl_personal_email?: string;
  // enrichment intelligence fields
  flight_risk?: string;
  flight_risk_proof?: string;
  corroboration_score?: number;
  employer_headcount_delta?: number;
  job_stability_index?: number;
  personal_email_primary?: boolean;
  availability_signal?: string;
}

// ===== NPI REGISTRY API =====
// Free federal API, no auth needed. Only for healthcare candidates.
async function enrichViaNPI(candidate: RawCandidate): Promise<Record<string, unknown>> {
  const nameParts = candidate.full_name.trim().split(/\s+/);
  if (nameParts.length < 2) return {};

  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];

  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&state=MI&enumeration_type=NPI-1&limit=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[hire-alert-scanner] NPI HTTP ${res.status} for ${candidate.full_name}`);
      return {};
    }
    const data = await res.json();
    const results = data?.results;
    if (!results?.length) return {};

    // Take best match (first result)
    const r = results[0];
    const taxonomy = r.taxonomies?.find((t: any) => t.primary) || r.taxonomies?.[0];
    const address = r.addresses?.find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0];

    const npiData: Record<string, unknown> = {
      npi_number: r.number?.toString() || null,
      npi_business_phone: address?.telephone_number || null,
      npi_taxonomy: taxonomy ? `${taxonomy.desc || ""} (${taxonomy.code || ""})` : null,
      npi_practice_address: address ? `${address.address_1 || ""}${address.address_2 ? " " + address.address_2 : ""}, ${address.city || ""}, ${address.state || ""} ${address.postal_code || ""}` : null,
    };

    console.log(`[hire-alert-scanner] NPI enriched: ${candidate.full_name} → NPI#${npiData.npi_number} phone=${!!npiData.npi_business_phone} taxonomy=${!!npiData.npi_taxonomy}`);
    return npiData;
  } catch (e) {
    console.warn(`[hire-alert-scanner] NPI error for ${candidate.full_name}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

// ===== PEOPLE DATA LABS (PDL) ENRICHMENT =====
// Resolves mobile phone and personal email from name + location + linkedin
async function enrichWithPDL(candidate: ScoredCandidate): Promise<Record<string, unknown>> {
  if (!PDL_API_KEY) return {};

  const nameParts = candidate.full_name.trim().split(/\s+/);
  if (nameParts.length < 2) return {};

  const params: Record<string, string> = {
    first_name: nameParts[0],
    last_name: nameParts[nameParts.length - 1],
  };
  if (candidate.city) params.location = `${candidate.city}, Michigan`;
  if (candidate.linkedin_url) params.profile = candidate.linkedin_url;

  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${qs}`, {
      headers: { "X-Api-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 402) {
      throw new Error(`PDL quota exceeded (402) for ${candidate.full_name}`);
    }
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[hire-alert-scanner] PDL HTTP ${res.status} for ${candidate.full_name}: ${errText.slice(0, 200)}`);
      return {};
    }

    const data = await res.json();
    if (!data || data.status === 404) return {};

    const jobCount = data.experience?.length || 0;
    const yearsExp = data.inferred_years_experience || 0;
    const empCount = data.job_company_size ? (
      data.job_company_size === "1-10" ? 5 :
      data.job_company_size === "11-50" ? 30 :
      data.job_company_size === "51-200" ? 125 :
      data.job_company_size === "201-500" ? 350 :
      data.job_company_size === "501-1000" ? 750 : 1500
    ) : null;
    const pdlData: Record<string, unknown> = {
      pdl_mobile_phone: data.mobile_phone || null,
      pdl_personal_email: data.personal_emails?.[0] || null,
      pdl_work_email: data.work_email || null,
      pdl_job_title: data.job_title || null,
      pdl_company: data.job_company_name || null,
      pdl_linkedin_url: data.linkedin_url || null,
      pdl_company_employee_count: empCount,
      pdl_job_count: jobCount,
      pdl_job_stability_index: jobCount > 0 && yearsExp > 0 ? Math.round((yearsExp / jobCount) * 100) / 100 : null,
    };

    console.log(`[hire-alert-scanner] PDL enriched: ${candidate.full_name} → mobile=${!!pdlData.pdl_mobile_phone} email=${!!pdlData.pdl_personal_email} company=${!!pdlData.pdl_company}`);
    return pdlData;
  } catch (e) {
    console.warn(`[hire-alert-scanner] PDL error for ${candidate.full_name}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

// Source 1: MIOSHA Public License Database — delegates to miosha-license-scraper
async function scanMIOSHA(): Promise<RawCandidate[]> {
  try {
    const scraperUrl = `${SUPABASE_URL}/functions/v1/miosha-license-scraper`;
    const res = await fetch(scraperUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(130_000), // 130s — scraper budget 120s, hard timeout 150s
    });
    if (!res.ok) {
      console.warn(`[hire-alert-scanner] miosha-license-scraper returned ${res.status}`);
    } else {
      const result = await res.json();
      console.log(`[hire-alert-scanner] miosha-scraper: new=${result.new} updated=${result.updated}`);
    }
  } catch (e) {
    console.warn("[hire-alert-scanner] miosha-scraper call failed:", e);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  // BUG FIX (Phase 0): miosha-license-scraper writes source as npi, building_permits, michigan_open_data,
  // sonar, lara_socrata, lara_accela, lara_val, lara_bcc, dol, etc. — NEVER "miosha".
  // Old filter `.eq("source","miosha")` returned zero candidates every run.
  // New filter: exclude business-directory sources, include all PERSON candidates.
  const BUSINESS_SOURCES = [
    // original directory sources
    "yelp", "phcc", "building_permits", "thumbtack", "google_places", "yelp_business",
    // S22/S23/S25 company routes
    "lara_contractor_co", "osha_establishment", "michigan_sos_co",
    // S31/S34 company-only
    "google_places_sweep", "bbb_directory",
    // S32/S33/S35/S40/S41 mixed — company branch
    "angi_co", "manta_co", "alignable_co", "houzz_co", "porch_co",
  ];
  const { data } = await sb
    .from("hire_alert_candidates")
    .select("full_name, name, phone, email, license_type, license_number, license_expiry, city, zip, source, raw_data, linkedin_url, facebook_url, current_employer, current_title, years_experience, qualifications_summary, hiring_recommendation, social_profiles, enrichment_status")
    .not("source", "in", `(${BUSINESS_SOURCES.join(",")})`)
    .neq("is_company_name", true)
    .gte("first_seen_at", since);

  return (data || []).map((r) => ({
    full_name: r.full_name || r.name,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    license_type: r.license_type ?? undefined,
    license_number: r.license_number ?? undefined,
    license_expiry: r.license_expiry ?? undefined,
    city: r.city ?? undefined,
    zip: r.zip ?? undefined,
    source: (r.source || "miosha") as any,
    raw_data: r.raw_data as Record<string, unknown> | undefined,
  }));
}

// Source 2: Job board search via OpenRouter (perplexity/sonar-pro for live web search)
async function scanJobBoards(): Promise<RawCandidate[]> {
  if (OPENROUTER_API_KEY) {
    const results = await scanJobBoardsViaOpenRouter(OPENROUTER_API_KEY);
    if (results.length > 0) return results;
  }
  return scanJobBoardsFallback();
}

// Company name signals — used to filter out job postings stored as fake candidates
const COMPANY_NAME_SIGNALS = [
  // Legal entity markers
  "inc", "llc", "corp", "co.", "company", "ltd", "limited", "dba", "d/b/a", "holdings",
  // Business type words
  "contractors", "services", "solutions", "group", "enterprises", "associates",
  "systems", "industries", "construction", "plumbing", "hvac", "mechanical",
  "electric", "electrical", "heating", "cooling", "realty",
  // Generic biz suffixes
  "pros", "brothers", "bros", "and sons", "& sons", "& son", "and son",
  // Common garbage business names observed in DB
  "pipey", "bargain", "comfort zone", "rocket", "reliable", "best", "premier",
  "advantage", "quality", "professional", "specialist", "expert", "master",
  // Geographic/trade junk that slipped through (from real DB cleanup 2026-04-19)
  "detroit", "metro", "michigan", "drewski", "drain", "handyman", "rooter",
  "sewer", "remodel", "remodeling", "renovation", "repair", "maintenance",
  // Trailing filler
  "and", "or", // name ending in "and" / "or" = company abbreviation
];

function isPersonNameJobBoard(name: string): boolean {
  const lower = name.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (COMPANY_NAME_SIGNALS.some((s) => lower.includes(s))) return false;
  if (name === name.toUpperCase() && name.length > 8) return false;
  return true;
}

async function scanJobBoardsViaOpenRouter(apiKey: string): Promise<RawCandidate[]> {
  // Search for INDIVIDUAL PEOPLE seeking trade work — not job postings by companies
  // DATA SOURCE: Public job board search via Sonar (Perplexity).
  // Queries target public resume listings and trade association directories only.
  // LinkedIn and Facebook are excluded — their ToS prohibits automated data collection.
  const searches = [
    `Find public job board listings, Indeed public resumes, or trade association member pages for individual licensed boiler operators, stationary engineers, HVAC technicians, plumbers, pipefitters, or electricians in Metro Detroit Michigan who are actively job seeking or open to work. Search Indeed public resumes, ZipRecruiter profiles, UA Local 636 directory, IBEW Local 58. Find specific individuals with their names, trade, and city. Do NOT return company job listings — only people seeking work.`,
    `Find public resumes or professional association listings for individual licensed HVAC technicians, plumbers, or electricians in Wayne County, Oakland County, Macomb County, Washtenaw County Michigan who are open to work or recently posted resumes. Search Indeed public resumes, ZipRecruiter profiles, trade association directories. Return individual person names only, not companies.`,
    `Find NurseFly profiles, Vivian Health listings, or Indeed public resumes for individual Certified Nursing Assistants (CNA), Licensed Practical Nurses (LPN), or Registered Nurses (RN) in Metro Detroit Michigan who are currently job seeking or open to work. Include any certification numbers visible on profiles. Individual people only.`,
  ];

  const allResults: RawCandidate[] = [];
  const seen = new Set<string>();
  // HALLUCINATION GUARD: track name → trades. If same name appears in 2+ trades, Sonar is hallucinating.
  const nameToTrades = new Map<string, Set<string>>();

  for (const query of searches) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          messages: [
            {
              role: "system",
              content: `You are a hiring intelligence researcher. Find INDIVIDUAL PEOPLE who are open to work — NOT companies hiring.

CRITICAL: Search LinkedIn "open to work" profiles, Indeed public resumes, trade union directories (UA Local 636, IBEW Local 58), and professional association listings for real people who are:
- Publicly visible as "open to work" on LinkedIn
- Have posted public resumes on Indeed, ZipRecruiter, or CareerBuilder
- Listed in trade union member directories or professional association pages

Return ONLY valid JSON array. Each object must be a real person with a verifiable source URL:
{ "name": "First Last", "trade": "specific trade title", "city": "Michigan city", "source_url": "REQUIRED real URL" }

REJECT any result where name looks like a company (LLC, Inc, Corp, Contractors, Services, etc).
REJECT any result without a real source_url — do not invent URLs.
REJECT single-word names. Require at least First Last.
If you genuinely cannot find individual job seekers, return an empty array [].
Max 15 results. No markdown, no explanation.`,
            },
            { role: "user", content: query },
          ],
          max_tokens: 2000,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[hire-alert-scanner] OpenRouter HTTP ${res.status}: ${errText.slice(0, 200)}`);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      
      // Log raw response for debugging
      console.log(`[hire-alert-scanner] OpenRouter raw (${text.length} chars): ${text.slice(0, 300)}`);

      // Try JSON extraction
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        // If Sonar returned prose, try to extract names with Gemini
        if (text.length > 50 && LOVABLE_API_KEY) {
          console.log(`[hire-alert-scanner] No JSON from Sonar, trying Gemini extraction`);
          const extracted = await extractJobSeekersFromProse(text);
          for (const item of extracted) {
            // Guard 1: require multi-word name
            if (item.name.trim().split(/\s+/).length < 2) {
              console.log(`[hire-alert-scanner] Rejected single-word name "${item.name}"`);
              continue;
            }
            const nameLower = item.name.toLowerCase();
            const tradeLower = (item.trade || "").toLowerCase();
            if (!nameToTrades.has(nameLower)) nameToTrades.set(nameLower, new Set());
            nameToTrades.get(nameLower)!.add(tradeLower);
            const key = `${nameLower}-${tradeLower}`;
            if (seen.has(key)) continue;
            seen.add(key);
            allResults.push({
              full_name: item.name,
              license_type: item.trade,
              city: item.city || "Metro Detroit",
              source: "firecrawl" as const,
              raw_data: { openrouter_search: true, gemini_extracted: true },
            });
          }
        }
        continue;
      }

      let parsed: Array<{ name: string; trade: string; city: string; source_url?: string }>;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.warn(`[hire-alert-scanner] JSON parse failed`);
        continue;
      }

      if (!Array.isArray(parsed)) continue;

      for (const item of parsed) {
        if (!item.name || !item.trade) continue;
        if (!isPersonNameJobBoard(item.name)) {
          console.log(`[hire-alert-scanner] Job board: rejected company name "${item.name}"`);
          continue;
        }
        // Guard 1: require multi-word name
        if (item.name.trim().split(/\s+/).length < 2) {
          console.log(`[hire-alert-scanner] Rejected single-word name "${item.name}"`);
          continue;
        }
        // Guard 3: require real source_url
        if (!item.source_url || !/^https?:\/\//i.test(item.source_url)) {
          console.log(`[hire-alert-scanner] Rejected "${item.name}" — missing/invalid source_url`);
          continue;
        }
        const nameLower = item.name.toLowerCase();
        const tradeLower = item.trade.toLowerCase();
        if (!nameToTrades.has(nameLower)) nameToTrades.set(nameLower, new Set());
        nameToTrades.get(nameLower)!.add(tradeLower);

        const key = `${nameLower}-${tradeLower}`;
        if (seen.has(key)) continue;
        seen.add(key);

        allResults.push({
          full_name: item.name,
          license_type: item.trade,
          city: item.city || "Metro Detroit",
          source: "firecrawl" as const,
          raw_data: { openrouter_search: true, source_url: item.source_url || null },
        });
      }
    } catch (e) {
      console.warn(`[hire-alert-scanner] OpenRouter search error:`, e instanceof Error ? e.message : String(e));
    }
  }

  // Guard 2 (final): blacklist any name that appeared in 2+ different trades — that's hallucination
  const blacklisted = new Set<string>();
  for (const [name, trades] of nameToTrades) {
    if (trades.size >= 2) {
      blacklisted.add(name);
      console.log(`[hire-alert-scanner] BLACKLIST "${name}" — appeared in ${trades.size} trades: ${[...trades].join(", ")}`);
    }
  }
  const filtered = allResults.filter((c) => !blacklisted.has(c.full_name.toLowerCase()));

  console.log(`[hire-alert-scanner] OpenRouter: ${filtered.length} validated, ${allResults.length - filtered.length} hallucinations rejected`);
  return filtered;
}

// Extract job seeker names from Sonar prose via Gemini
async function extractJobSeekersFromProse(prose: string): Promise<Array<{ name: string; trade: string; city: string }>> {
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: `Extract individual people's names from this text about tradespeople seeking work in Michigan. Return ONLY a JSON array: [{"name":"First Last","trade":"trade type","city":"City"}]. Only include real individual people, not companies. No markdown.`,
          },
          { role: "user", content: prose },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.filter((p: { name: string }) => p.name && isPersonNameJobBoard(p.name)) : [];
  } catch {
    return [];
  }
}

// OSHA serious injury/illness reports — company had incident = worker left or is injured = they're hiring
// Source: Sonar web search (data.dol.gov switched to React SPA — no queryable JSON endpoint)
async function scanOSHAIncidents(): Promise<RawCandidate[]> {
  if (!LOVABLE_API_KEY) return [];
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a public records researcher. Return ONLY valid JSON array, no prose, no markdown fences." },
          { role: "user", content: `Search for OSHA severe injury reports or workplace safety incidents in Michigan (Metro Detroit area: Detroit, Dearborn, Warren, Livonia, Sterling Heights, Troy, Pontiac, Southfield) in the last 30 days. Focus on construction, HVAC, electrical, plumbing, manufacturing, boiler, healthcare companies. Sources: osha.gov severe injury reports, Michigan MIOSHA news, local news reports.

Return JSON array: [{"company_name":"string","city":"string","incident_type":"string","naics_description":"string","incident_date":"YYYY-MM-DD","source_url":"string"}]

Each incident = company had a worker seriously injured = they need a replacement hire = TechAlert prospect. Return [] if nothing found. Maximum 15 results.` },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((rec: any) => rec.company_name?.length > 2)
      .map((rec: any) => ({
        full_name: rec.company_name,
        city: rec.city || undefined,
        zip: undefined,
        source: "firecrawl" as const,
        license_type: "osha_incident_employer",
        raw_data: {
          incident_type: rec.incident_type || "Serious injury",
          naics_title: rec.naics_description,
          event_date: rec.incident_date,
          source_url: rec.source_url,
          is_employer_lead: true,
        },
      }));
  } catch (e) {
    console.warn("[scanOSHAIncidents]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// SBA loan approvals — Metro Detroit companies that just got capital are expanding = need to hire
// Source: USASpending.gov API (verified working — SBA CKAN datastore is not active/queryable)
async function scanSBALoanApprovals(): Promise<RawCandidate[]> {
  try {
    const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const body = {
      subawards: false, page: 1, limit: 50, sort: "Issued Date", order: "desc",
      fields: ["Award ID", "Recipient Name", "Loan Value", "Issued Date", "recipient_location_city_name", "recipient_location_state_code", "recipient_location_address_line1", "naics_code", "naics_description"],
      filters: {
        award_type_codes: ["08"], // SBA 7(a) guaranteed loans
        place_of_performance_locations: [{ country: "USA", state: "MI" }],
        time_period: [{ start_date: cutoff, end_date: today }],
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
    const records: any[] = j?.results || [];
    const tradeNAICS = ["238", "237", "236", "622", "623", "811", "484", "441", "423", "333", "332"];
    const metro = /detroit|dearborn|warren|livonia|sterling|troy|pontiac|southfield|ann arbor|canton|westland|farmington|grosse pointe/i;
    const miTrade = records.filter((rec: any) =>
      metro.test(rec.recipient_location_city_name || "") &&
      tradeNAICS.some((code) => String(rec.naics_code || "").startsWith(code)) &&
      Number(rec["Loan Value"] || 0) >= 50_000
    );
    return miTrade.slice(0, 20).map((rec: any) => ({
      full_name: rec["Recipient Name"] || "Unknown company",
      city: rec.recipient_location_city_name || undefined,
      zip: undefined,
      source: "firecrawl" as const,
      license_type: "sba_expansion_employer",
      raw_data: {
        sba_amount: rec["Loan Value"],
        naics: rec.naics_code,
        naics_title: rec.naics_description,
        approval_date: rec["Issued Date"],
        is_employer_lead: true,
      },
    }));
  } catch (e) {
    console.warn("[scanSBALoanApprovals]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

// USDOL registered apprenticeship completions — fresh-licensed tradespeople entering the market
async function scanApprenticeshipCompletions(): Promise<RawCandidate[]> {
  // RAPIDS API requires registration; DOL website is a React SPA with no queryable endpoint.
  // Using Sonar/Gemini to surface recent MI apprenticeship completions from public announcements.
  try {
    if (!LOVABLE_API_KEY) return [];
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a public records researcher. Return ONLY valid JSON array, no prose, no markdown." },
          { role: "user", content: `Search for recent (last 60 days) registered apprenticeship program completions or graduations in Michigan for trades: HVAC, boiler operator, electrician, plumber, pipefitter, welder. Sources: DOL RAPIDS database, union hall announcements, community college press releases. Return JSON: [{"full_name":"string","trade":"string","city":"string","completion_date":"YYYY-MM-DD","source_url":"string"}]. Return [] if nothing found.` },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || "[]";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) => ({
      full_name: item.full_name || "",
      city: item.city || undefined,
      source: "firecrawl" as const,
      license_type: item.trade || "apprenticeship_completion",
      raw_data: {
        completion_date: item.completion_date,
        source_url: item.source_url,
        is_new_entrant: true,
      },
    })).filter((c: RawCandidate) => c.full_name);
  } catch (e) {
    console.warn("[scanApprenticeshipCompletions]", e instanceof Error ? e.message : String(e));
    return [];
  }
}

async function scanJobBoardsFallback(): Promise<RawCandidate[]> {
  const queries = [
    '"boiler operator" "looking for work" OR "seeking position" Michigan',
    '"HVAC technician" "available" OR "open to opportunities" Detroit Michigan',
    '"pipefitter" OR "steamfitter" "UA Local 636" "available" Michigan',
  ];

  const allResults: RawCandidate[] = [];
  for (const query of queries) {
    const results = await firecrawlSearch(query);
    if (!results.length) continue;
    const context = results.slice(0, 3).map((r) => `Title: ${r.title}\nContent: ${r.markdown?.slice(0, 300)}`).join("\n---\n");
    const candidates = await generateJSON<RawCandidate[]>(
      `Extract tradespeople actively seeking work from this content. Return JSON array with: full_name, email, phone, license_type, city (Michigan), source="firecrawl". Return [] if none found.\n\n${context}`,
      [], 600
    );
    allResults.push(...(candidates || []).map((c) => ({ ...c, source: "firecrawl" as const })));
  }
  return allResults;
}

// ===== SONAR OSINT ENRICHMENT ENGINE =====
// Uses perplexity/sonar-pro with boolean search operators for LinkedIn, Facebook, Indeed
// NEVER reveals sources to clients — proprietary intelligence method

function extractJSON(text: string): Record<string, unknown> | null {
  // Strip markdown code fences before parsing
  const cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function enrichViaSonar(candidate: RawCandidate): Promise<Record<string, unknown>> {
  if (!OPENROUTER_API_KEY) return {};

  const tradeLabel = candidate.license_type || "tradesperson";
  const locationLabel = candidate.city ? `${candidate.city}, Michigan` : "Michigan";

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a professional research assistant. Return ONLY valid JSON, no markdown, no explanation, no commentary.",
          },
          {
            role: "user",
            content: `Search the web using these boolean queries to find contact and professional information for "${candidate.full_name}", a ${tradeLabel} in ${locationLabel}:

1. site:indeed.com/r/ "${candidate.full_name}" "${candidate.city || "Michigan"}"
2. site:ziprecruiter.com/candidate/ "${candidate.full_name}"
3. "${candidate.full_name}" "${candidate.city || "Michigan"}" resume OR "open to work"

From the search results, extract the following and return as a JSON object:
{
  "profile_url": "full public profile URL from a job board or null",
  "email": "any public email found or null",
  "phone": "any public phone found or null",
  "current_employer": "company name or null",
  "current_title": "job title or null",
  "years_experience": number or null,
  "last_job_board_seen": "ISO date string if resume/profile was recently updated on Indeed/ZipRecruiter (within 90 days), else null",
  "job_board_active": true or false
}

Only include data you actually find. Do not fabricate any information.`,
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[hire-alert-scanner] Sonar enrichment HTTP ${res.status} for ${candidate.full_name}`);
      return {};
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(text);
    if (!parsed) {
      console.warn(`[hire-alert-scanner] Sonar JSON parse failed for ${candidate.full_name}`);
      return {};
    }

    console.log(`[hire-alert-scanner] Sonar enriched: ${candidate.full_name} → linkedin=${!!parsed.linkedin_url} fb=${!!parsed.facebook_url} phone=${!!parsed.phone} email=${!!parsed.email}`);
    return parsed;
  } catch (e) {
    console.warn(`[hire-alert-scanner] Sonar enrichment error for ${candidate.full_name}:`, e instanceof Error ? e.message : String(e));
    return {};
  }
}

// AI Synthesis via Lovable AI Gateway (free) — generates qualifications + recommendation
// NEVER mentions AI, algorithms, data sources, or methodology
async function synthesizeViaAI(
  candidate: ScoredCandidate,
  sonarData: Record<string, unknown>,
  npiData: Record<string, unknown>,
  pdlData: Record<string, unknown>
): Promise<{ qualifications_summary: string; hiring_recommendation: string }> {
  if (!LOVABLE_API_KEY) return { qualifications_summary: "", hiring_recommendation: "" };

  const prompt = `You are a B2B market intelligence analyst writing a professional labor market brief. Based on observed public license activity and open-source digital footprint data, write two sections:

1. MARKET EVENT SUMMARY (2-3 sentences): The observed public licensing activity, trade category, location, and professional background signals detected.
2. MARKET SIGNAL NOTES (2-3 sentences): The strength and timing of market availability signals, and any urgency factors detected in public data.

CANDIDATE:
- Name: ${candidate.full_name}
- Trade/License: ${candidate.license_type || "Unknown"}
- License Number: ${candidate.license_number || "Not found"}
- License Expiry: ${candidate.license_expiry || "Unknown"}
- Location: ${candidate.city || "Michigan"}

RESEARCH FINDINGS:
- Employer: ${sonarData.current_employer || pdlData.pdl_company || "Not found"}
- Title: ${sonarData.current_title || pdlData.pdl_job_title || "Not found"}
- Experience: ${sonarData.years_experience || "Unknown"} years
- LinkedIn: ${sonarData.linkedin_url || pdlData.pdl_linkedin_url ? "Found" : "Not found"}
- Phone: ${sonarData.phone || pdlData.pdl_mobile_phone || candidate.phone ? "Found" : "Not found"}
- Email: ${sonarData.email || pdlData.pdl_personal_email || candidate.email ? "Found" : "Not found"}
${npiData.npi_number ? `- NPI Number: ${npiData.npi_number} (verified healthcare professional)` : ""}
${npiData.npi_taxonomy ? `- Specialty: ${npiData.npi_taxonomy}` : ""}

CRITICAL RULES:
- This is B2B market intelligence, NOT a consumer report or background check.
- Do NOT use language like "recommend hiring," "suitable candidate," "background," or "employment suitability."
- DO use language like "license event observed," "public activity detected," "market signal," "availability window."
- Do NOT mention AI, algorithms, databases, data sources, web scraping, or any methodology.
- Be specific and grounded in the data provided.

Return JSON: { "qualifications_summary": "...", "hiring_recommendation": "..." }`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return { qualifications_summary: "", hiring_recommendation: "" };

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "";
    const parsed = extractJSON(text);
    if (!parsed) return { qualifications_summary: "", hiring_recommendation: "" };

    return {
      qualifications_summary: (parsed.qualifications_summary as string) || "",
      hiring_recommendation: (parsed.hiring_recommendation as string) || "",
    };
  } catch {
    return { qualifications_summary: "", hiring_recommendation: "" };
  }
}

// Inline company-name detector — mirrors the DB `is_company_name` heuristic.
// Used to gate scoring + alerts so junk like "A1 Bargain", "Mr Pipey", "Plumb Pros" never
// reach the hot tier even if their DB row wasn't flagged at insert time.
const _COMPANY_TOKENS = /\b(inc|llc|corp|co\.|company|services?|solutions|group|enterprises|systems|industries|construction|plumbing|hvac|mechanical|electric(al)?|heating|cooling|dba|d\/b\/a|holdings|realty|pros|bargain|and son|& son|and sons|& sons)\b/i;
function looksLikeCompany(name: string | undefined | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 4) return true;
  if (_COMPANY_TOKENS.test(trimmed)) return true;
  // "Mr Pipey", "Mrs Smith Co" etc. — single-word + honorific
  if (/^(mr|mrs|ms|dr)\.?\s+\S+$/i.test(trimmed) && trimmed.split(/\s+/).length === 2) return true;
  // No alpha at all
  if (!/[A-Za-z]{2}/.test(trimmed)) return true;
  return false;
}


// ── Employer growth probe via Sonar (item 8) ─────────────────────────────────
// Returns: 'high_flight_risk' | 'hard_to_poach' | 'neutral'
async function probeEmployerGrowth(employer: string): Promise<{ risk: string; proof: string }> {
  if (!OPENROUTER_API_KEY || !employer) return { risk: "neutral", proof: "" };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{
          role: "system",
          content: "You are a research assistant. Return ONLY valid JSON, no markdown.",
        }, {
          role: "user",
          content: `Search the web for recent job postings from the company "${employer}":
site:indeed.com/cmp "${employer}" hiring 2025 OR "${employer}" job openings Michigan

Count the number of active job postings you find. Also check if this company shows signs of layoffs or downsizing.

Return JSON: { "job_posting_count": number, "layoff_signal": true or false, "growth_signal": true or false }

If you cannot find any information, return: { "job_posting_count": 0, "layoff_signal": false, "growth_signal": false }`,
        }],
        max_tokens: 150,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { risk: "neutral", proof: "" };
    const data = await res.json();
    const parsed = extractJSON(data?.choices?.[0]?.message?.content || "");
    if (!parsed) return { risk: "neutral", proof: "" };
    const count = Number(parsed.job_posting_count || 0);
    if (parsed.layoff_signal) return { risk: "high_flight_risk", proof: `🎯 HIGH FLIGHT RISK — Layoff or downsizing signals detected at ${employer} in public data.` };
    if (count === 0) return { risk: "high_flight_risk", proof: `🎯 HIGH FLIGHT RISK — No recent growth signals detected at ${employer} in last 60 days. Candidate is statistically more receptive to outreach.` };
    if (count >= 10) return { risk: "hard_to_poach", proof: `🛡️ HARD TO POACH — ${employer} shows ~${count} open roles tracked. Candidate is likely comfortable and well-compensated.` };
    if (count >= 4) return { risk: "neutral", proof: `↔️ NEUTRAL — ${employer} shows ${count} recent activity signal${count !== 1 ? "s" : ""}. Approach with standard outreach.` };
    return { risk: "high_flight_risk", proof: `🎯 HIGH FLIGHT RISK — No recent growth signals detected at ${employer} in last 60 days. Candidate is statistically more receptive to outreach.` };
  } catch {
    return { risk: "neutral", proof: "" };
  }
}

// ── OSHA violation probe via Sonar (item 6) ───────────────────────────────────
async function probeOSHAViolations(employer: string): Promise<string> {
  if (!OPENROUTER_API_KEY || !employer) return "";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{
          role: "system",
          content: "Return ONLY valid JSON, no markdown.",
        }, {
          role: "user",
          content: `Search OSHA citation records for the company "${employer}": site:osha.gov "${employer}" violation OR citation

Return JSON: { "violations_found": true or false, "summary": "one sentence description if found, else empty string" }`,
        }],
        max_tokens: 100,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const parsed = extractJSON(data?.choices?.[0]?.message?.content || "");
    if (!parsed?.violations_found) return "";
    return `⚠️ OSHA SIGNAL — ${parsed.summary || `Active citations detected for ${employer} in public OSHA records.`} Historically correlates with elevated turnover.`;
  } catch {
    return "";
  }
}

// ── Hunter email verify (item 11) ────────────────────────────────────────────
async function verifyEmailViaHunter(email: string): Promise<string> {
  if (!HUNTER_API_KEY || !email) return "";
  try {
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.data?.result || "";
  } catch {
    return "";
  }
}

// ── Snov.io domain HR contact search (item 12) ───────────────────────────────
async function findHRContactViaSnoviо(domain: string): Promise<string | null> {
  if (!SNOV_USER_ID || !SNOV_API_KEY || !domain) return null;
  try {
    // Get access token
    const tokenRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_USER_ID}&client_secret=${SNOV_API_KEY}`,
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenRes.ok) return null;
    const { access_token } = await tokenRes.json();
    if (!access_token) return null;

    const emailsRes = await fetch(`https://api.snov.io/v2/domain-emails-with-info?domain=${encodeURIComponent(domain)}&type=personal&limit=5`, {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!emailsRes.ok) return null;
    const emailData = await emailsRes.json();
    const hrContact = (emailData?.emails || []).find((e: any) =>
      /hr|human.resource|people|talent|recruit/i.test(e.position || "")
    );
    if (hrContact) return `${hrContact.firstName || ""} ${hrContact.lastName || ""} <${hrContact.email}>`.trim();
    return null;
  } catch {
    return null;
  }
}


// ── Apollo org enrich on current_employer (item 15) ──────────────────────────
async function apolloOrgEnrich(companyName: string): Promise<{ employee_count: number | null; industry: string | null }> {
  const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
  if (!APOLLO_API_KEY || !companyName) return { employee_count: null, industry: null };
  try {
    const res = await fetch(`https://api.apollo.io/api/v1/organizations/enrich?organization_name=${encodeURIComponent(companyName)}`, {
      headers: { "X-Api-Key": APOLLO_API_KEY, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { employee_count: null, industry: null };
    const data = await res.json();
    const org = data?.organization;
    return {
      employee_count: org?.estimated_num_employees ?? null,
      industry: org?.industry ?? null,
    };
  } catch {
    return { employee_count: null, industry: null };
  }
}

// ── HIBP paste check for password_compromised (item 16) ──────────────────────
async function checkPasswordCompromised(email: string): Promise<boolean> {
  const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";
  if (!HIBP_API_KEY || !email) return false;
  try {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/pasteaccount/${encodeURIComponent(email)}`, {
      headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": "TechAlert-Intelligence/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return false; // not found = clean
    return res.ok; // 200 = compromised
  } catch {
    return false;
  }
}

// Score candidate availability via AI with real signals
async function scoreCandidate(candidate: RawCandidate): Promise<{ score: number; reason: string }> {
  // 🛡️ Company-name gate: never score business names above 4. Prevents "A1 Bargain LLC = 10/10" leak.
  if (looksLikeCompany(candidate.full_name)) {
    return { score: 1, reason: "company-name-blocked" };
  }
  const hasPhone = !!candidate.phone;
  const hasEmail = !!candidate.email;
  const hasLicenseNumber = !!candidate.license_number;
  const isFromJobBoard = candidate.source === "firecrawl";

  let licenseRecent = false;
  let licenseExpiringSoon = false;
  let daysUntilExpiry = -1;
  if (candidate.license_expiry) {
    const expiry = new Date(candidate.license_expiry);
    const monthsUntilExpiry = (expiry.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000);
    licenseRecent = monthsUntilExpiry > 20;
    daysUntilExpiry = Math.round((expiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    // LICENSE EXPIRY BOOST: 30-60 days = high mobility signal
    if (daysUntilExpiry >= 30 && daysUntilExpiry <= 60) {
      licenseExpiringSoon = true;
    }
  }

  // PERMIT VELOCITY: check if candidate appears in 3+ cities from permit data
  let permitVelocityHigh = false;
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: permitEntries } = await sb
      .from("hire_alert_candidates")
      .select("city")
      .eq("full_name", candidate.full_name)
      .gte("last_seen_at", thirtyDaysAgo)
      .not("city", "is", null);
    if (permitEntries && permitEntries.length > 0) {
      const uniqueCities = new Set(permitEntries.map((e: any) => (e.city || "").toLowerCase().trim()).filter(Boolean));
      if (uniqueCities.size >= 3) permitVelocityHigh = true;
    }
  } catch { /* non-critical */ }

  const result = await generateJSON<{ score: number; reason: string }>(
    `Score this tradesperson's immediate hire availability from 1-10. Be precise — avoid defaulting to 5 or 6.

Candidate:
Name: ${candidate.full_name}
Trade/License: ${candidate.license_type || "unknown"}
City: ${candidate.city || "unknown"}
License Number: ${hasLicenseNumber ? candidate.license_number : "none"}${licenseRecent ? " (RECENTLY ISSUED — new to market)" : ""}
License Expiry: ${candidate.license_expiry || "unknown"}${licenseExpiringSoon ? ` (EXPIRES IN ${daysUntilExpiry} DAYS — high mobility signal)` : ""}
Has Phone Number: ${hasPhone ? "YES" : "no"}
Has Email: ${hasEmail ? "YES" : "no"}
Permit Velocity: ${permitVelocityHigh ? "HIGH — active across 3+ municipalities (likely independent contractor)" : "normal"}

Scoring rules (apply ALL that match, then sum):
- Base: 4 points for having a verifiable trade title
- +3 if appeared on a job board (actively seeking)
- +2 if license number exists AND recently issued (new to market)
- +2 if license expires within 30-60 days (employer likely hasn't renewed — candidate may be available)
- +1 if permit data shows activity across 3+ municipalities (independent contractor signal)
- +1 if has phone number (immediately contactable)
- +1 if has email address
- +1 if city is Metro Detroit area
- -2 if no license number AND source is MIOSHA (parse error — likely bad data)
- Cap at 10, floor at 1

Return JSON: { "score": number, "reason": "one sentence citing the top 1-2 signals" }`,
    null as any,
    400
  );

  if (!result || typeof result.score !== "number") {
    let score = 4;
    if (isFromJobBoard) score += 3;
    if (hasLicenseNumber && licenseRecent) score += 2;
    if (licenseExpiringSoon) score += 2;
    if (permitVelocityHigh) score += 1;
    if (hasPhone) score += 1;
    if (hasEmail) score += 1;
    score = Math.min(10, Math.max(1, score));
    const reasons: string[] = [];
    if (licenseExpiringSoon) reasons.push(`license expires in ${daysUntilExpiry}d`);
    if (permitVelocityHigh) reasons.push("high permit velocity");
    reasons.push(hasPhone ? "contactable" : "contact info pending");
    return { score, reason: `Verified trade professional, ${reasons.join(", ")}, ${candidate.city || "Michigan"} area` };
  }

  return result;
}

// ===== ACTION BUTTON EMAIL TEMPLATE =====
// Every candidate card has prominent clickable buttons — no dead ends

function buildActionButtons(c: ScoredCandidate & { id?: string }, clientToken?: string): string {
  const buttons: string[] = [];
  const dashBase = "https://detroitwebagent.com/talent-radar/dashboard";

  // Deep-link action buttons (Phase 4)
  if (clientToken && c.id) {
    buttons.push(`<a href="${dashBase}?token=${clientToken}&auto=1&claim=${c.id}" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">⚡ Claim This Candidate</a>`);
    buttons.push(`<a href="${dashBase}?token=${clientToken}&highlight=${c.id}&action=draft" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✍️ Draft Outreach</a>`);
  }

  if (c.linkedin_url) {
    buttons.push(`<a href="${c.linkedin_url}" target="_blank" style="display:inline-block;background:#0a66c2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">🔗 Message on LinkedIn</a>`);
  }
  if (c.facebook_url) {
    buttons.push(`<a href="${c.facebook_url}" target="_blank" style="display:inline-block;background:#1877f2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">👤 View Facebook</a>`);
  }
  if (c.email) {
    buttons.push(`<a href="mailto:${c.email}" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">✉️ Send Email</a>`);
  }
  if (c.phone) {
    buttons.push(`<a href="tel:${c.phone}" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">📞 Call ${c.phone}</a>`);
  }
  if (c.npi_business_phone && c.npi_business_phone !== c.phone) {
    buttons.push(`<a href="tel:${c.npi_business_phone}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">📞 Business Line ${c.npi_business_phone}</a>`);
  }
  if (c.pdl_mobile_phone && c.pdl_mobile_phone !== c.phone && c.pdl_mobile_phone !== c.npi_business_phone) {
    buttons.push(`<a href="tel:${c.pdl_mobile_phone}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px 4px 4px 0;">📱 Mobile ${c.pdl_mobile_phone}</a>`);
  }
  if (c.license_number) {
    buttons.push(`<a href="https://aca-prod.accela.com/LARA/GeneralProperty/PropertyLookUp.aspx?isLicensee=Y" target="_blank" style="display:inline-block;background:#059669;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px 4px 4px 0;">📜 Verify State License</a>`);
  }

  if (!buttons.length) return "";

  return `<tr><td style="padding:12px 0 4px;">
    <table cellpadding="0" cellspacing="0"><tr><td>
      ${buttons.join("\n      ")}
    </td></tr></table>
  </td></tr>`;
}

// Send alert email to a client — premium design with action buttons
async function sendAlertEmail(
  client: { owner_email: string; company_name: string; dashboard_token?: string },
  candidates: ScoredCandidate[],
  dateStr: string
) {
  if (!RESEND_API_KEY || !client.owner_email) return;

  const hotCount = candidates.filter((c) => c.availability_score >= 7).length;

  const scoreBg = (s: number) =>
    s >= 8 ? "#dc2626" : s >= 7 ? "#e8621a" : s >= 5 ? "#f59e0b" : "#94a3b8";

  const candidateCards = candidates
    .map(
      (c) => `
    <tr><td style="padding:0 0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid ${c.availability_score >= 7 ? "#e8621a40" : "#e2e8f0"};${c.availability_score >= 7 ? "box-shadow:0 2px 8px rgba(232,98,26,0.12);" : ""}">
        <!-- Score bar -->
        <tr><td style="background:${c.availability_score >= 7 ? "linear-gradient(135deg,#0a1628,#1e293b)" : "#f8fafc"};padding:14px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <p style="margin:0;font-size:16px;font-weight:800;color:${c.availability_score >= 7 ? "#fff" : "#1e293b"};letter-spacing:-0.3px;">${c.full_name}</p>
              <p style="margin:3px 0 0;font-size:12px;color:${c.availability_score >= 7 ? "#94a3b8" : "#64748b"};">Detected ${dateStr}</p>
            </td>
            <td style="text-align:right;vertical-align:top;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background:${scoreBg(c.availability_score)};color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;font-family:-apple-system,sans-serif;letter-spacing:0.5px;">
                  ${c.availability_score >= 8 ? "🟢 High" : c.availability_score >= 5 ? "🟡 Possible" : "🔵 Monitor"}
                </td>
              </tr></table>
            </td>
          </tr></table>
        </td></tr>
        <!-- Details -->
        <tr><td style="padding:16px 18px;background:#fff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 0 8px;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="background:#00d4ff18;color:#0891b2;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${c.license_type || "Field Technician"}</td>
                  <td width="8"></td>
                  <td style="background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;">📍 ${c.city || "Metro Detroit"}</td>
                  ${c.years_experience ? `<td width="8"></td><td style="background:#10b98118;color:#059669;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">${c.years_experience}+ yrs exp</td>` : ""}
                  ${c.npi_taxonomy ? `<td width="8"></td><td style="background:#7c3aed18;color:#7c3aed;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">✅ License Verified</td>` : ""}
                </tr></table>
              </td>
            </tr>
            ${c.current_employer ? `<tr><td style="padding:4px 0;font-size:13px;color:#475569;">🏢 <strong>${c.current_employer}</strong>${c.current_title ? ` · ${c.current_title}` : ""}</td></tr>` : ""}
            ${c.license_number ? `<tr><td style="padding:4px 0;font-size:13px;color:#475569;">🪪 License: <strong>${c.license_number}</strong>${c.license_expiry ? ` · Exp: <strong>${c.license_expiry}</strong>` : ""} · <span style="color:#059669;font-weight:700;">Active</span></td></tr>` : ""}
            ${c.npi_number ? `<tr><td style="padding:4px 0;font-size:13px;color:#7c3aed;">✅ Licensed Professional${c.npi_taxonomy ? ` · ${c.npi_taxonomy}` : ""}</td></tr>` : ""}
            ${c.qualifications_summary ? `<tr><td style="padding:8px 0 4px;">
              <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;"><strong>📋 Qualifications:</strong> ${c.qualifications_summary}</p>
            </td></tr>` : ""}
            ${c.hiring_recommendation ? `<tr><td style="padding:4px 0;">
              <p style="margin:0;font-size:12px;color:#1e293b;line-height:1.6;background:#eff6ff;padding:10px 12px;border-radius:8px;border-left:3px solid #3b82f6;"><strong>💡 Recommendation:</strong> ${c.hiring_recommendation}</p>
            </td></tr>` : ""}
            <!-- ACTION BUTTONS -->
            ${buildActionButtons(c, client.dashboard_token)}
          </table>
        </td></tr>
      </table>
    </td></tr>`
    )
    .join("");

  const subjectEmoji = hotCount >= 3 ? "🔥🔥🔥" : hotCount >= 1 ? "🔥" : "📋";
  const subjectText = hotCount > 0
    ? `${subjectEmoji} ${hotCount} hot ${hotCount === 1 ? "candidate" : "candidates"} — act fast`
    : `${candidates.length} licensed ${candidates.length === 1 ? "tech" : "techs"} spotted nearby`;

  try {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      from: "TechAlert by Detroit Web Agency <matt@detroitwebagent.com>",
      to: [client.owner_email],
      bcc: ["matthewmichels4@gmail.com"],
      subject: `${subjectText} | TechAlert ${dateStr}`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
<tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0a1628 0%,#1e293b 100%);padding:32px 28px 24px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">⚡ TechAlert</p>
        <p style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;line-height:1.2;letter-spacing:-0.5px;">New Licensed Techs<br>in Your Area</p>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background:#00d4ff20;border:1px solid #00d4ff40;padding:12px 16px;border-radius:12px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:900;color:#00d4ff;line-height:1;">${candidates.length}</p>
            <p style="margin:2px 0 0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">${candidates.length === 1 ? "Candidate" : "Candidates"}</p>
          </td>
        </tr></table>
      </td>
    </tr></table>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;">${dateStr}${client.company_name ? ` · for ${client.company_name}` : ""}</p>
  </td></tr>

  <!-- URGENCY BAR (only for hot candidates) -->
  ${hotCount > 0 ? `<tr><td style="background:#e8621a;padding:12px 28px;">
    <p style="margin:0;color:#fff;font-size:13px;font-weight:700;text-align:center;">🔥 ${hotCount} high-availability ${hotCount === 1 ? "candidate" : "candidates"} detected — your competitors don't have this intel</p>
  </td></tr>` : ""}

  <!-- BODY -->
  <tr><td style="background:#fff;padding:28px;${hotCount > 0 ? "" : "border-top:1px solid #e2e8f0;"}">
    <p style="color:#1e293b;font-size:15px;line-height:1.7;margin:0 0 8px;">
      Hey${client.company_name ? ` ${client.company_name} team` : ""} —
    </p>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
      We identified new licensed professionals near you this morning. ${hotCount > 0 ? `<strong>${hotCount} high-availability ${hotCount === 1 ? "candidate" : "candidates"}</strong> — tap the buttons below to reach out before someone else does.` : "Here's what we found near you. Tap any button to take action instantly."}
    </p>

    <!-- CANDIDATE CARDS -->
    <table width="100%" cellpadding="0" cellspacing="0">
      ${candidateCards}
    </table>
  </td></tr>

  <!-- AVAILABILITY GUIDE -->
  <tr><td style="background:#f8fafc;padding:20px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Availability Tiers</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#475569;">🟢 <strong>High Availability</strong> — Actively seeking work, local, contactable right now</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#475569;">🟡 <strong>Possible Availability</strong> — Licensed professional who may be open to opportunities</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#475569;">🔵 <strong>Monitor</strong> — On our radar — worth reaching out proactively</td>
      </tr>
    </table>
  </td></tr>

  <!-- DASHBOARD CTA -->
  ${client.dashboard_token ? `<tr><td style="background:#0a1628;padding:20px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:center;">
    <a href="https://detroitwebagent.com/talent-radar/dashboard?token=${client.dashboard_token}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">📊 View Full Dossiers in Your Dashboard</a>
    <p style="margin:10px 0 0;font-size:11px;color:#64748b;">Browse, filter, and track all candidates with complete contact information</p>
  </td></tr>` : ""}

  <!-- FOOTER -->
  <tr><td style="padding:20px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;background:#0a1628;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #00d4ff30;" alt="Matt"></td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a></p>
          </td>
        </tr></table>
      </td>
      <td style="text-align:right;vertical-align:middle;">
        <p style="margin:0;font-size:10px;color:#475569;">Reply to adjust roles or zip codes</p>
        <p style="margin:2px 0 0;font-size:10px;color:#475569;"><a href="mailto:matt@detroitwebagent.com?subject=Unsubscribe%20TechAlert" style="color:#64748b;text-decoration:none;">Unsubscribe</a></p>
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`,
    }),
  });
  } catch (e) {
    console.error("[sendAlerts] email failed:", e instanceof Error ? e.message : String(e));
  }
}

// 50-source registry: pull DOL WARN layoffs (= newly available workers) +
// licensed-pro lookups via license_waterfall. Best-effort, won't break scanner.
async function scanRegistryHireSignals(sb: any, state = "MI"): Promise<RawCandidate[]> {
  const out: RawCandidate[] = [];
  try {
    const [hire, lic] = await Promise.all([
      fetchHireSignals(sb, { state, days: 30 }).catch(() => []),
      fetchLicenses(sb, { state, board: "contractor" }).catch(() => []),
    ]);
    for (const s of (hire || []).slice(0, 50)) {
      const a = s as any;
      if (a.full_name && isPlausibleHumanName(a.full_name)) {
        out.push({
          full_name: a.full_name,
          phone: a.phone, email: a.email, city: a.city, zip: a.zip,
          source: "registry",
          raw_data: { type: a.type, source: a.source, detail: a.detail, url: a.url },
        });
      }
    }
    for (const l of (lic || []).slice(0, 100)) {
      const a = l as any;
      if (a.full_name && isPlausibleHumanName(a.full_name)) {
        out.push({
          full_name: a.full_name,
          license_type: a.license_type || a.board,
          license_number: a.license_number,
          license_expiry: a.expires_at || a.expiry,
          city: a.city, zip: a.zip,
          source: "registry",
          raw_data: { board: a.board, source: a.source },
        });
      }
    }
  } catch (e) {
    console.warn("[hire-alert-scanner] registry scan failed:", e instanceof Error ? e.message : String(e));
  }
  return out;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const runStart = new Date().toISOString();

  // Phase 17 fix: insert a "running" row IMMEDIATELY so the sentinel + dashboard see the run
  // even if the function later times out (16-source scan can exceed 150s wall-clock).
  // We update this same row at the end with final stats.
  let runRowId: string | null = null;
  try {
    const { data: runRow } = await sb
      .from("hire_alert_runs")
      .insert({
        started_at: runStart,
        run_at: runStart,
        source: "all",
        status: "running",
        candidates_found: 0,
        new_candidates: 0,
        candidates_alerted: 0,
        alerts_sent: 0,
        lara_status: "not_attempted",
      })
      .select("id")
      .single();
    runRowId = runRow?.id ?? null;
  } catch (e) {
    console.warn("[hire-alert-scanner] failed to insert run-start row:", e instanceof Error ? e.message : String(e));
  }

  try {

  // Fetch active paid clients + active trial clients
  const { data: allClients } = await sb.from("hire_alert_clients").select("*").or("active.eq.true,trial_status.eq.active");
  if (!allClients?.length) {
    console.log("[hire-alert-scanner] No active clients");
    return new Response(JSON.stringify({ processed: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // TOS Compliance Gate — only send alerts to clients who accepted TOS
  const clients = allClients.filter((c: any) => c.tos_accepted_at);
  const tosBlockedCount = allClients.length - clients.length;
  if (tosBlockedCount > 0) {
    console.log(`[hire-alert-scanner] TOS gate: ${tosBlockedCount} client(s) blocked (TOS not accepted)`);
  }
  if (!clients.length) {
    console.log("[hire-alert-scanner] All clients blocked by TOS gate");
    return new Response(JSON.stringify({ processed: 0, tos_blocked: tosBlockedCount }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Phase 18: Dispatch Apify Actor runs in parallel (fire-and-forget — webhook handler picks up results).
  // This kicks off MIOSHA Excel scraper + Indeed scraper + LinkedIn enrichment via Apify residential proxies.
  // Results stream back to /apify-results-handler over the next 2-15 minutes.
  dispatchApifyRuns(sb).catch((e) => console.error("[hire-alert-scanner] dispatchApifyRuns failed:", e));

  // Run direct sources in parallel (allSettled so one failure doesn't cancel the other)
  console.log("[hire-alert-scanner] Scanning all sources...");
  const results = await Promise.allSettled([
    scanMIOSHA(),
    scanJobBoards(),
    scanOSHAIncidents(),
    scanSBALoanApprovals(),
    scanApprenticeshipCompletions(),
    scanRegistryHireSignals(sb),
  ]);

  const mioshaCandidates = results[0].status === "fulfilled" ? results[0].value : [];
  const jobBoardCandidates = results[1].status === "fulfilled" ? results[1].value : [];
  const oshaLeads = results[2].status === "fulfilled" ? results[2].value : [];
  const sbaLeads = results[3].status === "fulfilled" ? results[3].value : [];
  const apprenticeCandidates = results[4].status === "fulfilled" ? results[4].value : [];
  const registryCandidates = results[5].status === "fulfilled" ? results[5].value : [];

  // Log new source counts
  console.log(`[hire-alert-scanner] OSHA: ${oshaLeads.length}, SBA: ${sbaLeads.length}, Apprenticeship: ${apprenticeCandidates.length}, Registry: ${registryCandidates.length}`);

  const sourceErrors: Record<string, string> = {};
  if (results[0].status === "rejected") {
    const msg = results[0].reason instanceof Error ? results[0].reason.message : String(results[0].reason);
    console.error("[hire-alert-scanner] scanMIOSHA failed:", msg);
    sourceErrors.miosha = msg.slice(0, 300);
  } else if (mioshaCandidates.length === 0) {
    sourceErrors.miosha = "0 results — silent failure suspected";
  }
  if (results[1].status === "rejected") {
    const msg = results[1].reason instanceof Error ? results[1].reason.message : String(results[1].reason);
    console.error("[hire-alert-scanner] scanJobBoards failed:", msg);
    sourceErrors.jobBoards = msg.slice(0, 300);
  }
  // Note: jobBoards returning 0 is EXPECTED (Sonar can no longer reliably scrape Indeed/LinkedIn
  // since the LinkedIn lawsuit). It's an advisory source — not an error. Do not flag as failure.

  // Stamp per-source diagnostics on the run row immediately so the audit dashboard
  // shows WHICH source went silent — not just "0 candidates".
  if (runRowId && Object.keys(sourceErrors).length) {
    sb.from("hire_alert_runs")
      .update({ errors: sourceErrors as any, error_message: Object.entries(sourceErrors).map(([k, v]) => `${k}: ${v}`).join(" | ") })
      .eq("id", runRowId)
      .then(() => {}, (e: unknown) => console.warn("[hire-alert-scanner] failed to stamp source errors:", e));
  }

  const allRaw = [...mioshaCandidates, ...jobBoardCandidates, ...apprenticeCandidates, ...oshaLeads, ...sbaLeads, ...registryCandidates];

  // Fix 4: 2-strike zero-result alert — only fires after 2 consecutive zero runs to avoid Sunday noise.
  try {
    const { data: prevRun } = await sb
      .from("hire_alert_runs")
      .select("candidates_found")
      .neq("id", runRowId || "")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevWasZero = (prevRun?.candidates_found ?? 1) === 0;
    if (mioshaCandidates.length === 0 && prevWasZero) {
      await sendSMS(
        ADMIN_PHONE, TWILIO_PHONE_NUMBER,
        `⚠️ TechAlert zero-result: LARA/MIOSHA returned 0 candidates for 2 consecutive runs (${new Date().toLocaleTimeString("en-US", { timeZone: "America/Detroit" })} ET). Check scanner logs.`,
        "hire_alert_zero_result"
      ).catch(() => {});
    }
    if (jobBoardCandidates.length === 0 && prevWasZero) {
      await sendSMS(
        ADMIN_PHONE, TWILIO_PHONE_NUMBER,
        "⚠️ TechAlert zero-result: Job boards returned 0 candidates for 2 consecutive runs.",
        "hire_alert_zero_result"
      ).catch(() => {});
    }
  } catch (e) {
    console.warn("[hire-alert-scanner] zero-result check failed:", e instanceof Error ? e.message : String(e));
}



  const sourceHealth: Record<string, string> = {
    miosha: mioshaCandidates.length > 0 ? "✅" : "⚠️ 0 results",
    sonar: jobBoardCandidates.length > 0 ? "✅" : "⚠️ 0 results",
    npi: "—",
    pdl: "—",
  };
  console.log(`[hire-alert-scanner] Raw candidates: MIOSHA=${mioshaCandidates.length} JobBoards=${jobBoardCandidates.length}`);

  // Deduplicate by license_number or name+city; also reject junk names (nav text, punctuation, etc.)
  const seen = new Set<string>();
  const deduped = allRaw.filter((c) => {
    if (!isPlausibleHumanName(c.full_name)) {
      console.log(`[hire-alert-scanner] Skipping junk name: "${c.full_name}"`);
      return false;
    }
    const key = c.license_number || `${c.full_name.toLowerCase()}-${(c.city || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Check which candidates are new.
  // CRITICAL: Do NOT filter by source — the miosha-license-scraper writes source="npi","lara_socrata",
  // "lara_bcc", "dol", etc., never "miosha". Filtering by source caused existingKeys to be empty,
  // every candidate appeared "new", the INSERT hit a UNIQUE constraint on license_number, and 0 rows committed.
  // Fix: fetch ALL candidates older than the 25h window as "already seen". Candidates inserted in the last
  // 25h by the scraper are NOT in existingKeys → correctly treated as new → scored and alerted.
  const sinceCutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const { data: existingRecords } = await sb
    .from("hire_alert_candidates")
    .select("license_number, full_name, name, city, linkedin_url, facebook_url, current_employer, current_title, years_experience, qualifications_summary, hiring_recommendation, enrichment_status, email, phone")
    .lt("first_seen_at", sinceCutoff);

  const enrichmentLookup = new Map<string, Record<string, unknown>>();
  for (const r of existingRecords || []) {
    const key = r.license_number || `${((r.full_name || r.name) || "").toLowerCase()}-${(r.city || "").toLowerCase()}`;
    if (r.enrichment_status === "complete") {
      enrichmentLookup.set(key, {
        linkedin_url: r.linkedin_url, facebook_url: r.facebook_url,
        current_employer: r.current_employer, current_title: r.current_title,
        years_experience: r.years_experience, qualifications_summary: r.qualifications_summary,
        hiring_recommendation: r.hiring_recommendation, enrichment_status: r.enrichment_status,
        email: r.email, phone: r.phone,
      });
    }
  }

  const existingKeys = new Set(
    (existingRecords || []).map((r) =>
      r.license_number || `${((r.full_name || r.name) || "").toLowerCase()}-${(r.city || "").toLowerCase()}`
    )
  );

  const newCandidates = deduped.filter((c) => {
    const key = c.license_number || `${c.full_name.toLowerCase()}-${(c.city || "").toLowerCase()}`;
    return !existingKeys.has(key);
  });

  console.log(`[hire-alert-scanner] New candidates: ${newCandidates.length}`);

  // Score each new candidate
  const scored: ScoredCandidate[] = [];
  for (const candidate of newCandidates) {
    const { score, reason } = await scoreCandidate(candidate);
    const key = candidate.license_number || `${candidate.full_name.toLowerCase()}-${(candidate.city || "").toLowerCase()}`;
    const enrichment = enrichmentLookup.get(key);
    scored.push({
      ...candidate,
      availability_score: score,
      score_reason: reason,
      ...(enrichment ? {
        linkedin_url: enrichment.linkedin_url as string | undefined,
        facebook_url: enrichment.facebook_url as string | undefined,
        current_employer: enrichment.current_employer as string | undefined,
        current_title: enrichment.current_title as string | undefined,
        years_experience: enrichment.years_experience as number | undefined,
        qualifications_summary: enrichment.qualifications_summary as string | undefined,
        hiring_recommendation: enrichment.hiring_recommendation as string | undefined,
        enrichment_status: enrichment.enrichment_status as string | undefined,
        email: candidate.email || enrichment.email as string | undefined,
        phone: candidate.phone || enrichment.phone as string | undefined,
      } : {}),
    });
  }

  // ===== INLINE ENRICHMENT WATERFALL: NPI → Sonar → PDL → AI Synthesis =====
  // Sort by score DESC, enrich top 5 to stay within timeout limits
  // Remaining candidates get enrichment_status='pending' for candidate-deep-enrich second pass
  const sortedByScore = [...scored].sort((a, b) => b.availability_score - a.availability_score);
  const enrichBatch = sortedByScore.slice(0, 5);
  const pendingBatch = sortedByScore.slice(5);

  let npiHits = 0;
  let pdlHits = 0;

  console.log(`[hire-alert-scanner] Enriching top ${enrichBatch.length} candidates inline (${pendingBatch.length} deferred to deep-enrich)`);

  for (const candidate of enrichBatch) {
    // Skip if already enriched from DB
    if (candidate.enrichment_status === "complete") continue;

    try {
      // Phase 1: NPI API (healthcare candidates only)
      let npiData: Record<string, unknown> = {};
      if (isHealthcareRole(candidate.license_type)) {
        npiData = await enrichViaNPI(candidate);
        if (npiData.npi_number) {
          npiHits++;
          candidate.npi_number = npiData.npi_number as string;
          candidate.npi_business_phone = npiData.npi_business_phone as string | undefined;
          candidate.npi_taxonomy = npiData.npi_taxonomy as string | undefined;
          candidate.npi_practice_address = npiData.npi_practice_address as string | undefined;
          // NPI business phone as fallback phone
          if (!candidate.phone && candidate.npi_business_phone) {
            candidate.phone = candidate.npi_business_phone;
          }
        }
      }

      // Phase 2: Sonar Deep Dork (upgraded boolean search)
      const sonarData = await enrichViaSonar(candidate);

      // Merge Sonar data into candidate
      if (sonarData.linkedin_url) candidate.linkedin_url = sonarData.linkedin_url as string;
      if (sonarData.facebook_url) candidate.facebook_url = sonarData.facebook_url as string;
      if (sonarData.email && !candidate.email) candidate.email = sonarData.email as string;
      if (sonarData.phone && !candidate.phone) candidate.phone = sonarData.phone as string;
      if (sonarData.current_employer) candidate.current_employer = sonarData.current_employer as string;
      if (sonarData.current_title) candidate.current_title = sonarData.current_title as string;
      if (sonarData.years_experience) candidate.years_experience = sonarData.years_experience as number;

      // Phase 3: PDL Skip-Trace (only if we have LinkedIn or enough identity data)
      let pdlData: Record<string, unknown> = {};
      if (PDL_API_KEY && (candidate.linkedin_url || candidate.city)) {
        const pdlRes = await withBreaker("pdl", () => enrichWithPDL(candidate));
        if (pdlRes.skipped) console.warn("[hire-alert-scanner] PDL circuit open — skipping enrichment");
        pdlData = pdlRes.ok ? (pdlRes.data ?? {}) : {};
        if (pdlData.pdl_mobile_phone || pdlData.pdl_personal_email) {
          pdlHits++;
          candidate.pdl_mobile_phone = pdlData.pdl_mobile_phone as string | undefined;
          candidate.pdl_personal_email = pdlData.pdl_personal_email as string | undefined;
          // PDL mobile becomes primary phone if none exists
          if (!candidate.phone && candidate.pdl_mobile_phone) {
            candidate.phone = candidate.pdl_mobile_phone;
          }
          // PDL email becomes email if none exists
          if (!candidate.email && candidate.pdl_personal_email) {
            candidate.email = candidate.pdl_personal_email;
          }
          // PDL LinkedIn if Sonar missed it
          if (!candidate.linkedin_url && pdlData.pdl_linkedin_url) {
            candidate.linkedin_url = pdlData.pdl_linkedin_url as string;
          }
          // PDL employer/title as fallback
          if (!candidate.current_employer && pdlData.pdl_company) {
            candidate.current_employer = pdlData.pdl_company as string;
          }
          if (!candidate.current_title && pdlData.pdl_job_title) {
            candidate.current_title = pdlData.pdl_job_title as string;
          }
        }
      }

      // Phase 3b: NPI taxonomy premium scoring bonus (item 7)
      if (npiData.npi_taxonomy) {
        const taxStr = String(npiData.npi_taxonomy);
        for (const [keyword, bonus] of Object.entries(TAXONOMY_PREMIUM_MAP)) {
          if (taxStr.toLowerCase().includes(keyword.toLowerCase())) {
            candidate.availability_score = Math.min(10, candidate.availability_score + bonus);
            candidate.score_reason = `${candidate.score_reason || ""} · ${keyword} specialty (+${bonus})`.trim();
            break;
          }
        }
      }

      // Phase 3c: Job board freshness decay / boost (item 9)
      const jobBoardActive = !!(sonarData as any).job_board_active;
      const lastJobBoardSeen = (sonarData as any).last_job_board_seen as string | null;
      if (lastJobBoardSeen) {
        const daysSinceSeen = Math.floor((Date.now() - new Date(lastJobBoardSeen).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceSeen < 14) {
          candidate.availability_score = Math.min(10, candidate.availability_score + 2);
          candidate.availability_signal = `Active on job boards ${daysSinceSeen}d ago`;
        } else if (daysSinceSeen > 90) {
          candidate.availability_score = Math.max(1, candidate.availability_score - 2);
          candidate.availability_signal = `Job board activity ${daysSinceSeen}d ago — may have placed`;
        } else {
          candidate.availability_signal = `Last seen on job boards ${daysSinceSeen}d ago`;
        }
      } else if (jobBoardActive) {
        candidate.availability_signal = "Active on job boards";
      }

      // Phase 3d: Employer growth probe → flight risk (items 1, 8)
      const employer = candidate.current_employer;
      if (employer) {
        const [growthResult, oshaProof] = await Promise.all([
          probeEmployerGrowth(employer),
          probeOSHAViolations(employer),
        ]);
        candidate.flight_risk = growthResult.risk;
        const proofParts = [growthResult.proof, oshaProof].filter(Boolean);
        candidate.flight_risk_proof = proofParts.join(" | ") || null as any;

        // Cross-reference with industry_pulse_signals (item 1 — Flight Risk Matrix)
        try {
          const { data: pulseSignals } = await sb.from("industry_pulse_signals")
            .select("id, signal_type, confidence")
            .ilike("company_name", `%${employer.slice(0, 20)}%`)
            .gte("detected_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .limit(3);
          if (pulseSignals && pulseSignals.length > 0) {
            const highConf = pulseSignals.filter((s: any) => s.confidence >= 6);
            if (highConf.length >= 2) {
              candidate.flight_risk = "hard_to_poach";
              candidate.flight_risk_proof = `🛡️ HARD TO POACH — ${employer} has ${highConf.length} active growth signals in Demand Radar. Candidate is likely comfortable. ${candidate.flight_risk_proof || ""}`.trim();
            } else if (highConf.length === 1 && candidate.flight_risk !== "hard_to_poach") {
              candidate.flight_risk = "neutral";
              candidate.flight_risk_proof = `↔️ NEUTRAL — ${employer} shows 1 recent activity signal. Approach with standard outreach.`;
            }
          } else if (!pulseSignals?.length && candidate.flight_risk !== "hard_to_poach") {
            // Zero signals in Demand Radar = additional flight risk confirmation
            candidate.flight_risk = "high_flight_risk";
            const existing = candidate.flight_risk_proof || "";
            if (!existing.includes("Demand Radar")) {
              candidate.flight_risk_proof = `${existing} No signals in Demand Radar growth database for ${employer}.`.trim();
            }
          }
        } catch { /* non-critical */ }
      } else {
        candidate.flight_risk = "neutral";
        candidate.flight_risk_proof = "Employer not identified — flight risk unknown.";
      }

      // Phase 3e: Corroboration score (item 10)
      let corrobCount = 0;
      const confirmedEmployer = candidate.current_employer;
      if (confirmedEmployer) {
        if ((sonarData as any).current_employer) corrobCount++;
        if (pdlData.pdl_company) corrobCount++;
        if (npiData.npi_practice_address) corrobCount++;
      }
      candidate.corroboration_score = corrobCount;

      // Phase 3f: PDL-derived computed fields (item 4 — headcount delta, item 13 — stability)
      if (pdlData.pdl_job_stability_index !== null && pdlData.pdl_job_stability_index !== undefined) {
        candidate.job_stability_index = pdlData.pdl_job_stability_index as number;
      }
      if ((pdlData as any).pdl_company_employee_count) {
        // Compare against stored raw_data value to compute delta
        const prevCount = (candidate.raw_data as any)?.pdl_company_employee_count;
        const currCount = (pdlData as any).pdl_company_employee_count;
        if (prevCount && currCount) {
          candidate.employer_headcount_delta = currCount - prevCount;
          if (candidate.employer_headcount_delta < -20 && candidate.flight_risk !== "high_flight_risk") {
            candidate.flight_risk = "high_flight_risk";
            candidate.flight_risk_proof = `🎯 Employer headcount dropped ~${Math.abs(candidate.employer_headcount_delta)} since last scan. ${candidate.flight_risk_proof || ""}`.trim();
          }
        }
      }

      // Phase 3g: Hunter email verification (item 11)
      const workEmail = pdlData.pdl_work_email as string | undefined;
      if (workEmail) {
        const deliverability = await verifyEmailViaHunter(workEmail);
        if (deliverability) {
          (candidate.raw_data as any) = { ...(candidate.raw_data || {}), email_deliverability: deliverability };
        }
      }

      // Phase 3h: Snov.io HR contact for employer (item 12)
      if (employer && pdlData.pdl_company) {
        const employerDomain = (pdlData as any).pdl_company_domain;
        if (employerDomain) {
          const hrContact = await findHRContactViaSnoviо(employerDomain);
          if (hrContact) {
            (candidate.raw_data as any) = { ...(candidate.raw_data || {}), employer_hr_contact: hrContact };
          }
        }
      }

      // Phase 3i: personal_email_primary (item 14)
      if (pdlData.pdl_personal_email) {
        (candidate as any).personal_email_primary = true;
      }

      // Phase 3j: Apollo org enrich fallback for employer context (item 15)
      if (candidate.current_employer && !(pdlData as any).pdl_company_employee_count) {
        const apolloOrg = await apolloOrgEnrich(candidate.current_employer);
        if (apolloOrg.employee_count) {
          (candidate.raw_data as any) = { ...(candidate.raw_data || {}), apollo_employee_count: apolloOrg.employee_count, apollo_industry: apolloOrg.industry };
          // Use for headcount delta if PDL missed it
          if ((candidate as any).employer_headcount_delta === undefined || (candidate as any).employer_headcount_delta === null) {
            const prevCount = (candidate.raw_data as any)?.apollo_employee_count_prev;
            if (prevCount) (candidate as any).employer_headcount_delta = apolloOrg.employee_count - prevCount;
          }
          // Small employer = higher flight risk adjustment
          if (apolloOrg.employee_count < 15 && (candidate as any).flight_risk !== "high_flight_risk") {
            (candidate as any).flight_risk_proof = `${(candidate as any).flight_risk_proof || ""} Small employer (~${apolloOrg.employee_count} employees) — candidate unlikely to have strong retention benefits.`.trim();
          }
        }
      }

      // Phase 3k: HIBP paste check for password_compromised (item 16)
      const checkEmail = candidate.email || pdlData.pdl_personal_email as string | undefined;
      if (checkEmail) {
        const compromised = await checkPasswordCompromised(String(checkEmail));
        (candidate as any).password_compromised = compromised;
      }

      // Phase 3l: available_until computation (item 18)
      let availableUntil: string | null = null;
      if (candidate.license_expiry) {
        const expiry = new Date(candidate.license_expiry);
        if (expiry < new Date()) {
          // Lapsed: availability window = expiry + 90 days
          const until = new Date(expiry.getTime() + 90 * 24 * 60 * 60 * 1000);
          availableUntil = until.toISOString().split("T")[0];
        }
      }
      if (!availableUntil && (candidate as any).availability_signal?.includes("Active on job boards")) {
        // Active on job board: window = 45 days from now
        const until = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
        availableUntil = until.toISOString().split("T")[0];
      }
      if (availableUntil) (candidate as any).available_until = availableUntil;

      // Phase 4: AI Synthesis (now includes NPI + PDL context)
      const { qualifications_summary, hiring_recommendation } = await synthesizeViaAI(candidate, sonarData, npiData, pdlData);
      if (qualifications_summary) candidate.qualifications_summary = qualifications_summary;
      if (hiring_recommendation) candidate.hiring_recommendation = hiring_recommendation;

      candidate.enrichment_status = "complete";
    } catch (e) {
      console.warn(`[hire-alert-scanner] Inline enrichment failed for ${candidate.full_name}:`, e instanceof Error ? e.message : String(e));
      candidate.enrichment_status = "pending"; // Will be picked up by deep-enrich
    }
  }

  // Update source health with NPI/PDL stats
  sourceHealth.npi = npiHits > 0 ? `✅ ${npiHits} hits` : "⚠️ 0 hits";
  sourceHealth.pdl = pdlHits > 0 ? `✅ ${pdlHits} hits` : PDL_API_KEY ? "⚠️ 0 hits" : "⛔ No key";

  // Mark pending batch
  for (const c of pendingBatch) {
    if (!c.enrichment_status) c.enrichment_status = "pending";
  }

  // Upsert all new candidates into DB
  const allScored = [...enrichBatch, ...pendingBatch];
  if (allScored.length) {
    const { data: insertedRows, error: insertError } = await sb.from("hire_alert_candidates").upsert(
      allScored.map((c) => ({
        name: c.full_name,
        full_name: c.full_name,
        phone: c.phone || null,
        email: c.email || null,
        trade: classifyTradeForCandidate(c.license_type, c.source),
        license_type: c.license_type || null,
        license_number: c.license_number || null,
        state: "MI",
        license_expiry: c.license_expiry || null,
        city: c.city || null,
        zip: c.zip || null,
        source: c.source,
        status: "new",
        score: c.availability_score,
        availability_score: c.availability_score,
        score_reason: c.score_reason,
        raw_data: {
          ...(c.raw_data || {}),
          npi_number: c.npi_number || null,
          npi_business_phone: c.npi_business_phone || null,
          npi_taxonomy: c.npi_taxonomy || null,
          npi_practice_address: c.npi_practice_address || null,
          pdl_mobile_phone: c.pdl_mobile_phone || null,
          pdl_personal_email: c.pdl_personal_email || null,
        },
        linkedin_url: c.linkedin_url || null,
        facebook_url: c.facebook_url || null,
        current_employer: c.current_employer || null,
        current_title: c.current_title || null,
        years_experience: c.years_experience || null,
        qualifications_summary: c.qualifications_summary || null,
        hiring_recommendation: c.hiring_recommendation || null,
        enrichment_status: c.enrichment_status || "pending",
        flight_risk: (c as any).flight_risk || null,
        flight_risk_proof: (c as any).flight_risk_proof || null,
        corroboration_score: (c as any).corroboration_score ?? null,
        employer_headcount_delta: (c as any).employer_headcount_delta ?? null,
        job_stability_index: (c as any).job_stability_index ?? null,
        availability_signal: (c as any).availability_signal || null,
        personal_email_primary: (c as any).personal_email_primary ?? null,
        password_compromised: (c as any).password_compromised ?? null,
        available_until: (c as any).available_until ?? null,
        // first_seen_at intentionally omitted: DB DEFAULT now() handles new rows;
        // on conflict (license_number) existing rows keep their original timestamp.
        last_seen_at: new Date().toISOString(),
      })),
      { onConflict: "license_number", ignoreDuplicates: false }
    ).select("id, full_name");

    if (insertError) {
      console.error("[hire-alert-scanner] DB UPSERT ERROR:", insertError.message, insertError.details);
    } else {
      console.log(`[hire-alert-scanner] Upserted ${insertedRows?.length || 0} candidates into DB`);
    }

    if (insertedRows) {
      const idMap = new Map((insertedRows as any[]).map((r) => [r.full_name, r.id]));
      for (const c of allScored) {
        (c as any)._db_id = idMap.get(c.full_name);
      }
    }
  }

  // Role keyword map
  const ROLE_KEYWORDS: Record<string, string[]> = {
    boiler_operator: ["boiler", "boiler operator"],
    steam_engineer: ["steam engineer"],
    pressure_vessel: ["pressure vessel", "pvi", "inspector"],
    hvac_tech: ["hvac", "air conditioning", "refrigeration", "heating"],
    plumber: ["plumber", "plumbing", "master plumber"],
    pipefitter: ["pipefitter", "steamfitter", "ua local", "ua 636"],
    electrician: ["electrician", "electrical"],
    industrial_mechanic: ["industrial mechanic", "maintenance mechanic"],
    cna: ["cna", "certified nursing assistant", "nurse aide", "nursing assistant"],
    rn: ["rn", "registered nurse"],
    lpn: ["lpn", "licensed practical nurse", "practical nurse"],
    director_of_nursing: ["director of nursing", "don", "nursing director"],
    home_health_aide: ["home health aide", "home health", "hha"],
  };

  function candidateMatchesRoles(licenseType: string | undefined, targetRoles: string[]): boolean {
    if (!licenseType || !targetRoles?.length) return true;
    const lower = licenseType.toLowerCase();
    return targetRoles.some((role) =>
      (ROLE_KEYWORDS[role] || [role]).some((kw) => lower.includes(kw))
    );
  }

  function candidateMatchesZips(candidateZip: string | undefined, candidateCity: string | undefined, targetZips: string[]): boolean {
    if (!targetZips?.length) return true;
    if (!candidateZip && !candidateCity) return true;
    if (candidateZip && targetZips.includes(candidateZip)) return true;
    const CITY_ZIP_PREFIXES: Record<string, string[]> = {
      detroit: ["482"], dearborn: ["481"], warren: ["480"], livonia: ["481"],
      "sterling heights": ["483"], troy: ["480"], "royal oak": ["480"],
      "farmington hills": ["483"], pontiac: ["483"],
    };
    if (candidateCity) {
      const cityLower = candidateCity.toLowerCase();
      for (const [city, prefixes] of Object.entries(CITY_ZIP_PREFIXES)) {
        if (cityLower.includes(city)) {
          if (targetZips.some((z) => prefixes.some((p) => z.startsWith(p)))) return true;
        }
      }
    }
    return false;
  }

  let alertsSent = 0;

  for (const client of clients) {
    const clientRoles: string[] = client.target_roles || [];
    const clientZips: string[] = (client as any).target_zip_codes || [];

    // Filter scored candidates to only those matching this client's target roles + zips.
    // 🛡️ Company-name guard belt-and-suspenders — even if scoreCandidate missed it, kill it here.
    const clientAlertWorthy = allScored.filter(
      (c) => c.availability_score >= 5
        && !looksLikeCompany(c.full_name)
        && candidateMatchesRoles(c.license_type, clientRoles)
        && candidateMatchesZips(c.zip, c.city, clientZips)
    );

    // ===== NO GHOST LEAD RULE =====
    // Only send candidates that have at least ONE clickable action link
    const actionableCandidates = clientAlertWorthy.filter(
      (c) => c.linkedin_url || c.facebook_url || c.email || c.phone || c.npi_business_phone || c.pdl_mobile_phone
    );

    const clientHotCandidates = actionableCandidates.filter((c) => c.availability_score >= 7);

    if (!actionableCandidates.length) {
      if (clientAlertWorthy.length) {
        console.log(`[hire-alert-scanner] Skipping ${client.company_name} — ${clientAlertWorthy.length} candidates matched but NONE had actionable contact info (No Ghost Lead rule)`);
      }
      continue;
    }

    try {
      if (client.notify_email && client.owner_email) {
        await sendAlertEmail(client, actionableCandidates, dateStr);
        alertsSent++;
      }

      if (client.notify_sms && client.owner_phone && clientHotCandidates.length) {
        const top = clientHotCandidates[0];
        const dashLink = client.dashboard_token ? ` View all: detroitwebagent.com/talent-radar/dashboard?token=${client.dashboard_token}` : "";
        const availLabel = top.availability_score >= 8 ? "High Availability" : top.availability_score >= 5 ? "Possible Availability" : "Monitor";
        const smsBody = clientHotCandidates.length === 1
          ? `Talent Radar: ${top.full_name} (${top.license_type || "licensed tech"}, ${top.city || "Metro Detroit"}) — ${availLabel}. You're the only one seeing this.${dashLink} Reply STOP to opt out.`
          : `Talent Radar: ${clientHotCandidates.length} licensed techs found. Top: ${top.full_name} (${top.license_type || "tradesperson"}, ${availLabel}).${dashLink} Reply STOP to opt out.`;
        await sendSMS(client.owner_phone, TWILIO_PHONE_NUMBER, smsBody, "hire_alert");
      }

      // TA-9: Record which candidates were alerted to this client
      if (actionableCandidates.length) {
        const candidateIds = actionableCandidates
          .map((c) => (c as any)._db_id)
          .filter(Boolean);
        if (candidateIds.length) {
          await sb.from("hire_alert_client_candidates" as any).upsert(
            candidateIds.map((candidateId: string) => ({
              client_id: client.id,
              candidate_id: candidateId,
              alerted_at: new Date().toISOString(),
            })),
            { onConflict: "client_id,candidate_id", ignoreDuplicates: true }
          );
        }
      }
    } catch (e) {
      console.error(`[hire-alert-scanner] Alert error for ${client.company_name}:`, e);
    }
  }

  // Update alerted candidates
  const allAlertWorthy = allScored.filter((c) => c.availability_score >= 5 && (c.linkedin_url || c.facebook_url || c.email || c.phone || c.npi_business_phone || c.pdl_mobile_phone));
  const allHotCandidates = allScored.filter((c) => c.availability_score >= 7);

  if (allAlertWorthy.length && alertsSent > 0) {
    const alertedNames = allAlertWorthy.map((c) => c.full_name);
    await sb
      .from("hire_alert_candidates")
      .update({ status: "alerted" })
      .in("full_name", alertedNames);
  }

  // Phase 17 fix: UPDATE the row we inserted at start (instead of inserting a duplicate).
  // This way the run is visible to the sentinel even if a later step times out.
  //
  // Phase C (Lead Enhancement Orchestrator policy): per-vertical contactability.
  // A candidate is "contactable" if any direct channel was resolved.
  // Vertical = healthcare (NPI taxonomy hit) | white_collar (decision-maker title)
  // | trade (everything else — the measured ~17% ceiling vertical).
  const verticalOf = (c: any): "healthcare" | "white_collar" | "trade" => {
    if (c.npi_taxonomy || /nurse|cna|lpn|rn|home health|aide/i.test(c.license_type || "")) return "healthcare";
    if (/owner|president|ceo|cfo|director|manager|vp|principal/i.test(c.current_title || "")) return "white_collar";
    return "trade";
  };
  const isContactable = (c: any) =>
    !!(c.email || c.phone || c.pdl_mobile_phone || c.pdl_personal_email || c.pdl_work_email ||
       c.hunter_email || c.snov_email || c.lusha_phone || c.lusha_email || c.npi_business_phone);
  const coverage_by_vertical: Record<string, { total: number; contactable: number; pct: number }> = {
    healthcare: { total: 0, contactable: 0, pct: 0 },
    white_collar: { total: 0, contactable: 0, pct: 0 },
    trade: { total: 0, contactable: 0, pct: 0 },
  };
  for (const c of allScored) {
    const v = verticalOf(c);
    coverage_by_vertical[v].total += 1;
    if (isContactable(c)) coverage_by_vertical[v].contactable += 1;
  }
  for (const v of Object.keys(coverage_by_vertical)) {
    const row = coverage_by_vertical[v];
    row.pct = row.total ? Math.round((row.contactable / row.total) * 1000) / 10 : 0;
  }

  const finalStats = {
    completed_at: new Date().toISOString(),
    status: "ok",
    candidates_found: allRaw.length,
    new_candidates: newCandidates.length,
    candidates_alerted: alertsSent,
    alerts_sent: alertsSent,
    errors: null,
    error_message: null,
    source_breakdown: {
      miosha: mioshaCandidates.length,
      job_boards: jobBoardCandidates.length,
      coverage_by_vertical,
    },
  };
  if (runRowId) {
    await sb.from("hire_alert_runs").update(finalStats).eq("id", runRowId);
  } else {
    // Fallback: insert if the start-row insert failed
    await sb.from("hire_alert_runs").insert({
      started_at: runStart,
      run_at: runStart,
      source: "all",
      lara_status: "not_attempted",
      ...finalStats,
    });
  }

  const enrichedCount = allScored.filter((c) => c.enrichment_status === "complete").length;
  const ghostLeadsFiltered = allScored.filter((c) => c.availability_score >= 5 && !c.linkedin_url && !c.facebook_url && !c.email && !c.phone && !c.npi_business_phone && !c.pdl_mobile_phone).length;

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/hire-alert-founder-report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ send: true, triggered_by: "hire-alert-scanner" }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    console.error("[hire-alert-scanner] founder report dispatch failed:", e instanceof Error ? e.message : String(e));
  }

  await sb.from("agent_heartbeats").upsert({
    agent_name: "hire-alert-scanner",
    last_beat: new Date().toISOString(),
    metadata: { candidates_found: allRaw.length, new_candidates: newCandidates.length, hot_candidates: allHotCandidates.length, alerts_sent: alertsSent, enriched_inline: enrichedCount, ghost_leads_filtered: ghostLeadsFiltered, npi_hits: npiHits, pdl_hits: pdlHits },
  }, { onConflict: "agent_name" });

  // Phase 20: waterfall drop-off snapshot for replay + diagnostics
  try {
    await sb.from("raw_signals_dump").insert({
      scanner: "hire-alert-scanner",
      source: "all",
      vertical: "mixed",
      raw_payload: { source_health: sourceHealth, sample: allRaw.slice(0, 25) },
      pulled_count: allRaw.length,
      kept_after_gate: deduped.length,
      enriched_count: enrichedCount,
      final_inserted: newCandidates.length,
      duration_ms: Date.now() - new Date(runStart).getTime(),
      notes: `hot=${allHotCandidates.length} alerts=${alertsSent} ghost_filtered=${ghostLeadsFiltered}`,
    });
  } catch (e) { console.warn("[hire-alert-scanner] raw dump failed:", e instanceof Error ? e.message : String(e)); }

  // ── 7-day no-contact re-engagement email ──
  // Active clients who haven't received any hire_alert comms in 7+ days get a
  // "here's what we found this week" summary so they stay engaged.
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: activeClients } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, owner_email, target_roles, dashboard_token")
      .eq("active", true)
      .not("owner_email", "is", null)
      .lt("created_at", sevenDaysAgo); // only clients older than 7 days

    if (activeClients?.length) {
      // Find which ones received a comms in last 7 days
      const { data: recentComms } = await sb
        .from("system_comms_log")
        .select("recipient")
        .eq("product", "hire_alert")
        .gte("created_at", sevenDaysAgo);
      const recentEmails = new Set((recentComms || []).map((r: any) => r.recipient).filter(Boolean));

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
      for (const client of activeClients) {
        if (recentEmails.has(client.owner_email)) continue; // already heard from us

        // Pull this week's top candidates matching their roles
        const { data: weekCandidates } = await sb
          .from("hire_alert_candidates")
          .select("full_name, license_type, city, availability_score")
          .gte("first_seen_at", sevenDaysAgo)
          .overlaps("license_type", client.target_roles || [])
          .order("availability_score", { ascending: false })
          .limit(3);

        const candidateRows = (weekCandidates || []).map((c: any) =>
          `<tr><td style="padding:6px 12px;border-bottom:1px solid #1e3a5f;">${c.full_name || "—"}</td><td style="padding:6px 12px;border-bottom:1px solid #1e3a5f;">${c.license_type || "—"}</td><td style="padding:6px 12px;border-bottom:1px solid #1e3a5f;">${c.city || "—"}</td><td style="padding:6px 12px;border-bottom:1px solid #1e3a5f;text-align:center;">${c.availability_score || "—"}/10</td></tr>`
        ).join("");

        const totalThisWeek = (weekCandidates || []).length;
        const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
<table width="100%" style="max-width:560px;background:#0f172a;border:1px solid #00d4ff30;border-radius:8px;overflow:hidden;">
<tr><td style="background:#00d4ff;padding:3px 0;"></td></tr>
<tr><td style="padding:12px 24px 4px;background:#0a1628;">
  <span style="font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#00d4ff;">⚡ TechAlert Weekly Summary</span>
</td></tr>
<tr><td style="padding:16px 24px 24px;color:#e2e8f0;font-size:15px;line-height:1.8;background:#0f172a;">
<p>Hey ${client.company_name || "there"} —</p>
<p>TechAlert has been running in the background all week. Here's a snapshot of what we found in your area:</p>
${totalThisWeek > 0 ? `<table width="100%" style="border-collapse:collapse;margin:12px 0;font-size:13px;">
<tr style="background:#1e3a5f;"><th style="padding:6px 12px;text-align:left;color:#94a3b8;">Name</th><th style="padding:6px 12px;text-align:left;color:#94a3b8;">License</th><th style="padding:6px 12px;text-align:left;color:#94a3b8;">City</th><th style="padding:6px 12px;color:#94a3b8;">Score</th></tr>
${candidateRows}
</table>
<p style="font-size:13px;color:#94a3b8;">Log in to see full contact info and claim candidates before they're gone.</p>` : `<p style="color:#94a3b8;font-size:14px;">It was a quiet week in your target area — the scanner ran every day and is ready to alert you the moment a new license shows up.</p>`}
<p style="margin-top:20px;"><a href="https://detroitwebagent.com/talent-radar/dashboard?token=${client.dashboard_token}" style="background:#00d4ff;color:#0a1628;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">View My Dashboard →</a></p>
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #1e3a5f;font-size:13px;color:#94a3b8;">
  <strong style="color:#e2e8f0;">Matt Michels</strong> · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;text-decoration:none;">(313) 992-1219</a>
</div>
</td></tr></table></td></tr></table></body></html>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@detroitwebagent.com>",
            to: [client.owner_email],
            subject: `TechAlert: ${totalThisWeek > 0 ? `${totalThisWeek} candidate${totalThisWeek > 1 ? "s" : ""} found this week` : "scanner update for your area"}`,
            html,
          }),
        }).catch(() => {});

        try {
          await (sb as any).from("system_comms_log").insert({
            channel: "email",
            product: "hire_alert",
            recipient: client.owner_email,
            body_preview: `Weekly re-engagement: ${totalThisWeek} candidates found`,
            metadata: { client_id: client.id, type: "weekly_summary", candidates_found: totalThisWeek },
          });
        } catch { /* swallow */ }
      }
    }
  } catch (e) {
    console.warn("[hire-alert-scanner] re-engagement email failed:", e instanceof Error ? e.message : String(e));
  }

  return new Response(
    JSON.stringify({
      candidates_found: allRaw.length,
      new_candidates: newCandidates.length,
      hot_candidates: allHotCandidates.length,
      alerts_sent: alertsSent,
      enriched_inline: enrichedCount,
      ghost_leads_filtered: ghostLeadsFiltered,
      npi_hits: npiHits,
      pdl_hits: pdlHits,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hire-alert-scanner] Unhandled error:", msg);
    // Phase 17 fix: mark the run row as errored so the sentinel + dashboard show the failure
    if (runRowId) {
      try {
        await sb.from("hire_alert_runs").update({
          completed_at: new Date().toISOString(),
          status: "error",
          error_message: msg.slice(0, 1000),
        }).eq("id", runRowId);
      } catch {/* best-effort */}
    }
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

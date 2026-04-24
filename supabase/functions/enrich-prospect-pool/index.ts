// enrich-prospect-pool — Tier 1+2 data gap filler.
// Reads prospect_pool rows that need enrichment, runs a per-audience waterfall
// using existing Lovable secrets only (no new keys), and writes results into
// nullable columns + meta.enrichment_trace. Stops as soon as email + contact
// are filled. Hard-caps Firecrawl at 200/day via ai_call_log.
//
// Invoked manually from OutreachCommandCenter (Enrich Now / Enrich All) and
// hourly via cron. Never modifies existing scoring or scrapers.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runEmailWaterfall, WaterfallCounters } from "../_shared/email-waterfall.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";
const SAM_GOV_API_KEY = Deno.env.get("SAM_GOV_API_KEY") || "";
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_DAILY_CAP = 200;
const FETCH_TIMEOUT_MS = 5_000;
const BUDGET_MS = 55_000;

type TraceStage = {
  source: string;
  filled: string[];
  cost_usd: number;
  duration_ms: number;
  ok: boolean;
  error?: string;
};

type Prospect = Record<string, any>;

// ---------- helpers ----------
async function safeFetch(url: string, init: RequestInit = {}, timeout = FETCH_TIMEOUT_MS) {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
}

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11) return `+${d}`;
  return null;
}

// ---------- enrichment stages ----------

// Shared email waterfall (Snov → Apollo → pattern_verify → Hunter → PDL → site_scrape).
// Replaces the legacy single-provider stageHunter/stageApolloPeople email paths.
async function stageEmailWaterfall(
  p: Prospect,
  sb: any,
  counters: WaterfallCounters,
): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "EmailWaterfall", filled: [], cost_usd: 0, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (p.email) {
    trace.error = "already_filled";
    trace.duration_ms = Date.now() - t0;
    trace.ok = true;
    return { patch, trace };
  }
  try {
    const r = await runEmailWaterfall(sb, {
      website: p.website,
      business_name: p.business_name,
      city: p.city,
      state: p.state,
      contact_first_name: p.contact_first_name ?? null,
      contact_last_name: p.contact_last_name ?? null,
    }, counters);
    if (r.email) {
      patch.email = r.email;
      trace.filled.push("email");
      trace.source = r.source ? `EmailWaterfall:${r.source}` : "EmailWaterfall";
    }
    // Persist per-step trace inside the parent trace's error slot for audit
    if (r.trace?.length) {
      (trace as any).steps = r.trace;
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}


async function stageHunter(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "Hunter", filled: [], cost_usd: 0.04, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!HUNTER_API_KEY) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  const domain = extractDomain(p.website);
  if (!domain) { trace.error = "no_domain"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  try {
    const res = await safeFetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=5&api_key=${HUNTER_API_KEY}`
    );
    const j = await res.json();
    const emails = j?.data?.emails || [];
    const best = emails.find((e: any) => ["owner", "ceo", "founder", "executive"].includes((e.seniority || "").toLowerCase()))
      ?? emails.find((e: any) => ["management", "executive"].includes((e.department || "").toLowerCase()))
      ?? emails[0];
    if (best?.value && !p.email) {
      patch.email = best.value;
      trace.filled.push("email");
    }
    const name = best && (best.first_name || best.last_name)
      ? `${best.first_name ?? ""} ${best.last_name ?? ""}`.trim()
      : null;
    if (name && !p.contact_name) {
      patch.contact_name = name;
      trace.filled.push("contact_name");
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageApolloPeople(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "Apollo", filled: [], cost_usd: 0, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!APOLLO_API_KEY) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  const domain = extractDomain(p.website);
  if (!domain) { trace.error = "no_domain"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  try {
    const res = await safeFetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_API_KEY },
      body: JSON.stringify({
        q_organization_domains: domain,
        person_titles: ["owner", "president", "ceo", "operations manager", "general manager"],
        page: 1,
        per_page: 3,
      }),
    });
    const j = await res.json();
    const person = (j?.people || [])[0];
    if (person) {
      const name = `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
      if (name && !p.contact_name) {
        patch.contact_name = name;
        trace.filled.push("contact_name");
      }
      if (person.email && !p.email) {
        patch.email = person.email;
        trace.filled.push("email");
      }
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageFirecrawl(p: Prospect, sb: any): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "Firecrawl", filled: [], cost_usd: 0.15, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!FIRECRAWL_API_KEY) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  if (!p.website) { trace.error = "no_website"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }

  // daily cap check
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await sb
    .from("ai_call_log")
    .select("id", { count: "exact", head: true })
    .eq("provider", "firecrawl")
    .gte("created_at", since);
  if ((count ?? 0) >= FIRECRAWL_DAILY_CAP) {
    trace.error = "daily_cap_reached";
    trace.duration_ms = Date.now() - t0;
    return { patch, trace };
  }

  try {
    const url = p.website.startsWith("http") ? p.website : `https://${p.website}`;
    const res = await safeFetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    const j = await res.json();
    const md: string = j?.markdown || j?.data?.markdown || "";
    if (md) {
      // log the call so the daily cap counts
      await sb.from("ai_call_log").insert({
        provider: "firecrawl", model: "v2-scrape", task: "enrich-prospect-pool",
        caller: "enrich-prospect-pool", success: true, cost_usd: 0.15,
      }).then(() => {}, () => {});

      const emailMatch = md.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch && !p.email) {
        const candidate = emailMatch[0].toLowerCase();
        // skip generic noreply / wordpress / image asset emails
        if (!/(noreply|no-reply|wordpress|sentry|wixpress|example\.com)/i.test(candidate)) {
          patch.email = candidate;
          trace.filled.push("email");
        }
      }
      // simple owner/contact extraction — look for "Owner: Name" or "Contact: Name"
      const nameMatch = md.match(/(?:Owner|Contact|President|Founder|CEO|Manager)[\s:]+([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/);
      if (nameMatch && !p.contact_name) {
        patch.contact_name = nameMatch[1];
        trace.filled.push("contact_name");
      }
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageSonar(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "Sonar", filled: [], cost_usd: 0.005, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!OPENROUTER_API_KEY) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  try {
    const prompt = `Find the owner/operator name and a publicly-listed business email for "${p.business_name}" in ${p.city ?? ""} ${p.state ?? ""}. Reply ONLY as compact JSON: {"contact_name":"Full Name or null","email":"name@domain.com or null"}. No prose.`;
    const res = await safeFetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      }),
    }, 12_000);
    const j = await res.json();
    const txt: string = j?.choices?.[0]?.message?.content || "";
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.email && parsed.email !== "null" && !p.email) {
        patch.email = parsed.email;
        trace.filled.push("email");
      }
      if (parsed.contact_name && parsed.contact_name !== "null" && !p.contact_name) {
        patch.contact_name = parsed.contact_name;
        trace.filled.push("contact_name");
      }
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageGooglePlaces(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "GooglePlaces", filled: [], cost_usd: 0.017, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!GOOGLE_MAPS_API_KEY) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  if (p.google_rating != null && p.review_count != null) { trace.error = "already_filled"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  try {
    const q = `${p.business_name} ${p.city ?? ""} ${p.state ?? ""}`.trim();
    const findRes = await safeFetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(q)}&inputtype=textquery&fields=place_id&key=${GOOGLE_MAPS_API_KEY}`
    );
    const findJ = await findRes.json();
    const placeId = findJ?.candidates?.[0]?.place_id;
    if (!placeId) { trace.error = "no_place_id"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }

    const detRes = await safeFetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,website,formatted_phone_number&key=${GOOGLE_MAPS_API_KEY}`
    );
    const detJ = await detRes.json();
    const r = detJ?.result;
    if (r) {
      if (typeof r.rating === "number") { patch.google_rating = r.rating; trace.filled.push("google_rating"); }
      if (typeof r.user_ratings_total === "number") { patch.review_count = r.user_ratings_total; trace.filled.push("review_count"); }
      if (r.website && !p.website) { patch.website = r.website; trace.filled.push("website"); }
      if (r.formatted_phone_number && !p.phone) { patch.phone = r.formatted_phone_number; trace.filled.push("phone"); }
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageTwilioCarrier(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "TwilioLookup", filled: [], cost_usd: 0.005, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!TWILIO_SID || !TWILIO_TOKEN) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  const phone = patch.phone || p.phone;
  const e164 = normPhone(phone);
  if (!e164) { trace.error = "no_phone"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  if (p.phone_carrier_type) { trace.error = "already_filled"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  try {
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const res = await safeFetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=line_type_intelligence`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const j = await res.json();
    const t = j?.line_type_intelligence?.type;
    if (t) { patch.phone_carrier_type = t; trace.filled.push("phone_carrier_type"); }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageHIBP(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "HIBP", filled: [], cost_usd: 0, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!HIBP_API_KEY) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  const domain = extractDomain(p.website);
  if (!domain) { trace.error = "no_domain"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  if (p.has_breach != null) { trace.error = "already_filled"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  try {
    const res = await safeFetch(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, {
      headers: { "hibp-api-key": HIBP_API_KEY, "user-agent": "lovable-enrich" },
    });
    if (res.status === 200) {
      const arr = await res.json();
      patch.has_breach = Array.isArray(arr) && arr.length > 0;
      trace.filled.push("has_breach");
    } else if (res.status === 404) {
      patch.has_breach = false;
      trace.filled.push("has_breach");
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageSAMGov(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "SAM.gov", filled: [], cost_usd: 0, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!SAM_GOV_API_KEY) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  if (p.recent_federal_contract) { trace.error = "already_flagged"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  try {
    const since = new Date(Date.now() - 365 * 24 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "/");
    const url = `https://api.sam.gov/opportunities/v2/search?api_key=${SAM_GOV_API_KEY}&postedFrom=${since}&postedTo=${new Date().toISOString().slice(0, 10).replace(/-/g, "/")}&limit=5&q=${encodeURIComponent(`"${p.business_name}"`)}`;
    const res = await safeFetch(url, {}, 8_000);
    const j = await res.json();
    if ((j?.totalRecords ?? 0) > 0) {
      patch.recent_federal_contract = true;
      trace.filled.push("recent_federal_contract");
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageDataForSEO(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "DataForSEO", filled: [], cost_usd: 0.0006, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) { trace.error = "no_key"; trace.duration_ms = Date.now() - t0; return { patch, trace }; }
  try {
    const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
    const q = `"${p.business_name}" owner OR president OR director ${p.city ?? ""}`;
    const res = await safeFetch("https://api.dataforseo.com/v3/serp/google/organic/live/regular", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ keyword: q, language_code: "en", location_code: 2840, depth: 5 }]),
    }, 10_000);
    const j = await res.json();
    const items = j?.tasks?.[0]?.result?.[0]?.items || [];
    for (const it of items) {
      const snippet = `${it.title ?? ""} ${it.description ?? ""}`;
      const m = snippet.match(/(?:Owner|President|Director|Founder)[\s:,-]+([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/);
      if (m && !p.contact_name) {
        patch.contact_name = m[1];
        trace.filled.push("contact_name");
        break;
      }
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

async function stageNPI(p: Prospect): Promise<{ patch: Prospect; trace: TraceStage }> {
  const t0 = Date.now();
  const trace: TraceStage = { source: "NPI", filled: [], cost_usd: 0, duration_ms: 0, ok: false };
  const patch: Prospect = {};
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&organization_name=${encodeURIComponent(p.business_name)}&state=${encodeURIComponent(p.state ?? "MI")}&limit=3`;
    const res = await safeFetch(url, {}, 6_000);
    const j = await res.json();
    const result = (j?.results || [])[0];
    if (result) {
      const phones = (result.addresses || []).map((a: any) => a.telephone_number).filter(Boolean);
      if (phones[0] && !p.phone) {
        patch.phone = phones[0];
        trace.filled.push("phone");
      }
      const meta_npi = {
        npi: result.number,
        taxonomy: result.taxonomies?.[0]?.desc,
      };
      patch.__meta_npi = meta_npi; // merged into meta below
      trace.filled.push("npi_meta");
    }
    trace.ok = true;
  } catch (e) {
    trace.error = e instanceof Error ? e.message : String(e);
  }
  trace.duration_ms = Date.now() - t0;
  return { patch, trace };
}

// ---------- waterfall router ----------

function waterfallFor(audience: string): Array<(p: Prospect, sb: any) => Promise<{ patch: Prospect; trace: TraceStage }>> {
  const seniorCare = ["nursing_home", "senior_care", "healthcare_staffing"];
  const industrial = ["industrial_mfg", "supply_house"];
  const trades = ["hvac", "plumbing", "roofing", "electrical", "general_contractor", "trades_staffing", "trade_contractor"];

  if (seniorCare.includes(audience)) {
    return [stageNPI, stageSonar, stageHunter, stageGooglePlaces, stageTwilioCarrier, stageHIBP];
  }
  if (industrial.includes(audience)) {
    return [stageHunter, stageApolloPeople, stageFirecrawl, stageSAMGov, stageDataForSEO, stageSonar, stageGooglePlaces, stageTwilioCarrier, stageHIBP];
  }
  if (trades.includes(audience)) {
    return [stageSonar, stageHunter, stageFirecrawl, stageGooglePlaces, stageTwilioCarrier, stageHIBP];
  }
  // unknown → general
  return [stageHunter, stageSonar, stageGooglePlaces, stageTwilioCarrier, stageHIBP];
}

async function enrichOne(sb: any, p: Prospect): Promise<{ id: string; patches: Prospect; trace: TraceStage[] }> {
  const trace: TraceStage[] = [];
  const working: Prospect = { ...p };
  const stages = waterfallFor(p.audience_type);

  for (const stage of stages) {
    // stop early once we have email + contact_name (cost control), but always
    // run the "always-last" group (Google/Twilio/HIBP) since they fill different fields
    const isQualityStage = stage === stageGooglePlaces || stage === stageTwilioCarrier || stage === stageHIBP;
    if (working.email && working.contact_name && !isQualityStage) continue;

    const { patch, trace: t } = await stage(working, sb);
    trace.push(t);
    Object.assign(working, patch);
  }

  // build final patches (compare to original)
  const patches: Prospect = {};
  for (const k of ["email", "contact_name", "phone", "website", "google_rating", "review_count", "phone_carrier_type", "has_breach", "recent_federal_contract"]) {
    if (working[k] != null && working[k] !== p[k]) patches[k] = working[k];
  }

  // merge meta
  const existingMeta = (p.meta && typeof p.meta === "object") ? p.meta : {};
  const npiMeta = working.__meta_npi;
  patches.meta = {
    ...existingMeta,
    enrichment_trace: trace,
    ...(npiMeta ? { npi: npiMeta } : {}),
  };

  // status classifier
  const filledCount = Object.keys(patches).filter((k) => k !== "meta").length;
  if (working.email && working.contact_name) patches.enrichment_status = "enriched";
  else if (filledCount >= 2) patches.enrichment_status = "partial";
  else if (filledCount === 0) patches.enrichment_status = "dead_end";
  else patches.enrichment_status = "partial";

  patches.last_enriched_at = new Date().toISOString();

  return { id: p.id, patches, trace };
}

// ---------- handler ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  let body: any = {};
  try { body = await req.json(); } catch { /* GET / no body */ }
  const singleId: string | undefined = body?.id;
  const batchSize: number = Math.max(1, Math.min(50, body?.limit ?? 25));

  // fetch rows
  let q = sb.from("prospect_pool").select("*");
  if (singleId) {
    q = q.eq("id", singleId).limit(1);
  } else {
    const cutoff = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
    q = q.or(`email.is.null,contact_name.is.null,last_enriched_at.is.null,last_enriched_at.lt.${cutoff}`)
         .order("last_enriched_at", { ascending: true, nullsFirst: true })
         .limit(batchSize);
  }
  const { data: rows, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const row of rows ?? []) {
    if (Date.now() - startedAt > BUDGET_MS) break;
    try {
      const { id, patches, trace } = await enrichOne(sb, row as Prospect);
      const { error: updErr } = await sb.from("prospect_pool").update(patches).eq("id", id);
      if (updErr) {
        results.push({ id, ok: false, error: updErr.message });
      } else {
        results.push({ id, ok: true, filled: Object.keys(patches).filter((k) => k !== "meta" && k !== "last_enriched_at" && k !== "enrichment_status"), stages: trace.length });
        // fire-and-forget re-score (do not await; do not break on failure)
        sb.functions.invoke("score-prospects", { body: { ids: [id] } }).catch(() => {});
      }
    } catch (e) {
      results.push({ id: row.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const summary = {
    ok: true,
    processed: results.length,
    enriched: results.filter((r) => r.ok).length,
    duration_ms: Date.now() - startedAt,
    results,
  };
  console.log(`[enrich-prospect-pool] ${JSON.stringify({ processed: summary.processed, enriched: summary.enriched, ms: summary.duration_ms })}`);
  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

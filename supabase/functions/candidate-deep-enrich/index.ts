// candidate-deep-enrich — Lead Enhancement Orchestrator (canonical waterfall)
// Runs every 30 minutes via cron. Picks up candidates with enrichment_status='pending'.
//
// PROTOCOL (Lead Enhancement Orchestrator policy, ratified 2026-04-20):
//  - Sequential execution; downstream stages are skipped the moment a verified
//    contact (email + phone) is secured. See pickContact() short-circuit gates
//    around stages 6/7/7B/7C/8.
//  - Every stage logs to candidate_enrichment_log + ai_call_log for ROI tracking.
//  - No vendor duplication: Prospeo, ZeroBounce, NeverBounce, Clearbit are
//    intentionally NOT integrated — Hunter handles email verification, PDL
//    handles firmographics. Adding them would burn credits without new signal.
//  - No CRM POST step: hire_alert_candidates IS the CRM. Records are tagged
//    market-ready by setting enrichment_status='complete'.
//  - Coverage targets are per-vertical (NOT a global 85%):
//      healthcare ≈ 60% (NPI + PDL)
//      white-collar contractor decision-makers ≈ 50% (Apollo + Hunter)
//      trade individuals (named on a license) ≈ 20% — measured ceiling
//
// STAGES (each logged to candidate_enrichment_log):
//  1. License-source     — already-have data baseline
//  2. NPI Registry       — free; healthcare workers only
//  3. PDL                — mobile phone, personal email, LinkedIn, employer
//  4. Hunter.io          — email by name+domain (needs employer); confidence ≥ 50
//  5. Snov.io            — email finder + verification
//  6. Lusha              — mobile/direct dial fallback (SMB-focused, US trades)
//  7. Sonar OSINT        — open-web fallback for social + employer
//  7B. NinjaPear          — LinkedIn enrichment when URL known
//  7C. Crustdata          — trial fallback for missing critical fields
//  8. Clay               — final waterfall (only candidates with score >= 7)
//
// Marks enrichment_status='complete' when at least 1 contact channel found,
// otherwise 'exhausted'.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cheapExtract, Schemas } from "../_shared/cheap-extract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const SNOV_USER_ID = Deno.env.get("SNOV_USER_ID") || "";
const SNOV_API_KEY = Deno.env.get("SNOV_API_KEY") || "";
const LUSHA_API_KEY = Deno.env.get("LUSHA_API_KEY") || "";
const CLAY_API_KEY = Deno.env.get("CLAY_API_KEY") || "";
const NINJAPEAR_API_KEY = Deno.env.get("NINJAPEAR_API_KEY") || "";
const CRUSTDATA_API_KEY = Deno.env.get("CRUSTDATA_API_KEY") || "";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CandidateRow {
  id: string;
  full_name: string;
  name: string;
  license_type: string | null;
  license_number: string | null;
  license_expiry: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  score: number | null;
  current_employer: string | null;
  linkedin_url: string | null;
  raw_data: Record<string, unknown> | null;
}

function extractJSON(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function logStage(sb: any, candidateId: string, stage: string, source: string, hits: string[], cost: number, success: boolean, err?: string, raw?: any) {
  try {
    await sb.from("candidate_enrichment_log").insert({
      candidate_id: candidateId,
      stage, source,
      hit_fields: hits,
      cost_estimate: cost,
      success,
      error_message: err || null,
      raw_response: raw ? (typeof raw === "string" ? { text: raw.slice(0, 500) } : raw) : null,
    });
  } catch { /* non-critical */ }
}

// ===== STAGE 2: NPI Registry (free) =====
async function stageNPI(c: CandidateRow): Promise<Record<string, unknown>> {
  if (!c.license_type || !/nurse|nursing|cna|lpn|rn|aide|health/i.test(c.license_type)) return {};
  try {
    const [first, ...rest] = (c.full_name || c.name).split(/\s+/);
    const last = rest.pop() || "";
    if (!first || !last) return {};
    const state = ((c as any).state || "MI").toString().toUpperCase();
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&state=${state}&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return {};
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return {};
    const addr = r.addresses?.find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0];
    return {
      npi_number: r.number,
      npi_business_phone: addr?.telephone_number,
      npi_taxonomy: r.taxonomies?.[0]?.desc,
      npi_practice_address: addr ? `${addr.address_1}, ${addr.city}, ${addr.state} ${addr.postal_code?.slice(0, 5)}` : null,
      city: c.city || addr?.city,
    };
  } catch { return {}; }
}

// ===== STAGE 3: People Data Labs (Premium) =====
async function stagePDL(c: CandidateRow): Promise<Record<string, unknown>> {
  if (!PDL_API_KEY) return {};
  try {
    const params = new URLSearchParams({
      name: c.full_name || c.name,
      "location.region": "michigan",
      pretty: "false",
      include_if_matched: "true",
      titlecase: "true",
      min_likelihood: "3",
    });
    if (c.city) params.set("location.locality", c.city);

    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { "X-API-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    if (data.status !== 200) return {};
    const p = data.data || {};

    // Best phone: prefer mobile from phone_numbers array, fall back to mobile_phone field
    const allPhones: string[] = p.phone_numbers || [];
    const mobilePhone = p.mobile_phone || allPhones[0] || null;

    // Best email: work email first for B2B outreach, personal as fallback
    const workEmail = p.work_email || null;
    const personalEmail = p.personal_emails?.[0] || null;

    // Most recent employer from experience array (more accurate than job_company_name)
    const currentExp = (p.experience || []).find((e: any) => e.is_primary) || (p.experience || [])[0];
    const employer = currentExp?.company?.name || p.job_company_name || null;
    const title = currentExp?.title?.name || p.job_title || null;

    // Certifications and skills — gold for trades enrichment
    const certs: string[] = (p.certifications || []).map((c: any) => c.name).filter(Boolean);
    const skills: string[] = (p.skills || []).slice(0, 10);

    // Job history depth for stability scoring
    const jobCount = (p.experience || []).length;
    const yearsExp = p.inferred_years_experience || null;
    const stabilityIndex = jobCount > 0 && yearsExp ? Math.round((yearsExp / jobCount) * 10) / 10 : null;

    return {
      pdl_mobile_phone: mobilePhone,
      pdl_personal_email: personalEmail,
      pdl_work_email: workEmail,
      pdl_all_phones: allPhones.slice(0, 3),           // store up to 3 phones
      pdl_likelihood: data.likelihood ?? null,
      linkedin_url: p.linkedin_url || null,
      facebook_url: p.facebook_url || null,
      twitter_url: p.twitter_url || null,
      current_employer: employer,
      current_title: title,
      years_experience: yearsExp,
      pdl_job_count: jobCount || null,
      pdl_stability_index: stabilityIndex,
      pdl_certifications: certs.length > 0 ? certs : null,
      pdl_skills: skills.length > 0 ? skills : null,
      pdl_inferred_salary: p.inferred_salary || null,
      pdl_location_metro: p.location_metro || null,
      pdl_location_zip: p.location_zip || null,
    };
  } catch { return {}; }
}

// ===== STAGE 4: Hunter.io (needs employer + name) =====
async function stageHunter(c: CandidateRow, employer?: string): Promise<Record<string, unknown>> {
  if (!HUNTER_API_KEY) return {};
  const company = employer || c.current_employer;
  if (!company) return {};
  const [first, ...rest] = (c.full_name || c.name).split(/\s+/);
  const last = rest.pop() || "";
  if (!first || !last) return {};
  try {
    // Domain search by company name
    const domRes = await fetch(`https://api.hunter.io/v2/domain-search?company=${encodeURIComponent(company)}&api_key=${HUNTER_API_KEY}&limit=1`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!domRes.ok) return {};
    const dom = await domRes.json();
    const domain = dom?.data?.domain;
    if (!domain) return {};

    // Email finder
    const findRes = await fetch(`https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${HUNTER_API_KEY}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!findRes.ok) return {};
    const found = await findRes.json();
    if (found?.data?.email) {
      // Confidence gate — Hunter scores < 50 are "risky"/"catch-all" per their docs.
      // Per Lead Enhancement Orchestrator policy, drop unverified emails to keep
      // the outbound sequencer clean. Domain still returned so Snov can attempt.
      if ((found.data.score ?? 0) < 50) {
        return { company_domain: domain, hunter_rejected_score: found.data.score };
      }
      return {
        hunter_email: found.data.email,
        hunter_confidence: found.data.score,
        company_domain: domain,
      };
    }
    return { company_domain: domain };
  } catch { return {}; }
}

// ===== STAGE 5: Snov.io (verify Hunter result + alternate finder) =====
async function snovToken(): Promise<string | null> {
  if (!SNOV_USER_ID || !SNOV_API_KEY) return null;
  try {
    const res = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_USER_ID}&client_secret=${SNOV_API_KEY}`,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.access_token || null;
  } catch { return null; }
}

async function stageSnov(c: CandidateRow, domain?: string, hunterEmail?: string): Promise<Record<string, unknown>> {
  const token = await snovToken();
  if (!token) return {};
  const [first, ...rest] = (c.full_name || c.name).split(/\s+/);
  const last = rest.pop() || "";

  try {
    // If we have a Hunter email, verify it
    if (hunterEmail) {
      const v = await fetch(`https://api.snov.io/v1/email-verifier?access_token=${token}&email=${encodeURIComponent(hunterEmail)}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (v.ok) {
        const vj = await v.json();
        return { snov_verified: vj?.data?.result === "deliverable", snov_status: vj?.data?.result };
      }
    }
    // Alternate email finder (Snov v2)
    if (domain && first && last) {
      const f = await fetch(`https://api.snov.io/v2/domain-emails-with-info?access_token=${token}&domain=${domain}&type=personal&limit=10`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (f.ok) {
        const fj = await f.json();
        const matches = (fj?.emails || []).filter((e: any) =>
          (e.firstName || "").toLowerCase() === first.toLowerCase() &&
          (e.lastName || "").toLowerCase() === last.toLowerCase()
        );
        if (matches[0]?.email) return { snov_email: matches[0].email };
      }
    }
    return {};
  } catch { return {}; }
}

// ===== STAGE 6: Lusha (mobile/direct dial) =====
async function stageLusha(c: CandidateRow): Promise<Record<string, unknown>> {
  if (!LUSHA_API_KEY) return {};
  const [first, ...rest] = (c.full_name || c.name).split(/\s+/);
  const last = rest.pop() || "";
  if (!first || !last) return {};
  try {
    const body: any = { contacts: [{ contactId: c.id, fullName: `${first} ${last}` }] };
    if (c.current_employer) body.contacts[0].companies = [{ name: c.current_employer, isCurrent: true }];
    const res = await fetch("https://api.lusha.com/v2/person", {
      method: "POST",
      headers: { "api_key": LUSHA_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const contact = Object.values(data?.contacts || {})[0] as any;
    if (!contact?.data) return {};
    return {
      lusha_phone: contact.data.phoneNumbers?.[0]?.number,
      lusha_email: contact.data.emailAddresses?.[0]?.email,
    };
  } catch { return {}; }
}

// ===== STAGE 7: Sonar OSINT (final social/employer fallback) =====
async function stageSonar(c: CandidateRow): Promise<Record<string, unknown>> {
  if (!OPENROUTER_API_KEY) return {};
  const trade = c.license_type || "tradesperson";
  const loc = c.city ? `${c.city}, Michigan` : "Michigan";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [
          { role: "system", content: "You are a research assistant. Return ONLY valid JSON, no markdown." },
          { role: "user", content: `Find LinkedIn URL, Facebook URL, current employer, current job title, public email, public phone for "${c.full_name || c.name}", a ${trade} in ${loc}. Return JSON: { "linkedin_url": null, "facebook_url": null, "email": null, "phone": null, "current_employer": null, "current_title": null, "years_experience": null }` },
        ],
        max_tokens: 600,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(text);
    if (!parsed) return {};
    // Strip null/empty values — Sonar returns the JSON skeleton with nulls when it can't find data.
    // Without this, all 7 keys get logged as "hit_fields" and null values overwrite real data downstream.
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string" && (v.trim() === "" || v.toLowerCase() === "null" || v.toLowerCase() === "n/a" || v.toLowerCase() === "unknown")) continue;
      cleaned[k] = v;
    }
    return cleaned;
  } catch { return {}; }
}

// ===== STAGE 7B: NinjaPear (Proxycurl/Nubela API) — LinkedIn profile resolver =====
// Fires only when we have a LinkedIn URL (typically from Sonar) AND still missing contact/employer.
// Cost: ~$0.01/call. Returns: full profile, current employer, mobile, personal email.
async function stageNinjaPear(c: CandidateRow, linkedinUrl?: string): Promise<Record<string, unknown>> {
  if (!NINJAPEAR_API_KEY || !linkedinUrl) return {};
  try {
    const url = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}&extra=include&personal_contact_number=include&personal_email=include`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${NINJAPEAR_API_KEY}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[NinjaPear] HTTP ${res.status} for ${c.full_name}`);
      return {};
    }
    const data = await res.json();
    const currentExp = (data.experiences || []).find((e: any) => !e.ends_at) || data.experiences?.[0];
    return {
      ninjapear_employer: currentExp?.company,
      ninjapear_title: currentExp?.title,
      ninjapear_mobile: data.personal_numbers?.[0],
      ninjapear_email: data.personal_emails?.[0],
      ninjapear_city: data.city,
      ninjapear_occupation: data.occupation,
      // Map into canonical fields
      current_employer: currentExp?.company,
      current_title: currentExp?.title,
      pdl_mobile_phone: data.personal_numbers?.[0],
      pdl_personal_email: data.personal_emails?.[0],
    };
  } catch (e) {
    console.warn(`[NinjaPear] error: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
}

// ===== STAGE 7C: Crustdata (v2 Person API) — enrich by LinkedIn URL =====
// Uses POST /person/enrich with Bearer auth + x-api-version header (verified Apr 2026).
// If no LinkedIn URL is on the candidate yet, falls back to /person/search by name+location.
async function stageCrustdata(c: CandidateRow): Promise<Record<string, unknown>> {
  if (!CRUSTDATA_API_KEY) return {};
  const headers = {
    "Authorization": `Bearer ${CRUSTDATA_API_KEY}`,
    "Content-Type": "application/json",
    "x-api-version": "2025-11-01",
  };
  try {
    let linkedinUrl = c.linkedin_url || "";

    // Step 1: if no LinkedIn URL, try /person/search by name + location
    if (!linkedinUrl) {
      const fullName = c.full_name || c.name;
      if (!fullName) return {};
      const searchRes = await fetch("https://api.crustdata.com/person/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: fullName,
          location: c.city ? `${c.city}, Michigan, US` : "Michigan, US",
          page_size: 3,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!searchRes.ok) {
        console.warn(`[Crustdata search] HTTP ${searchRes.status} for ${fullName}`);
        return {};
      }
      const searchData = await searchRes.json();
      const profiles = searchData?.profiles || searchData?.results || searchData?.data || [];
      const first = Array.isArray(profiles) ? profiles[0] : null;
      linkedinUrl = first?.linkedin_profile_url || first?.linkedin_url || "";
      if (!linkedinUrl) return {};
    }

    // Step 2: enrich the LinkedIn URL
    const enrichRes = await fetch("https://api.crustdata.com/person/enrich", {
      method: "POST",
      headers,
      body: JSON.stringify({ professional_network_profile_urls: [linkedinUrl] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!enrichRes.ok) {
      console.warn(`[Crustdata enrich] HTTP ${enrichRes.status} for ${linkedinUrl}`);
      return {};
    }
    const enrichData = await enrichRes.json();
    const arr = Array.isArray(enrichData) ? enrichData : (enrichData?.data || enrichData?.results || []);
    const p = arr?.[0];
    if (!p) return {};

    // Crustdata v2 schema: current_employer is usually under p.employer or p.current_employers[0]
    const currentEmp = p.current_employers?.[0] || p.employer || {};
    const email = p.email || p.work_email || p.business_email || p.personal_email;
    const phone = p.phone_number || p.mobile_phone || p.phone;

    return {
      crustdata_linkedin: linkedinUrl,
      crustdata_email: email,
      crustdata_phone: phone,
      crustdata_employer: currentEmp.company_name || p.current_company_name,
      crustdata_title: currentEmp.title || p.title || p.headline,
      // Canonical mapping (only fill if not already present)
      linkedin_url: linkedinUrl,
      pdl_personal_email: email,
      pdl_mobile_phone: phone,
      current_employer: currentEmp.company_name || p.current_company_name,
      current_title: currentEmp.title || p.title,
    };
  } catch (e) {
    console.warn(`[Crustdata] error: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
}


async function stageClay(c: CandidateRow): Promise<Record<string, unknown>> {
  if (!CLAY_API_KEY || (c.score ?? 0) < 7) return {};
  try {
    const res = await fetch("https://api.clay.com/v1/people/enrich", {
      method: "POST",
      headers: { Authorization: `Bearer ${CLAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: c.full_name || c.name,
        location: c.city ? `${c.city}, MI, US` : "MI, US",
        company: c.current_employer || undefined,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return {
      clay_email: data?.email,
      clay_phone: data?.phone,
      clay_linkedin: data?.linkedin_url,
    };
  } catch { return {}; }
}

// ===== AI Synthesis (cheap helper — Gemini 2.5 Flash Lite via Lovable AI Gateway) =====
async function synthesize(c: CandidateRow, merged: Record<string, unknown>): Promise<{ qualifications_summary: string; hiring_recommendation: string }> {
  const prompt = `Write a brief candidate dossier based on this research:

CANDIDATE: ${c.full_name || c.name}
TRADE: ${c.license_type || "Unknown"}
LICENSE #: ${c.license_number || "n/a"}
CITY: ${c.city || "Michigan"}
RESEARCH: ${JSON.stringify(merged, null, 2)}

Output two short fields:
- qualifications_summary: 2-3 sentences on credentials, experience, and trade specialty.
- hiring_recommendation: 2-3 sentences with urgency level and best contact channel.

Rules: Write as a human researcher. Never mention AI, algorithms, data sources, or methodology.`;

  const r = await cheapExtract<{ qualifications_summary: string; hiring_recommendation: string }>(prompt, {
    task: "summary_short",
    schema: Schemas.candidateSummary as Record<string, unknown>,
    maxTokens: 600,
    caller: "candidate-deep-enrich",
  });
  if (!r.ok || !r.data) return { qualifications_summary: "", hiring_recommendation: "" };
  return {
    qualifications_summary: r.data.qualifications_summary || "",
    hiring_recommendation: r.data.hiring_recommendation || "",
  };
}

// Reject booleans, "true"/"false" strings, and empty/garbage values.
// Crustdata + some PDL responses return `email: true` as a "exists, upgrade to view" flag,
// which previously poisoned the phone/email columns with the literal string "true".
function cleanContact(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  if (lower === "true" || lower === "false" || lower === "null" || lower === "undefined") return undefined;
  return s;
}
function cleanEmail(v: unknown): string | undefined {
  const s = cleanContact(v);
  if (!s) return undefined;
  // must contain @ and a dot
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return undefined;
  return s.toLowerCase();
}
function cleanPhone(v: unknown): string | undefined {
  const s = cleanContact(v);
  if (!s) return undefined;
  // must have at least 7 digits to be a real phone
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7) return undefined;
  return s;
}

function pickContact(merged: Record<string, any>): { email?: string; phone?: string } {
  const email = cleanEmail(merged.pdl_personal_email)
    || cleanEmail(merged.hunter_email)
    || cleanEmail(merged.snov_email)
    || cleanEmail(merged.lusha_email)
    || cleanEmail(merged.clay_email)
    || cleanEmail(merged.email);
  const phone = cleanPhone(merged.pdl_mobile_phone)
    || cleanPhone(merged.lusha_phone)
    || cleanPhone(merged.clay_phone)
    || cleanPhone(merged.npi_business_phone)
    || cleanPhone(merged.phone);
  return { email, phone };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const idsParam = url.searchParams.get("ids");

  let q = sb.from("hire_alert_candidates")
    .select("id, full_name, name, license_type, license_number, license_expiry, city, state, email, phone, source, score, current_employer, linkedin_url, raw_data")
    .neq("is_company_name", true)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (idsParam) {
    q = q.in("id", idsParam.split(",").map((s) => s.trim()));
  } else if (!force) {
    q = q.eq("enrichment_status", "pending");
  }

  const { data: candidates, error: fetchErr } = await q;
  if (fetchErr) {
    console.error("[deep-enrich]", fetchErr.message);
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: corsHeaders });
  }
  if (!candidates?.length) {
    return new Response(JSON.stringify({ enriched: 0, message: "no candidates to enrich" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  console.log(`[deep-enrich] Processing ${candidates.length} candidates (force=${force})`);
  let enriched = 0, exhausted = 0, errors = 0;

  for (const c of candidates as CandidateRow[]) {
    try {
      await sb.from("hire_alert_candidates").update({ enrichment_status: "enriching" }).eq("id", c.id);
      const merged: Record<string, any> = {};

      // Stage 1 baseline
      await logStage(sb, c.id, "1_license", c.source || "unknown", ["name", "license_type"], 0, true);

      // Stage 2 NPI (healthcare only)
      const npi = await stageNPI(c);
      if (Object.keys(npi).length) {
        Object.assign(merged, npi);
        await logStage(sb, c.id, "2_npi", "npiregistry", Object.keys(npi), 0, true, undefined, npi);
      }

      // Stage 3 PDL
      const pdl = await stagePDL(c);
      if (Object.keys(pdl).length) {
        Object.assign(merged, pdl);
        await logStage(sb, c.id, "3_pdl", "peopledatalabs", Object.keys(pdl), 0.28, true, undefined, pdl);
      }

      // Stage 4 Hunter (needs employer)
      const hunter = await stageHunter(c, merged.current_employer as string);
      if (Object.keys(hunter).length) {
        Object.assign(merged, hunter);
        await logStage(sb, c.id, "4_hunter", "hunter.io", Object.keys(hunter), 0.034, true, undefined, hunter);
      }

      // Stage 5 Snov (verify or finder)
      const snov = await stageSnov(c, merged.company_domain as string, merged.hunter_email as string);
      if (Object.keys(snov).length) {
        Object.assign(merged, snov);
        await logStage(sb, c.id, "5_snov", "snov.io", Object.keys(snov), 0.012, true, undefined, snov);
      }

      // Stage 6 Lusha
      const { email: e1, phone: p1 } = pickContact(merged);
      if (!p1) {
        const lusha = await stageLusha(c);
        if (Object.keys(lusha).length) {
          Object.assign(merged, lusha);
          await logStage(sb, c.id, "6_lusha", "lusha", Object.keys(lusha), 0.40, true, undefined, lusha);
        }
      }

      // Stage 7 Sonar (only if still missing core fields)
      const { email: e2, phone: p2 } = pickContact(merged);
      if (!e2 || !p2 || !merged.linkedin_url) {
        const sonar = await stageSonar(c);
        if (Object.keys(sonar).length) {
          Object.assign(merged, sonar);
          await logStage(sb, c.id, "7_sonar", "openrouter/sonar-pro", Object.keys(sonar), 0.005, true, undefined, sonar);
        }
      }

      // Stage 7B NinjaPear (Proxycurl) — fires when LinkedIn URL exists AND still no contact/employer
      const { email: e2b, phone: p2b } = pickContact(merged);
      if (merged.linkedin_url && (!e2b || !p2b || !merged.current_employer)) {
        const np = await stageNinjaPear(c, merged.linkedin_url as string);
        if (Object.keys(np).length) {
          Object.assign(merged, np);
          await logStage(sb, c.id, "7b_ninjapear", "nubela_proxycurl", Object.keys(np), 0.01, true, undefined, np);
        }
      }

      // Stage 7C Crustdata — trial fallback when still missing critical fields
      const { email: e2c, phone: p2c } = pickContact(merged);
      if (!e2c && !p2c && !merged.linkedin_url) {
        const cd = await stageCrustdata(c);
        if (Object.keys(cd).length) {
          Object.assign(merged, cd);
          await logStage(sb, c.id, "7c_crustdata", "crustdata", Object.keys(cd), 0.05, true, undefined, cd);
        }
      }

      const { email: e3, phone: p3 } = pickContact(merged);
      if (!e3 && !p3 && (c.score ?? 0) >= 7) {
        const clay = await stageClay(c);
        if (Object.keys(clay).length) {
          Object.assign(merged, clay);
          await logStage(sb, c.id, "8_clay", "clay.com", Object.keys(clay), 0.50, true, undefined, clay);
        }
      }

      // Synthesize
      const { qualifications_summary, hiring_recommendation } = await synthesize(c, merged);

      // Final picks
      const { email: finalEmail, phone: finalPhone } = pickContact(merged);
      const hasContact = !!(finalEmail || finalPhone);

      const update: Record<string, unknown> = {
        enrichment_status: hasContact ? "complete" : "exhausted",
        enriched_at: new Date().toISOString(),
      };
      if (finalEmail && !c.email) update.email = finalEmail;
      if (finalPhone && !c.phone) update.phone = finalPhone;
      if (merged.linkedin_url) update.linkedin_url = merged.linkedin_url;
      if (merged.facebook_url) update.facebook_url = merged.facebook_url;
      if (merged.current_employer) update.current_employer = merged.current_employer;
      if (merged.current_title) update.current_title = merged.current_title;
      if (merged.years_experience) update.years_experience = merged.years_experience;
      if (qualifications_summary) update.qualifications_summary = qualifications_summary;
      if (hiring_recommendation) update.hiring_recommendation = hiring_recommendation;

      const social: Record<string, any> = {};
      if (merged.linkedin_url) social.linkedin = merged.linkedin_url;
      if (merged.facebook_url) social.facebook = merged.facebook_url;
      if (Object.keys(social).length) update.social_profiles = social;

      // Recompute completeness
      const fields = ["full_name", "license_type", "license_number", "city", "phone", "email", "linkedin_url", "current_employer"];
      const present = fields.filter((f) => (update as any)[f] || (c as any)[f]).length;
      update.data_completeness = Math.round((present / fields.length) * 100);

      const { error: upErr } = await sb.from("hire_alert_candidates").update(update).eq("id", c.id);
      if (upErr) {
        console.error(`[deep-enrich] update error: ${upErr.message}`);
        errors++;
        continue;
      }
      hasContact ? enriched++ : exhausted++;
      console.log(`[deep-enrich] ${hasContact ? "✅" : "⚪"} ${c.full_name || c.name} — email=${!!finalEmail} phone=${!!finalPhone} li=${!!merged.linkedin_url}`);
    } catch (e) {
      console.error(`[deep-enrich] error: ${e instanceof Error ? e.message : String(e)}`);
      await sb.from("hire_alert_candidates").update({ enrichment_status: "error" }).eq("id", c.id);
      errors++;
    }
  }

  await sb.from("agent_heartbeats").upsert({
    agent_name: "candidate-deep-enrich",
    last_beat: new Date().toISOString(),
    metadata: { enriched, exhausted, errors, batch_size: candidates.length },
  }, { onConflict: "agent_name" });

  console.log(`[deep-enrich] done: enriched=${enriched} exhausted=${exhausted} errors=${errors}`);
  return new Response(
    JSON.stringify({ enriched, exhausted, errors, total: candidates.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

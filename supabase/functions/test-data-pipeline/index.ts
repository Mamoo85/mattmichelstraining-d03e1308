// test-data-pipeline — standalone validation sandbox
// Manually invoke to test full enrichment chain.
// Accepts { "industry_type": "healthcare" | "industrial_trades" }
// Healthcare: NPI → Nursys (stub) → Sonar → PDL (stub) → No Ghost Lead
// Industrial: Michigan LARA (stub) → Sonar → PDL (stub) → No Ghost Lead
// NEVER added to any cron job.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const NURSYS_API_KEY = Deno.env.get("NURSYS_API_KEY") || "";
const NURSYS_BASE_URL = Deno.env.get("NURSYS_BASE_URL") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";

type IndustryType = "healthcare" | "industrial_trades";

interface TestCandidate {
  first_name: string;
  last_name: string;
  title: string;
  city: string;
  state: string;
  license_number?: string;
}

const HEALTHCARE_CANDIDATE: TestCandidate = {
  first_name: "Sarah",
  last_name: "Johnson",
  title: "Registered Nurse",
  city: "Detroit",
  state: "MI",
  license_number: "4301999999",
};

const INDUSTRIAL_CANDIDATE: TestCandidate = {
  first_name: "Mike",
  last_name: "Thompson",
  title: "High-Pressure Boiler Operator",
  city: "Dearborn",
  state: "MI",
  license_number: "BP-2024-00001",
};

// ─── JSON Regex Stripper ───────────────────────────────────────
function extractJSON(raw: string): string {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return match ? match[1] : cleaned.trim();
}

// ─── Normalized Government Data Result ─────────────────────────
// Both NPI and LARA return this shape so downstream doesn't care about source
interface GovDataResult {
  source: string;
  license_id: string | null;
  business_phone: string | null;
  license_type: string | null;
  license_desc: string | null;
  practice_address: string | null;
  elapsed_ms: number;
  skipped_reason: string | null;
}

// ─── NPI Registry API (Free, No Auth) ──────────────────────────
async function enrichViaNPI(firstName: string, lastName: string, state: string): Promise<GovDataResult> {
  const start = Date.now();
  const empty: GovDataResult = { source: "NPI", license_id: null, business_phone: null, license_type: null, license_desc: null, practice_address: null, elapsed_ms: 0, skipped_reason: null };
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&state=${encodeURIComponent(state)}&enumeration_type=NPI-1&limit=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) { await res.text(); return { ...empty, elapsed_ms: Date.now() - start }; }
    const data = await res.json();
    const results = data?.results;
    if (!results || results.length === 0) return { ...empty, elapsed_ms: Date.now() - start };

    const r = results[0];
    const practiceAddr = r.addresses?.find((a: any) => a.address_purpose === "LOCATION");
    const taxonomy = r.taxonomies?.[0];

    return {
      source: "NPI",
      license_id: r.number?.toString() || null,
      business_phone: practiceAddr?.telephone_number || null,
      license_type: taxonomy?.code || null,
      license_desc: taxonomy?.desc || null,
      practice_address: practiceAddr
        ? `${practiceAddr.address_1 || ""}, ${practiceAddr.city || ""}, ${practiceAddr.state || ""} ${practiceAddr.postal_code || ""}`.trim()
        : null,
      elapsed_ms: Date.now() - start,
      skipped_reason: null,
    };
  } catch (e) {
    console.error("[NPI] Error:", e);
    return { ...empty, elapsed_ms: Date.now() - start, skipped_reason: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Michigan LARA GIS Open Data API (Stub) ────────────────────
// Targets DTMB GIS Open Data portal for licensed tradesmen:
// Master Plumbers, HVAC Contractors, Electricians, High-Pressure Boiler Operators
// Also checks MIOSHA Boiler Division records
async function queryMichiganLARA(firstName: string, lastName: string, _state: string): Promise<GovDataResult> {
  const start = Date.now();
  // TODO: Replace with real Michigan LARA GIS Open Data REST API call
  // Endpoint pattern: https://gis.michigan.opendata.arcgis.com/api/...
  // Also check MIOSHA Boiler Division: https://www.michigan.gov/leo/bureaus-agencies/miosha
  console.log(`[LARA] Stub lookup for ${firstName} ${lastName} — will hit Michigan GIS Open Data API when integrated`);

  // Return stub data shaped identically to NPI result
  return {
    source: "LARA_MIOSHA",
    license_id: null,
    business_phone: null,
    license_type: null,
    license_desc: null,
    practice_address: null,
    elapsed_ms: Date.now() - start,
    skipped_reason: "LARA GIS integration pending — stub mode",
  };
}

// ─── Nursys e-Notify API (Async POST/GET per v3.1.5 spec) ─────
interface NursysResult {
  license_status: string | null;
  multistate: boolean | null;
  discipline: boolean | null;
  elapsed_ms: number;
  skipped_reason: string | null;
}

async function nursysPostLookup(licenseNumber: string): Promise<{ transactionId: string | null; error: string | null }> {
  if (!NURSYS_API_KEY || !NURSYS_BASE_URL) {
    return { transactionId: null, error: "NURSYS_API_KEY or NURSYS_BASE_URL not configured — skipping" };
  }
  try {
    const res = await fetch(`${NURSYS_BASE_URL}/nurselookup`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${NURSYS_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ LicenseNumber: licenseNumber }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) { const t = await res.text(); return { transactionId: null, error: `Nursys POST ${res.status}: ${t}` }; }
    const data = await res.json();
    return { transactionId: data?.TransactionId || null, error: null };
  } catch (e) {
    return { transactionId: null, error: `Nursys POST exception: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function nursysGetLookup(transactionId: string): Promise<NursysResult> {
  const start = Date.now();
  const empty: NursysResult = { license_status: null, multistate: null, discipline: null, elapsed_ms: 0, skipped_reason: null };
  if (!NURSYS_API_KEY || !NURSYS_BASE_URL) {
    return { ...empty, skipped_reason: "Not configured" };
  }
  try {
    const res = await fetch(`${NURSYS_BASE_URL}/nurselookup/${transactionId}`, {
      headers: { "Authorization": `Bearer ${NURSYS_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) { await res.text(); return { ...empty, elapsed_ms: Date.now() - start, skipped_reason: `GET ${res.status}` }; }
    const data = await res.json();
    const resp = data?.NurseLookupResponses?.[0];
    return {
      license_status: resp?.LicenseStatus || null,
      multistate: resp?.MultistatePrivilege ?? null,
      discipline: resp?.HasDiscipline ?? null,
      elapsed_ms: Date.now() - start,
      skipped_reason: null,
    };
  } catch (e) {
    return { ...empty, elapsed_ms: Date.now() - start, skipped_reason: e instanceof Error ? e.message : String(e) };
  }
}

async function enrichViaNursys(licenseNumber: string): Promise<NursysResult> {
  const start = Date.now();
  if (!NURSYS_API_KEY) {
    return { license_status: null, multistate: null, discipline: null, elapsed_ms: 0, skipped_reason: "NURSYS_API_KEY not set — stub mode" };
  }
  const post = await nursysPostLookup(licenseNumber);
  if (!post.transactionId) {
    return { license_status: null, multistate: null, discipline: null, elapsed_ms: Date.now() - start, skipped_reason: post.error };
  }
  await new Promise(r => setTimeout(r, 2000));
  return nursysGetLookup(post.transactionId);
}

// ─── Sonar Deep Dork (perplexity/sonar-pro via OpenRouter) ─────
interface SonarResult {
  linkedin_url: string | null;
  facebook_url: string | null;
  email: string | null;
  phone: string | null;
  indeed_resume: string | null;
  elapsed_ms: number;
}

async function enrichViaSonar(name: string, title: string, city: string): Promise<SonarResult> {
  const start = Date.now();
  const empty: SonarResult = { linkedin_url: null, facebook_url: null, email: null, phone: null, indeed_resume: null, elapsed_ms: 0 };
  if (!OPENROUTER_API_KEY) return { ...empty, elapsed_ms: Date.now() - start };

  const prompt = `Search the public web for ${name}, a ${title} in ${city}, Michigan.
Use standard boolean search operators:
site:linkedin.com/in/ "${name}" "${city}"
AND site:indeed.com/r/ "${name}"
AND site:facebook.com "${name}" "${city}"

Extract their public LinkedIn profile URL, Facebook profile URL, any public email addresses, and phone numbers found on public profiles or resumes.

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "linkedin_url": "https://linkedin.com/in/..." or null,
  "facebook_url": "https://facebook.com/..." or null,
  "email": "user@example.com" or null,
  "phone": "+1XXXXXXXXXX" or null,
  "indeed_resume": "https://indeed.com/r/..." or null
}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "perplexity/sonar-pro", max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { await res.text(); return { ...empty, elapsed_ms: Date.now() - start }; }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const jsonStr = extractJSON(raw);
    const parsed = JSON.parse(jsonStr);
    return {
      linkedin_url: parsed.linkedin_url || null,
      facebook_url: parsed.facebook_url || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      indeed_resume: parsed.indeed_resume || null,
      elapsed_ms: Date.now() - start,
    };
  } catch (e) {
    console.error("[Sonar] Error:", e);
    return { ...empty, elapsed_ms: Date.now() - start };
  }
}

// ─── People Data Labs (PDL) — Identity Resolution ──────────────
interface PDLResult {
  mobile_phone: string | null;
  personal_email: string | null;
  work_email: string | null;
  job_title: string | null;
  company: string | null;
  elapsed_ms: number;
  skipped_reason: string | null;
}

async function enrichWithPDL(name: string, location: string, linkedinUrl: string | null): Promise<PDLResult> {
  const start = Date.now();
  const empty: PDLResult = { mobile_phone: null, personal_email: null, work_email: null, job_title: null, company: null, elapsed_ms: 0, skipped_reason: null };
  if (!PDL_API_KEY) {
    return { ...empty, skipped_reason: "PDL_API_KEY not set — stub mode" };
  }
  try {
    const params: Record<string, string> = { api_key: PDL_API_KEY, name, location };
    if (linkedinUrl) params.profile = linkedinUrl;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${qs}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) { const t = await res.text(); return { ...empty, elapsed_ms: Date.now() - start, skipped_reason: `PDL ${res.status}: ${t.slice(0, 200)}` }; }
    const data = await res.json();
    return {
      mobile_phone: data?.mobile_phone || null,
      personal_email: data?.personal_emails?.[0] || null,
      work_email: data?.work_email || null,
      job_title: data?.job_title || null,
      company: data?.job_company_name || null,
      elapsed_ms: Date.now() - start,
      skipped_reason: null,
    };
  } catch (e) {
    return { ...empty, elapsed_ms: Date.now() - start, skipped_reason: e instanceof Error ? e.message : String(e) };
  }
}

// ─── No Ghost Lead Validation ──────────────────────────────────
function hasActionableContact(data: Record<string, any>): boolean {
  return !!(data.linkedin_url || data.facebook_url || data.email || data.phone || data.business_phone || data.mobile_phone || data.personal_email);
}

// ─── Main Handler ──────────────────────────────────────────────
serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const totalStart = Date.now();

  // Parse industry_type from body (defaults to healthcare)
  let industryType: IndustryType = "healthcare";
  try {
    const body = await req.json();
    if (body?.industry_type === "industrial_trades") industryType = "industrial_trades";
  } catch {
    // No body or invalid JSON — use default
  }

  const candidate = industryType === "healthcare" ? HEALTHCARE_CANDIDATE : INDUSTRIAL_CANDIDATE;
  console.log(`[test-data-pipeline] Industry: ${industryType} | Candidate: ${candidate.first_name} ${candidate.last_name} (${candidate.title})`);

  // ─── Phase 1: Government Database (industry-routed) ────────
  let govResult: GovDataResult;
  let nursysResult: NursysResult | null = null;

  if (industryType === "healthcare") {
    // Healthcare: NPI + Nursys in parallel
    const [npi, nursys] = await Promise.all([
      enrichViaNPI(candidate.first_name, candidate.last_name, candidate.state),
      enrichViaNursys(candidate.license_number || ""),
    ]);
    govResult = npi;
    nursysResult = nursys;
    console.log(`[NPI] ${govResult.elapsed_ms}ms — ID: ${govResult.license_id}, Phone: ${govResult.business_phone}`);
    console.log(`[Nursys] ${nursysResult.elapsed_ms}ms — ${nursysResult.skipped_reason || nursysResult.license_status}`);
  } else {
    // Industrial: Michigan LARA/MIOSHA
    govResult = await queryMichiganLARA(candidate.first_name, candidate.last_name, candidate.state);
    console.log(`[LARA] ${govResult.elapsed_ms}ms — ${govResult.skipped_reason || govResult.license_id}`);
  }

  // ─── Phase 2: Sonar Deep Dork (universal) ──────────────────
  const sonarResult = await enrichViaSonar(
    `${candidate.first_name} ${candidate.last_name}`,
    candidate.title,
    candidate.city,
  );
  console.log(`[Sonar] ${sonarResult.elapsed_ms}ms — LinkedIn: ${sonarResult.linkedin_url}, Email: ${sonarResult.email}`);

  // ─── Phase 3: PDL Skip-Trace (universal) ───────────────────
  const pdlResult = await enrichWithPDL(
    `${candidate.first_name} ${candidate.last_name}`,
    `${candidate.city}, ${candidate.state}`,
    sonarResult.linkedin_url,
  );
  console.log(`[PDL] ${pdlResult.elapsed_ms}ms — ${pdlResult.skipped_reason || `Mobile: ${pdlResult.mobile_phone}`}`);

  // ─── Merge all data ────────────────────────────────────────
  const merged: Record<string, any> = {
    name: `${candidate.first_name} ${candidate.last_name}`,
    title: candidate.title,
    city: candidate.city,
    industry_type: industryType,
    // Government data (normalized)
    gov_source: govResult.source,
    license_id: govResult.license_id,
    business_phone: govResult.business_phone,
    license_type: govResult.license_type,
    license_desc: govResult.license_desc,
    practice_address: govResult.practice_address,
    gov_skipped: govResult.skipped_reason,
    // Nursys (healthcare only)
    ...(nursysResult ? {
      license_status: nursysResult.license_status,
      multistate: nursysResult.multistate,
      discipline: nursysResult.discipline,
      nursys_skipped: nursysResult.skipped_reason,
    } : {}),
    // Sonar
    linkedin_url: sonarResult.linkedin_url,
    facebook_url: sonarResult.facebook_url,
    email: sonarResult.email,
    phone: sonarResult.phone,
    indeed_resume: sonarResult.indeed_resume,
    // PDL
    mobile_phone: pdlResult.mobile_phone,
    personal_email: pdlResult.personal_email,
    work_email: pdlResult.work_email,
    pdl_job_title: pdlResult.job_title,
    pdl_company: pdlResult.company,
    pdl_skipped: pdlResult.skipped_reason,
  };

  const isActionable = hasActionableContact(merged);

  const result = {
    industry_type: industryType,
    candidate: merged,
    is_actionable: isActionable,
    ghost_lead_dropped: !isActionable,
    timing: {
      gov_ms: govResult.elapsed_ms,
      ...(nursysResult ? { nursys_ms: nursysResult.elapsed_ms } : {}),
      sonar_ms: sonarResult.elapsed_ms,
      pdl_ms: pdlResult.elapsed_ms,
      total_ms: Date.now() - totalStart,
    },
    api_status: {
      gov_database: govResult.skipped_reason ? `⏭ ${govResult.skipped_reason}` : (govResult.license_id ? "✅ Found" : "❌ No match"),
      ...(nursysResult ? {
        nursys: nursysResult.skipped_reason ? `⏭ ${nursysResult.skipped_reason}` : (nursysResult.license_status ? "✅ Found" : "❌ No match"),
      } : {}),
      sonar: sonarResult.linkedin_url || sonarResult.email ? "✅ Found data" : "❌ No matches",
      pdl: pdlResult.skipped_reason ? `⏭ ${pdlResult.skipped_reason}` : (pdlResult.mobile_phone ? "✅ Found" : "❌ No match"),
    },
  };

  console.log(`[test-data-pipeline] Complete in ${result.timing.total_ms}ms. Industry: ${industryType}. Actionable: ${isActionable}`);

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

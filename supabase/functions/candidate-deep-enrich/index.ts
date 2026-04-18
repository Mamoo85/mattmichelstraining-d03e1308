// candidate-deep-enrich — 8-stage enrichment waterfall for Talent Radar candidates
// Runs every 30 minutes via cron. Picks up candidates with enrichment_status='pending'.
//
// STAGES (each logged to candidate_enrichment_log):
//  1. License-source     — already-have data baseline
//  2. NPI Registry       — free; healthcare workers only
//  3. PDL                — mobile phone, personal email, LinkedIn, employer
//  4. Hunter.io          — email by name+domain (needs employer)
//  5. Snov.io            — email finder + verification
//  6. Lusha              — mobile/direct dial fallback
//  7. Sonar OSINT        — open-web fallback for social + employer
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
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&state=MI&limit=5`;
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

// ===== STAGE 3: People Data Labs =====
async function stagePDL(c: CandidateRow): Promise<Record<string, unknown>> {
  if (!PDL_API_KEY) return {};
  try {
    const params: Record<string, string> = {
      name: c.full_name || c.name,
      "location.region": "michigan",
      pretty: "false",
    };
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${qs}`, {
      headers: { "X-API-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const data = await res.json();
    if (data.status !== 200) return {};
    const p = data.data || {};
    return {
      pdl_mobile_phone: p.mobile_phone,
      pdl_personal_email: p.personal_emails?.[0],
      linkedin_url: p.linkedin_url,
      current_employer: p.job_company_name,
      current_title: p.job_title,
      years_experience: p.inferred_years_experience,
      facebook_url: p.facebook_url,
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
    return parsed || {};
  } catch { return {}; }
}

// ===== STAGE 8: Clay (premium waterfall, score >= 7 only) =====
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

function pickContact(merged: Record<string, any>): { email?: string; phone?: string } {
  const email = merged.pdl_personal_email || merged.hunter_email || merged.snov_email || merged.lusha_email || merged.clay_email || merged.email;
  const phone = merged.pdl_mobile_phone || merged.lusha_phone || merged.clay_phone || merged.npi_business_phone || merged.phone;
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

      // Stage 8 Clay (premium, score >= 7 only, only if still no contact)
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

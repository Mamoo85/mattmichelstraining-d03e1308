// enrich-candidate-manual — single-row enrichment triggered from admin Workbench.
// Waterfall: PDL → Hunter → Snov → Sonar OSINT → TruePeopleSearch → FastPeopleSearch → Spokeo → Facebook public profile
// Writes phone/email/employer/title/linkedin back to hire_alert_candidates.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const SNOV_USER_ID = Deno.env.get("SNOV_USER_ID") || "";
const SNOV_API_KEY = Deno.env.get("SNOV_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Updates {
  phone?: string;
  email?: string;
  current_employer?: string;
  current_title?: string;
  linkedin_url?: string;
  enriched_at?: string;
  enrichment_status?: string;
}

// ────────────────── helpers ──────────────────
function pickPhone(text: string): string | null {
  const m = text.match(/\(?\b\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/);
  return m ? m[0] : null;
}
function pickEmail(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

// ────────────────── PDL ──────────────────
async function pdlEnrich(name: string, city: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!PDL_API_KEY) return { ok: false, updates: {}, raw: { skipped: "no_key" } };
  const params = new URLSearchParams({
    name, "location.region": "michigan", pretty: "false", titlecase: "true", min_likelihood: "3",
  });
  if (city && city.toLowerCase() !== "michigan") params.set("location.locality", city);
  try {
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { "X-API-Key": PDL_API_KEY }, signal: AbortSignal.timeout(20_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.data) return { ok: false, updates: {}, raw: json };
    const p = json.data;
    const updates: Updates = {};
    if (p.mobile_phone) updates.phone = p.mobile_phone;
    if (p.personal_emails?.[0]) updates.email = p.personal_emails[0];
    if (p.work_email && !updates.email) updates.email = p.work_email;
    if (p.job_company_name) updates.current_employer = p.job_company_name;
    if (p.job_title) updates.current_title = p.job_title;
    if (p.linkedin_url) updates.linkedin_url = p.linkedin_url.startsWith("http") ? p.linkedin_url : `https://${p.linkedin_url}`;
    return { ok: Object.keys(updates).length > 0, updates, raw: { likelihood: json.likelihood } };
  } catch (e) { return { ok: false, updates: {}, raw: { error: String(e) } }; }
}

// ────────────────── Hunter ──────────────────
async function hunterEnrich(employer: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!HUNTER_API_KEY || !employer) return { ok: false, updates: {}, raw: { skipped: !employer ? "no_employer" : "no_key" } };
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?company=${encodeURIComponent(employer)}&api_key=${HUNTER_API_KEY}&limit=3`,
      { signal: AbortSignal.timeout(15_000) }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, updates: {}, raw: json };
    const emails = json?.data?.emails || [];
    const updates: Updates = {};
    if (emails[0]?.value) updates.email = emails[0].value;
    return { ok: !!updates.email, updates, raw: { domain: json?.data?.domain, count: emails.length } };
  } catch (e) { return { ok: false, updates: {}, raw: { error: String(e) } }; }
}

// ────────────────── Snov ──────────────────
async function snovEnrich(name: string, employer: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!SNOV_USER_ID || !SNOV_API_KEY || !employer || !name) {
    return { ok: false, updates: {}, raw: { skipped: !employer ? "no_employer" : "no_creds_or_name" } };
  }
  try {
    // Get token
    const tokenRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_USER_ID}&client_secret=${SNOV_API_KEY}`,
      signal: AbortSignal.timeout(10_000),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    const token = tokenJson?.access_token;
    if (!token) return { ok: false, updates: {}, raw: { error: "no_token" } };

    const [first, ...rest] = name.split(/\s+/);
    const last = rest.join(" ");
    const params = new URLSearchParams({
      access_token: token, firstName: first || "", lastName: last || "", domain: employer,
    });
    const res = await fetch(`https://api.snov.io/v2/email-finder?${params}`, {
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => ({}));
    const updates: Updates = {};
    if (json?.data?.email) updates.email = json.data.email;
    return { ok: !!updates.email, updates, raw: { found: !!updates.email } };
  } catch (e) { return { ok: false, updates: {}, raw: { error: String(e) } }; }
}

// ────────────────── Sonar OSINT ──────────────────
async function sonarEnrich(name: string, city: string | null, license_type: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!OPENROUTER_API_KEY) return { ok: false, updates: {}, raw: { skipped: "no_openrouter_key" } };
  const query = `Find LinkedIn profile, current employer, current job title, and any public phone/email for: ${name}${city ? `, located in ${city}, Michigan` : ", in Michigan"}${license_type ? `, working as ${license_type}` : ""}. Return STRICT JSON only with keys: linkedin_url (string|null), current_employer (string|null), current_title (string|null), phone (string|null), email (string|null). No markdown. No commentary.`;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: query }],
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const json = await res.json().catch(() => ({}));
    const content: string = json?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, updates: {}, raw: { content_preview: content.slice(0, 300) } };
    const parsed = JSON.parse(jsonMatch[0]);
    const updates: Updates = {};
    if (parsed.linkedin_url && /linkedin\.com/i.test(parsed.linkedin_url)) updates.linkedin_url = parsed.linkedin_url;
    if (parsed.current_employer) updates.current_employer = parsed.current_employer;
    if (parsed.current_title) updates.current_title = parsed.current_title;
    if (parsed.phone && /\d{3}/.test(parsed.phone)) updates.phone = parsed.phone;
    if (parsed.email && /@/.test(parsed.email)) updates.email = parsed.email;
    return { ok: Object.keys(updates).length > 0, updates, raw: parsed };
  } catch (e) { return { ok: false, updates: {}, raw: { error: String(e) } }; }
}

// ────────────────── Firecrawl helper for OSINT scrapes ──────────────────
async function firecrawlScrape(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(20_000),
    });
    const json = await res.json().catch(() => ({}));
    return json?.data?.markdown || json?.markdown || null;
  } catch { return null; }
}

// ────────────────── TruePeopleSearch ──────────────────
async function truePeopleSearchEnrich(name: string, city: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!FIRECRAWL_API_KEY || !name) return { ok: false, updates: {}, raw: { skipped: "no_key_or_name" } };
  const slug = name.trim().replace(/\s+/g, "-");
  const url = city
    ? `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(slug)}&citystatezip=${encodeURIComponent(city + ", MI")}`
    : `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(slug)}&citystatezip=MI`;
  const md = await firecrawlScrape(url);
  if (!md) return { ok: false, updates: {}, raw: { error: "scrape_failed" } };
  const updates: Updates = {};
  const phone = pickPhone(md);
  if (phone) updates.phone = phone;
  return { ok: !!phone, updates, raw: { url, found_phone: !!phone } };
}

// ────────────────── FastPeopleSearch ──────────────────
async function fastPeopleSearchEnrich(name: string, city: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!FIRECRAWL_API_KEY || !name) return { ok: false, updates: {}, raw: { skipped: "no_key_or_name" } };
  const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
  const url = city
    ? `https://www.fastpeoplesearch.com/name/${encodeURIComponent(slug)}_${encodeURIComponent(city.toLowerCase())}-mi`
    : `https://www.fastpeoplesearch.com/name/${encodeURIComponent(slug)}`;
  const md = await firecrawlScrape(url);
  if (!md) return { ok: false, updates: {}, raw: { error: "scrape_failed" } };
  const updates: Updates = {};
  const phone = pickPhone(md);
  if (phone) updates.phone = phone;
  return { ok: !!phone, updates, raw: { url, found_phone: !!phone } };
}

// ────────────────── Spokeo (often blocked, attempt anyway) ──────────────────
async function spokeoEnrich(name: string, city: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!FIRECRAWL_API_KEY || !name) return { ok: false, updates: {}, raw: { skipped: "no_key_or_name" } };
  const url = `https://www.spokeo.com/${encodeURIComponent(name.replace(/\s+/g, "-"))}${city ? `/Michigan/${encodeURIComponent(city)}` : "/Michigan"}`;
  const md = await firecrawlScrape(url);
  if (!md) return { ok: false, updates: {}, raw: { error: "scrape_failed" } };
  const updates: Updates = {};
  const phone = pickPhone(md);
  const email = pickEmail(md);
  if (phone) updates.phone = phone;
  if (email && !email.includes("spokeo.com")) updates.email = email;
  return { ok: Object.keys(updates).length > 0, updates, raw: { url } };
}

// ────────────────── Facebook public profile ──────────────────
async function facebookEnrich(name: string, city: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!FIRECRAWL_API_KEY || !name) return { ok: false, updates: {}, raw: { skipped: "no_key_or_name" } };
  const q = `${name} ${city || "Michigan"}`;
  const url = `https://www.facebook.com/public/${encodeURIComponent(q)}`;
  const md = await firecrawlScrape(url);
  if (!md) return { ok: false, updates: {}, raw: { error: "scrape_failed" } };
  const updates: Updates = {};
  // Try to extract employer from "Works at X"
  const worksAt = md.match(/Works at\s+([A-Z][^\n.]{2,60})/i);
  if (worksAt) updates.current_employer = worksAt[1].trim();
  return { ok: Object.keys(updates).length > 0, updates, raw: { url } };
}

// ────────────────── orchestrator ──────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const candidate_id = body.candidate_id as string | undefined;
    if (!candidate_id) {
      return new Response(JSON.stringify({ error: "candidate_id required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: cand, error: fetchErr } = await sb
      .from("hire_alert_candidates")
      .select("id, name, full_name, city, license_type, current_employer, phone, email, linkedin_url")
      .eq("id", candidate_id)
      .maybeSingle();

    if (fetchErr || !cand) {
      return new Response(JSON.stringify({ error: "Candidate not found" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const name = cand.full_name || cand.name || "";
    if (!name || name.length < 3) {
      return new Response(JSON.stringify({ error: "Candidate has no usable name" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Waterfall ──
    const hits: Record<string, any> = {};
    const merged: Updates = {};

    // 1. PDL — best for employer + email
    const pdl = await pdlEnrich(name, cand.city);
    hits.pdl = { ok: pdl.ok, fields: Object.keys(pdl.updates) };
    Object.assign(merged, pdl.updates);

    // 2. Hunter — domain search if employer known
    const employerForHunter = merged.current_employer || cand.current_employer;
    const hunter = await hunterEnrich(employerForHunter);
    hits.hunter = { ok: hunter.ok, fields: Object.keys(hunter.updates) };
    if (hunter.updates.email && !merged.email) merged.email = hunter.updates.email;

    // 3. Snov — alternative email finder
    if (!merged.email) {
      const snov = await snovEnrich(name, employerForHunter);
      hits.snov = { ok: snov.ok, fields: Object.keys(snov.updates) };
      if (snov.updates.email) merged.email = snov.updates.email;
    } else {
      hits.snov = { ok: false, fields: [], skipped: "email_already_found" };
    }

    // 4. Sonar OSINT — fills LinkedIn + missing fields
    const sonar = await sonarEnrich(name, cand.city, cand.license_type);
    hits.sonar = { ok: sonar.ok, fields: Object.keys(sonar.updates) };
    for (const [k, v] of Object.entries(sonar.updates)) {
      if (!merged[k as keyof Updates] && v) (merged as any)[k] = v;
    }

    // 5. TruePeopleSearch — cell phone OSINT
    if (!merged.phone) {
      const tps = await truePeopleSearchEnrich(name, cand.city);
      hits.true_people_search = { ok: tps.ok, fields: Object.keys(tps.updates) };
      if (tps.updates.phone) merged.phone = tps.updates.phone;
    } else {
      hits.true_people_search = { ok: false, skipped: "phone_already_found" };
    }

    // 6. FastPeopleSearch — cell phone OSINT
    if (!merged.phone) {
      const fps = await fastPeopleSearchEnrich(name, cand.city);
      hits.fast_people_search = { ok: fps.ok, fields: Object.keys(fps.updates) };
      if (fps.updates.phone) merged.phone = fps.updates.phone;
    } else {
      hits.fast_people_search = { ok: false, skipped: "phone_already_found" };
    }

    // 7. Spokeo — phone/email OSINT
    if (!merged.phone || !merged.email) {
      const sp = await spokeoEnrich(name, cand.city);
      hits.spokeo = { ok: sp.ok, fields: Object.keys(sp.updates) };
      if (sp.updates.phone && !merged.phone) merged.phone = sp.updates.phone;
      if (sp.updates.email && !merged.email) merged.email = sp.updates.email;
    } else {
      hits.spokeo = { ok: false, skipped: "contact_already_found" };
    }

    // 8. Facebook public profile — employer fallback
    if (!merged.current_employer) {
      const fb = await facebookEnrich(name, cand.city);
      hits.facebook = { ok: fb.ok, fields: Object.keys(fb.updates) };
      if (fb.updates.current_employer) merged.current_employer = fb.updates.current_employer;
    } else {
      hits.facebook = { ok: false, skipped: "employer_already_found" };
    }

    // Don't overwrite existing data with nothing — but DO overwrite empty fields
    const finalUpdates: Updates = {};
    for (const [k, v] of Object.entries(merged)) {
      if (!v) continue;
      const existing = (cand as any)[k];
      if (!existing || existing === "" || existing === null) (finalUpdates as any)[k] = v;
    }

    const fields_added = Object.keys(finalUpdates);

    if (fields_added.length > 0) {
      finalUpdates.enriched_at = new Date().toISOString();
      finalUpdates.enrichment_status = "manual_workbench";
      const { error: updErr } = await sb
        .from("hire_alert_candidates")
        .update(finalUpdates)
        .eq("id", candidate_id);
      if (updErr) {
        return new Response(JSON.stringify({ error: "Update failed: " + updErr.message, hits }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      await sb.from("candidate_enrichment_log").insert({
        candidate_id,
        source: "manual_workbench",
        stage: "manual",
        success: true,
        hit_fields: fields_added,
        raw_response: { hits, applied: finalUpdates } as any,
      } as any).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({
      ok: true,
      candidate_id,
      name,
      hits,
      fields_added,
      applied: finalUpdates,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

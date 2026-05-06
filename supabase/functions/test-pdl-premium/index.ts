// test-pdl-premium — Compare free vs premium PDL output side-by-side.
// POST { name, city?, license_type? } → returns both a "free" field set
// and the full premium response so you can see exactly what you're getting now.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (!PDL_API_KEY) {
    return new Response(JSON.stringify({ error: "PDL_API_KEY not configured" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let name = "";
  let city = "michigan";
  let license_type = "";
  let use_db_candidate = false;

  try {
    const body = await req.json().catch(() => ({}));
    name = body.name || "";
    city = body.city || "michigan";
    license_type = body.license_type || "";
    use_db_candidate = body.use_db_candidate === true;
  } catch { /* use defaults */ }

  // If no name provided, pull a real candidate from DB to test against
  if (!name || use_db_candidate) {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data } = await sb
      .from("hire_alert_candidates")
      .select("full_name, name, city, license_type, phone, email, linkedin_url, current_employer")
      .not("full_name", "is", null)
      .eq("is_company_name", false)
      .order("first_seen_at", { ascending: false })
      .limit(5);

    if (data && data.length > 0) {
      const candidate = data[Math.floor(Math.random() * data.length)];
      name = candidate.full_name || candidate.name;
      city = candidate.city || "michigan";
      license_type = candidate.license_type || "";
    }
  }

  if (!name) {
    return new Response(JSON.stringify({ error: "No name provided and no candidates in DB to test against" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Build the PDL enrich request — premium unlocks phone_numbers[], work_email,
  // full experience[], certifications[], skills[], inferred_salary, location details
  const params = new URLSearchParams({
    name,
    "location.region": "michigan",
    pretty: "false",
    // Premium params that free tier ignores:
    include_if_matched: "true",
    titlecase: "true",
    min_likelihood: "3",  // 0-10 scale — 3 = reasonable confidence
  });
  if (city && city.toLowerCase() !== "michigan") {
    params.set("location.locality", city);
  }

  const pdlRes = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
    headers: { "X-API-Key": PDL_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });

  const rawStatus = pdlRes.status;
  let rawData: Record<string, unknown> = {};
  let rawText = "";

  try {
    rawText = await pdlRes.text();
    rawData = JSON.parse(rawText);
  } catch {
    rawData = { parse_error: rawText.slice(0, 500) };
  }

  const p: Record<string, unknown> = (rawData as any)?.data || {};

  // What the FREE tier was returning (7 fields)
  const freeTierOutput = {
    mobile_phone: p.mobile_phone || null,
    personal_email: (p as any).personal_emails?.[0] || null,
    linkedin_url: p.linkedin_url || null,
    current_employer: p.job_company_name || null,
    current_title: p.job_title || null,
    years_experience: p.inferred_years_experience || null,
    facebook_url: p.facebook_url || null,
  };

  // What PREMIUM adds on top
  const premiumAdditions = {
    // All phones (not just mobile)
    all_phone_numbers: (p as any).phone_numbers || [],
    work_email: (p as any).work_email || null,
    all_personal_emails: (p as any).personal_emails || [],
    // Full work history
    experience: ((p as any).experience || []).map((e: any) => ({
      company: e.company?.name,
      title: e.title?.name,
      start: e.start_date,
      end: e.end_date,
      is_current: e.is_primary,
      company_size: e.company?.size,
      company_industry: e.company?.industry,
    })),
    // Trade-specific gold
    certifications: (p as any).certifications || [],
    skills: (p as any).skills || [],
    // Salary intel for offer benchmarking
    inferred_salary: (p as any).inferred_salary || null,
    // Location details
    location: {
      metro: (p as any).location_metro || (p as any).location?.metro || null,
      zip: (p as any).location_zip || (p as any).location?.postal_code || null,
      region: (p as any).location_region || (p as any).location?.region || null,
    },
    // Data freshness
    last_updated: (p as any).updated || null,
    likelihood: (rawData as any).likelihood || null,
    // Education
    education: ((p as any).education || []).map((e: any) => ({
      school: e.school?.name,
      degree: e.degrees?.[0],
      field: e.majors?.[0],
      end_year: e.end_date?.year,
    })),
    // Social profiles beyond LinkedIn/Facebook
    twitter_url: (p as any).twitter_url || null,
    github_url: (p as any).github_url || null,
  };

  // Count what we'd have saved in candidate row after premium enrichment
  const freeTierHits = Object.values(freeTierOutput).filter(v => v !== null && (Array.isArray(v) ? v.length > 0 : true)).length;
  const premiumHits = [
    premiumAdditions.all_phone_numbers.length > 0,
    premiumAdditions.work_email !== null,
    premiumAdditions.experience.length > 0,
    premiumAdditions.certifications.length > 0,
    premiumAdditions.skills.length > 0,
    premiumAdditions.inferred_salary !== null,
    premiumAdditions.all_personal_emails.length > 1,
    premiumAdditions.education.length > 0,
  ].filter(Boolean).length;

  return new Response(JSON.stringify({
    tested_name: name,
    tested_city: city,
    license_type: license_type || null,
    pdl_http_status: rawStatus,
    pdl_match_likelihood: (rawData as any).likelihood ?? null,
    // Free tier summary (what we were getting before)
    free_tier_fields: freeTierOutput,
    free_tier_hit_count: freeTierHits,
    // Premium additions
    premium_additions: premiumAdditions,
    premium_addition_hit_count: premiumHits,
    // Summary
    upgrade_summary: {
      phones_available: premiumAdditions.all_phone_numbers.length,
      emails_available: premiumAdditions.all_personal_emails.length + (premiumAdditions.work_email ? 1 : 0),
      jobs_in_history: premiumAdditions.experience.length,
      certs_found: premiumAdditions.certifications.length,
      skills_found: premiumAdditions.skills.length,
      has_salary_data: premiumAdditions.inferred_salary !== null,
    },
  }, null, 2), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

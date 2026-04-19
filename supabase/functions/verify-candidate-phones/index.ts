// One-shot admin function: runs Twilio Lookup on all candidates with a phone
// that haven't been verified yet. Updates phone_type + phone_verified_at.
// Also supports action="test_pdl" to run a PDL premium test against a real candidate.
// Cost: ~$0.005/lookup. Call via POST from /dwa-admin (admin only).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function lookupPhone(phone: string): Promise<string> {
  const e164 = phone.replace(/\D/g, "");
  const normalized = e164.startsWith("1") && e164.length === 11
    ? `+${e164}`
    : e164.length === 10
    ? `+1${e164}`
    : `+${e164}`;

  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(normalized)}?Fields=line_type_intelligence`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  try {
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) return "unknown";
    const data = await res.json();
    const lineType: string = data?.line_type_intelligence?.type ?? "unknown";
    if (lineType === "mobile") return "mobile";
    if (lineType === "landline") return "landline";
    if (lineType.toLowerCase().includes("voip")) return "voip";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function runPDLTest(sb: ReturnType<typeof createClient>, name?: string, city?: string): Promise<Response> {
  if (!PDL_API_KEY) {
    return new Response(JSON.stringify({ error: "PDL_API_KEY not configured in Lovable secrets" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // If no name provided, pull a real candidate from DB
  let testName = name || "";
  let testCity = city || "michigan";

  if (!testName) {
    const { data } = await sb
      .from("hire_alert_candidates")
      .select("full_name, name, city")
      .not("full_name", "is", null)
      .neq("is_company_name", true)
      .order("first_seen_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      const pick = data[Math.floor(Math.random() * data.length)];
      testName = pick.full_name || pick.name;
      testCity = pick.city || "michigan";
    }
  }

  if (!testName) {
    return new Response(JSON.stringify({ error: "No candidates in DB — run scanner first" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const params = new URLSearchParams({
    name: testName,
    "location.region": "michigan",
    pretty: "false",
    include_if_matched: "true",
    titlecase: "true",
    min_likelihood: "3",
  });
  if (testCity && testCity.toLowerCase() !== "michigan") {
    params.set("location.locality", testCity);
  }

  const pdlRes = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
    headers: { "X-API-Key": PDL_API_KEY },
    signal: AbortSignal.timeout(20_000),
  });

  let rawData: Record<string, unknown> = {};
  try { rawData = await pdlRes.json(); } catch { /**/ }

  const p: Record<string, unknown> = (rawData as any)?.data || {};
  const allPhones: string[] = (p as any).phone_numbers || [];

  const freeTierOutput = {
    mobile_phone: p.mobile_phone || null,
    personal_email: (p as any).personal_emails?.[0] || null,
    linkedin_url: p.linkedin_url || null,
    current_employer: p.job_company_name || null,
    current_title: p.job_title || null,
    years_experience: p.inferred_years_experience || null,
    facebook_url: p.facebook_url || null,
  };

  const premiumAdditions = {
    all_phone_numbers: allPhones.slice(0, 5),
    work_email: (p as any).work_email || null,
    all_personal_emails: (p as any).personal_emails || [],
    certifications: ((p as any).certifications || []).map((c: any) => c.name).filter(Boolean),
    skills: ((p as any).skills || []).slice(0, 10),
    inferred_salary: (p as any).inferred_salary || null,
    job_count: ((p as any).experience || []).length,
    location_metro: (p as any).location_metro || null,
    location_zip: (p as any).location_zip || null,
    recent_employers: ((p as any).experience || []).slice(0, 3).map((e: any) => ({
      company: e.company?.name,
      title: e.title?.name,
      end: e.end_date,
    })),
  };

  return new Response(JSON.stringify({
    action: "test_pdl",
    tested_name: testName,
    tested_city: testCity,
    pdl_http_status: pdlRes.status,
    pdl_match_likelihood: (rawData as any).likelihood ?? null,
    free_tier_fields: freeTierOutput,
    free_tier_hit_count: Object.values(freeTierOutput).filter(v => v !== null).length,
    premium_additions: premiumAdditions,
    upgrade_summary: {
      phones_available: allPhones.length,
      emails_available: premiumAdditions.all_personal_emails.length + (premiumAdditions.work_email ? 1 : 0),
      jobs_in_history: premiumAdditions.job_count,
      certs_found: premiumAdditions.certifications.length,
      skills_found: premiumAdditions.skills.length,
      has_salary_data: premiumAdditions.inferred_salary !== null,
    },
  }, null, 2), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Check for PDL test action
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /**/ }

  if (body?.action === "test_pdl") {
    return runPDLTest(sb, body.name as string | undefined, body.city as string | undefined);
  }

  // Normal phone verification flow
  let candidates: { id: string; phone: string }[] | null = null;
  let fetchError: string | null = null;

  const { data: c1, error: e1 } = await sb
    .from("hire_alert_candidates")
    .select("id, phone")
    .not("phone", "is", null)
    .is("phone_verified_at", null)
    .neq("is_company_name", true)
    .order("score", { ascending: false })
    .limit(100); // safety cap

  if (e1 && e1.message?.includes("phone_verified_at")) {
    const { data: c2, error: e2 } = await sb
      .from("hire_alert_candidates")
      .select("id, phone")
      .not("phone", "is", null)
      .is("phone_type", null)
      .neq("is_company_name", true)
      .order("score", { ascending: false })
      .limit(100);
    candidates = c2;
    fetchError = e2?.message ?? null;
  } else {
    candidates = c1;
    fetchError = e1?.message ?? null;
  }

  if (fetchError) {
    return new Response(JSON.stringify({ ok: false, error: fetchError }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ ok: true, verified: 0, message: "All phones already verified" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const results: { id: string; phone: string; phone_type: string }[] = [];
  for (const c of candidates) {
    const phone_type = await lookupPhone(c.phone);
    results.push({ id: c.id, phone: c.phone, phone_type });
    await sb.from("hire_alert_candidates").update({
      phone_type,
      phone_verified_at: new Date().toISOString(),
    }).eq("id", c.id);
    await new Promise((r) => setTimeout(r, 200));
  }

  const summary = results.reduce((acc, r) => {
    acc[r.phone_type] = (acc[r.phone_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return new Response(JSON.stringify({ ok: true, verified: results.length, summary, results }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

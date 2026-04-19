// enrich-candidate-manual — single-row enrichment triggered from admin Workbench.
// Runs PDL person enrich → Hunter (if employer domain) → Sonar OSINT in series.
// Writes phone/email/employer/title/linkedin back to hire_alert_candidates.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

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

async function pdlEnrich(name: string, city: string | null): Promise<{ ok: boolean; updates: Updates; raw: any }> {
  if (!PDL_API_KEY) return { ok: false, updates: {}, raw: { error: "PDL_API_KEY missing" } };
  const params = new URLSearchParams({
    name,
    "location.region": "michigan",
    pretty: "false",
    titlecase: "true",
    min_likelihood: "3",
  });
  if (city && city.toLowerCase() !== "michigan") params.set("location.locality", city);

  try {
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { "X-API-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(20_000),
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
    return { ok: Object.keys(updates).length > 0, updates, raw: { likelihood: json.likelihood, data: p } };
  } catch (e) {
    return { ok: false, updates: {}, raw: { error: String(e) } };
  }
}

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
  } catch (e) {
    return { ok: false, updates: {}, raw: { error: String(e) } };
  }
}

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
  } catch (e) {
    return { ok: false, updates: {}, raw: { error: String(e) } };
  }
}

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

    // Run waterfall: PDL → Hunter (with employer hint from PDL or existing) → Sonar
    const hits: Record<string, any> = {};
    const merged: Updates = {};

    const pdl = await pdlEnrich(name, cand.city);
    hits.pdl = { ok: pdl.ok, fields: Object.keys(pdl.updates) };
    Object.assign(merged, pdl.updates);

    const employerForHunter = merged.current_employer || cand.current_employer;
    const hunter = await hunterEnrich(employerForHunter);
    hits.hunter = { ok: hunter.ok, fields: Object.keys(hunter.updates) };
    // Hunter only fills email if PDL didn't
    if (hunter.updates.email && !merged.email) merged.email = hunter.updates.email;

    const sonar = await sonarEnrich(name, cand.city, cand.license_type);
    hits.sonar = { ok: sonar.ok, fields: Object.keys(sonar.updates) };
    // Sonar fills any gaps
    for (const [k, v] of Object.entries(sonar.updates)) {
      if (!merged[k as keyof Updates] && v) (merged as any)[k] = v;
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

      // Log enrichment attempt
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

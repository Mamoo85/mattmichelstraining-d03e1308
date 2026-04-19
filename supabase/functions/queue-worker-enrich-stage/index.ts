// queue-worker-enrich-stage (C21–C30)
//
// Per-stage waterfall worker. Each pgmq message processes ONE stage for ONE
// candidate. After running the stage we:
//   1. Update enrichment_stage_state (completed/failed + merged_payload)
//   2. Compute the next stage via next_enrich_stage()
//   3. Enqueue the next stage (or finalize the candidate if waterfall exhausted)
//
// Budget guard: every paid source consults consume_source_budget() before
// firing. If the daily cap is hit, the stage is marked "skipped_budget"
// and the worker advances to the next stage immediately.
//
// One worker invocation processes up to BATCH_SIZE messages within BUDGET_MS.
// Cron schedule: every minute (queue-worker-enrich-stage-1m).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PDL_API_KEY      = Deno.env.get("PDL_API_KEY") || "";
const HUNTER_API_KEY   = Deno.env.get("HUNTER_API_KEY") || "";
const SNOV_USER_ID     = Deno.env.get("SNOV_USER_ID") || "";
const SNOV_API_KEY     = Deno.env.get("SNOV_API_KEY") || "";
const LUSHA_API_KEY    = Deno.env.get("LUSHA_API_KEY") || "";
const CLAY_API_KEY     = Deno.env.get("CLAY_API_KEY") || "";
const NINJAPEAR_KEY    = Deno.env.get("NINJAPEAR_API_KEY") || "";
const CRUSTDATA_KEY    = Deno.env.get("CRUSTDATA_API_KEY") || "";
const OPENROUTER_KEY   = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE          = 8;
const VISIBILITY_TIMEOUT  = 120;
const MAX_READ_COUNT      = 3;
const BUDGET_MS           = 55_000;

// Cost estimates per stage (USD per call) — from v5 audit
const STAGE_COST: Record<string, { source: string; cost: number }> = {
  "2_npi":         { source: "npi",        cost: 0     },
  "3_pdl":         { source: "pdl",        cost: 0.28  },
  "4_hunter":      { source: "hunter",     cost: 0.034 },
  "5_snov":        { source: "snov",       cost: 0.012 },
  "6_lusha":       { source: "lusha",      cost: 0.40  },
  "7_sonar":       { source: "sonar",      cost: 0.005 },
  "7b_ninjapear":  { source: "ninjapear",  cost: 0.01  },
  "7c_crustdata":  { source: "crustdata",  cost: 0.05  },
  "8_clay":        { source: "clay",       cost: 0.50  },
};

interface Candidate {
  id: string;
  full_name?: string | null;
  name?: string | null;
  license_type?: string | null;
  license_number?: string | null;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;
  current_employer?: string | null;
  linkedin_url?: string | null;
  source?: string | null;
  score?: number | null;
}

// ── Stage runners (slimmed copies of deep-enrich logic) ─────────────────

async function runNPI(c: Candidate): Promise<Record<string, unknown>> {
  if (!c.license_type || !/nurse|nursing|cna|lpn|rn|aide|health/i.test(c.license_type)) return {};
  const [first, ...rest] = (c.full_name || c.name || "").split(/\s+/);
  const last = rest.pop() || "";
  if (!first || !last) return {};
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&state=MI&limit=5`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return {};
    const j = await res.json();
    const r = j?.results?.[0];
    if (!r) return {};
    const addr = r.addresses?.find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0];
    return {
      npi_number: r.number,
      npi_business_phone: addr?.telephone_number,
      npi_taxonomy: r.taxonomies?.[0]?.desc,
    };
  } catch { return {}; }
}

async function runPDL(c: Candidate): Promise<Record<string, unknown>> {
  if (!PDL_API_KEY) return {};
  const params = new URLSearchParams({
    name: c.full_name || c.name || "",
    "location.region": "michigan",
    pretty: "false",
    titlecase: "true",
    min_likelihood: "3",
  });
  if (c.city) params.set("location.locality", c.city);
  try {
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { "X-API-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return {};
    const j = await res.json();
    const d = j?.data;
    if (!d) return {};
    return {
      pdl_mobile_phone: d.mobile_phone,
      pdl_personal_email: d.personal_emails?.[0],
      linkedin_url: d.linkedin_url,
      current_employer: d.job_company_name,
      current_title: d.job_title,
      company_domain: d.job_company_website,
    };
  } catch { return {}; }
}

async function runHunter(c: Candidate, employer?: string): Promise<Record<string, unknown>> {
  if (!HUNTER_API_KEY || !employer) return {};
  const [first, ...rest] = (c.full_name || c.name || "").split(/\s+/);
  const last = rest.pop() || "";
  try {
    const url = `https://api.hunter.io/v2/email-finder?company=${encodeURIComponent(employer)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${HUNTER_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return {};
    const j = await res.json();
    if (!j?.data?.email) return {};
    return { hunter_email: j.data.email, email_confidence: j.data.score };
  } catch { return {}; }
}

async function runSnov(c: Candidate, domain?: string, hunterEmail?: string): Promise<Record<string, unknown>> {
  if (!SNOV_USER_ID || !SNOV_API_KEY) return {};
  // Minimal: verify hunter email if we have one
  if (!hunterEmail) return {};
  try {
    const tokenRes = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_USER_ID}&client_secret=${SNOV_API_KEY}`,
      signal: AbortSignal.timeout(8_000),
    });
    const t = (await tokenRes.json())?.access_token;
    if (!t) return {};
    const r = await fetch(`https://api.snov.io/v1/email-verifier?access_token=${t}&email=${encodeURIComponent(hunterEmail)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json();
    return j?.data?.result === "deliverable" ? { email_verified: true } : {};
  } catch { return {}; }
}

async function runLusha(c: Candidate): Promise<Record<string, unknown>> {
  if (!LUSHA_API_KEY) return {};
  const [first, ...rest] = (c.full_name || c.name || "").split(/\s+/);
  const last = rest.pop() || "";
  if (!c.current_employer) return {};
  try {
    const url = `https://api.lusha.com/person?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}&company=${encodeURIComponent(c.current_employer)}`;
    const res = await fetch(url, { headers: { api_key: LUSHA_API_KEY }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return {};
    const j = await res.json();
    return {
      lusha_phone: j?.data?.phoneNumbers?.[0]?.number,
      lusha_email: j?.data?.emailAddresses?.[0]?.email,
    };
  } catch { return {}; }
}

async function runSonar(c: Candidate): Promise<Record<string, unknown>> {
  if (!OPENROUTER_KEY) return {};
  const prompt = `Find public OSINT for licensed trade worker "${c.full_name || c.name}" in ${c.city || "Michigan"}. Return JSON: {linkedin_url, current_employer, current_title, facebook_url}. If unknown leave field as null.`;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return {};
    const j = await res.json();
    const txt = j?.choices?.[0]?.message?.content || "";
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return {};
    const parsed = JSON.parse(m[0]);
    const out: Record<string, unknown> = {};
    for (const k of ["linkedin_url", "current_employer", "current_title", "facebook_url"]) {
      if (parsed[k] && parsed[k] !== "null") out[k] = parsed[k];
    }
    return out;
  } catch { return {}; }
}

async function runNinjaPear(_c: Candidate, linkedinUrl?: string): Promise<Record<string, unknown>> {
  if (!NINJAPEAR_KEY || !linkedinUrl) return {};
  try {
    const res = await fetch(`https://api.ninjapear.com/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}`, {
      headers: { Authorization: `Bearer ${NINJAPEAR_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const j = await res.json();
    return {
      current_employer: j?.experiences?.[0]?.company,
      current_title: j?.experiences?.[0]?.title,
      years_experience: j?.experiences?.length,
    };
  } catch { return {}; }
}

async function runCrustdata(c: Candidate): Promise<Record<string, unknown>> {
  if (!CRUSTDATA_KEY) return {};
  try {
    const res = await fetch("https://api.crustdata.com/screener/person/search", {
      method: "POST",
      headers: { Authorization: `Token ${CRUSTDATA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: c.full_name || c.name, region: "Michigan" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return {};
    const j = await res.json();
    const p = j?.profiles?.[0];
    if (!p) return {};
    return { linkedin_url: p.linkedin_url, current_employer: p.company_name };
  } catch { return {}; }
}

async function runClay(_c: Candidate): Promise<Record<string, unknown>> {
  if (!CLAY_API_KEY) return {};
  // Stub — the real Clay flow is a webhook-based table push handled elsewhere.
  return {};
}

const STAGE_RUNNER: Record<string, (c: Candidate, merged: Record<string, any>) => Promise<Record<string, unknown>>> = {
  "2_npi":        (c) => runNPI(c),
  "3_pdl":        (c) => runPDL(c),
  "4_hunter":     (c, m) => runHunter(c, m.current_employer || c.current_employer || undefined),
  "5_snov":       (c, m) => runSnov(c, m.company_domain, m.hunter_email),
  "6_lusha":      (c) => runLusha(c),
  "7_sonar":      (c) => runSonar(c),
  "7b_ninjapear": (c, m) => runNinjaPear(c, m.linkedin_url || c.linkedin_url || undefined),
  "7c_crustdata": (c) => runCrustdata(c),
  "8_clay":       (c) => runClay(c),
};

// ── Finalize: merge into hire_alert_candidates and mark complete ────────

async function finalizeCandidate(sb: any, candidateId: string, merged: Record<string, any>) {
  const update: Record<string, unknown> = {
    enrichment_status: (merged.email || merged.phone || merged.pdl_mobile_phone ||
                        merged.pdl_personal_email || merged.hunter_email || merged.lusha_email ||
                        merged.lusha_phone || merged.npi_business_phone)
                       ? "complete" : "exhausted",
    enriched_at: new Date().toISOString(),
  };
  if (merged.linkedin_url)      update.linkedin_url = merged.linkedin_url;
  if (merged.facebook_url)      update.facebook_url = merged.facebook_url;
  if (merged.current_employer)  update.current_employer = merged.current_employer;
  if (merged.current_title)     update.current_title = merged.current_title;
  if (merged.years_experience)  update.years_experience = merged.years_experience;
  const email = merged.email || merged.hunter_email || merged.lusha_email || merged.pdl_personal_email;
  const phone = merged.phone || merged.pdl_mobile_phone || merged.lusha_phone || merged.npi_business_phone;
  if (email) update.email = email;
  if (phone) update.phone = phone;

  await sb.from("hire_alert_candidates").update(update).eq("id", candidateId);
  await sb.from("enrichment_stage_state")
    .update({ finished_at: new Date().toISOString(), merged_payload: merged })
    .eq("candidate_id", candidateId);
}

// ── Worker loop ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();

  const { data: messages, error } = await sb.rpc("read_job_batch", {
    queue_name: "enrich_jobs",
    batch_size: BATCH_SIZE,
    vt: VISIBILITY_TIMEOUT,
  });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processed: any[] = [];

  for (const msg of (messages || []) as Array<{ msg_id: number; read_ct: number; message: any }>) {
    if (Date.now() - startedAt > BUDGET_MS) break;
    const candidateId: string | undefined = msg.message?.candidate_id;
    const stage:       string | undefined = msg.message?.stage;

    if (!candidateId || !stage || !STAGE_RUNNER[stage]) {
      await sb.rpc("delete_job", { queue_name: "enrich_jobs", message_id: msg.msg_id });
      processed.push({ action: "dropped_invalid", msg_id: msg.msg_id });
      continue;
    }

    if (msg.read_ct >= MAX_READ_COUNT) {
      await sb.rpc("move_to_dlq", {
        source_queue: "enrich_jobs",
        dlq_name: "dlq_enrich",
        message_id: msg.msg_id,
        payload: { ...msg.message, error: "max_retries_exceeded" },
      });
      processed.push({ candidate_id: candidateId, stage, action: "dlq" });
      continue;
    }

    // Load state + candidate
    const [{ data: state }, { data: cand }] = await Promise.all([
      sb.from("enrichment_stage_state").select("*").eq("candidate_id", candidateId).maybeSingle(),
      sb.from("hire_alert_candidates").select("*").eq("id", candidateId).maybeSingle(),
    ]);
    if (!cand) {
      await sb.rpc("delete_job", { queue_name: "enrich_jobs", message_id: msg.msg_id });
      processed.push({ candidate_id: candidateId, action: "candidate_missing" });
      continue;
    }
    const merged: Record<string, any> = state?.merged_payload || {};
    const completed: string[] = state?.completed_stages || [];
    const failed:    string[] = state?.failed_stages || [];

    // Budget check (skip stage if cap hit)
    const meta = STAGE_COST[stage];
    let stageHits: Record<string, unknown> = {};
    let stageOk = true;
    let stageErr = "";
    let skippedBudget = false;

    if (meta && meta.cost > 0) {
      const { data: allowed } = await sb.rpc("consume_source_budget", {
        _source: meta.source, _cost: meta.cost,
      });
      if (allowed === false) {
        skippedBudget = true;
        stageOk = false;
      }
    }

    if (!skippedBudget) {
      try {
        stageHits = await STAGE_RUNNER[stage](cand as Candidate, merged);
      } catch (e) {
        stageOk = false;
        stageErr = e instanceof Error ? e.message : String(e);
      }
    }

    Object.assign(merged, stageHits);
    const success = stageOk && Object.keys(stageHits).length > 0;

    // Log to candidate_enrichment_log
    await sb.from("candidate_enrichment_log").insert({
      candidate_id: candidateId,
      stage,
      source: meta?.source || stage,
      hit_fields: Object.keys(stageHits),
      cost_estimate: skippedBudget ? 0 : (meta?.cost || 0),
      success,
      error_message: skippedBudget ? "skipped_budget" : (stageErr || null),
      raw_response: stageHits,
    });

    // Update stage state
    const nowIso = new Date().toISOString();
    await sb.from("enrichment_stage_state").upsert({
      candidate_id: candidateId,
      current_stage: stage,
      completed_stages: success ? Array.from(new Set([...completed, stage])) : completed,
      failed_stages:    success ? failed : Array.from(new Set([...failed, stage])),
      merged_payload: merged,
      total_cost_usd: (state?.total_cost_usd || 0) + (skippedBudget ? 0 : (meta?.cost || 0)),
      last_advanced_at: nowIso,
    }, { onConflict: "candidate_id" });

    // Decide next stage
    const { data: nextStage } = await sb.rpc("next_enrich_stage", { _candidate_id: candidateId });

    if (nextStage) {
      await sb.rpc("enqueue_stage", { _candidate_id: candidateId, _stage: nextStage });
    } else {
      await finalizeCandidate(sb, candidateId, merged);
    }

    await sb.rpc("delete_job", { queue_name: "enrich_jobs", message_id: msg.msg_id });
    processed.push({
      candidate_id: candidateId, stage, success,
      next: nextStage || "DONE",
      skipped_budget: skippedBudget,
    });
  }

  const summary = { ok: true, processed, duration_ms: Date.now() - startedAt };
  console.log(`[queue-worker-enrich-stage] ${JSON.stringify(summary)}`);
  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

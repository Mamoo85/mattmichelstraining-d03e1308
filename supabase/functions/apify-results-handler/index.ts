// apify-results-handler — Receives webhooks from Apify Actor runs (MIOSHA, Indeed, LinkedIn).
// Validates X-Apify-Webhook-Secret, fetches dataset items, routes by Actor type,
// updates apify_run_batches, fires scoring + alerts when all 3 sources are complete.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-apify-webhook-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
const APIFY_WEBHOOK_SECRET = Deno.env.get("APIFY_WEBHOOK_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Map Actor IDs (slugs AND internal hash IDs) to source labels for routing.
// Apify webhooks send the hash ID in eventData.actorId, NOT the slug.
const ACTOR_SOURCE_MAP: Record<string, "miosha" | "indeed" | "linkedin"> = {
  // MIOSHA — transparent_meteorite~m2training
  "transparent_meteorite~m2training": "miosha",
  "CXwInKMIauMk4KwLX": "miosha",
  "m2training": "miosha",
  "miosha": "miosha",
  // Indeed — misceres~indeed-scraper
  "misceres~indeed-scraper": "indeed",
  "hMvNSpz3JnHgl5jkh": "indeed",
  "bebity~indeed-scraper": "indeed",
  "indeed-scraper": "indeed",
  // LinkedIn — harvestapi~linkedin-profile-scraper
  "harvestapi~linkedin-profile-scraper": "linkedin",
  "LpVuK3Zozwuipa5bp": "linkedin",
  "apify~linkedin-profile-scraper": "linkedin",
  "linkedin-profile-scraper": "linkedin",
};

function detectSource(actorId: string, actorName?: string): "miosha" | "indeed" | "linkedin" | null {
  // Try exact hash-ID match first
  if (actorId && ACTOR_SOURCE_MAP[actorId]) return ACTOR_SOURCE_MAP[actorId];
  // Then substring fuzzy match on slug/name
  const haystack = `${actorId} ${actorName || ""}`.toLowerCase();
  for (const [key, src] of Object.entries(ACTOR_SOURCE_MAP)) {
    if (haystack.includes(key.toLowerCase())) return src;
  }
  return null;
}

// Fallback routing: look up which source this runId belongs to in apify_run_batches
async function detectSourceByRunId(runId: string): Promise<"miosha" | "indeed" | "linkedin" | null> {
  if (!runId) return null;
  const { data } = await supabase
    .from("apify_run_batches")
    .select("miosha_run_id, indeed_run_id, linkedin_run_id, batch_id")
    .or(`miosha_run_id.eq.${runId},indeed_run_id.eq.${runId},linkedin_run_id.eq.${runId}`)
    .maybeSingle();
  if (!data) return null;
  if (data.miosha_run_id === runId) return "miosha";
  if (data.indeed_run_id === runId) return "indeed";
  if (data.linkedin_run_id === runId) return "linkedin";
  return null;
}

async function getBatchIdByRunId(runId: string): Promise<string | null> {
  if (!runId) return null;
  const { data } = await supabase
    .from("apify_run_batches")
    .select("batch_id")
    .or(`miosha_run_id.eq.${runId},indeed_run_id.eq.${runId},linkedin_run_id.eq.${runId}`)
    .maybeSingle();
  return data?.batch_id || null;
}

// Hallucination guards: drop UI chrome, template vars, junk strings
function isJunkName(name: string): boolean {
  if (!name || typeof name !== "string") return true;
  const n = name.trim();
  if (n.length < 4 || n.length > 60) return true;
  if (/\{\{|\}\}/.test(n)) return true; // template vars
  if (/[:/\\<>]/.test(n)) return true;
  const lower = n.toLowerCase();
  const junk = ["search for", "privacy", "cookie", "phone:", "email:", "close", "menu", "login", "sign in", "sign up", "loading", "untitled", "n/a", "null", "undefined", "{{", "overview", "settings", "navigation", "footer", "header", "result.", "template"];
  if (junk.some((j) => lower.includes(j))) return true;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;
  // Must contain mostly letters
  const letterRatio = (n.match(/[a-zA-Z]/g) || []).length / n.length;
  if (letterRatio < 0.6) return true;
  return false;
}

async function fetchDatasetItems(datasetId: string): Promise<unknown[]> {
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json&token=${APIFY_API_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch dataset ${datasetId}: HTTP ${res.status}`);
    return [];
  }
  return await res.json();
}

async function ingestMioshaItems(items: any[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  for (const item of items) {
    const rawName = item.name || item.full_name || item.fullName;
    if (!rawName || isJunkName(rawName)) {
      skipped++;
      continue;
    }
    try {
      const { error } = await supabase.from("hire_alert_candidates").upsert(
        {
          name: rawName.trim(),
          full_name: rawName.trim(),
          license_type: item.license_type || null,
          license_number: item.license_number || null,
          city: item.city || null,
          state: item.state || null,
          license_issue_date: item.license_issue_date || null,
          license_expiry: item.license_expiry_date || null,
          source: item.source || "lara_bpl",
        },
        { onConflict: "license_number,source", ignoreDuplicates: true }
      );
      if (!error) inserted++;
    } catch (err) {
      console.error("ingest miosha error:", err);
    }
  }
  if (skipped > 0) console.log(`[miosha] dropped ${skipped} junk rows (chrome/templates)`);
  return { inserted, skipped };
}

async function ingestIndeedItems(items: any[]): Promise<number> {
  // Indeed scraper returns job postings — extract candidate signals (resumes, contact info).
  // Stub: log + count for now; downstream parser to be fleshed out once Actor output shape is known.
  console.log(`[indeed] received ${items.length} job/candidate signals (stub)`);
  return items.length;
}

async function ingestLinkedInItems(items: any[]): Promise<number> {
  // Merge enriched LinkedIn data onto existing candidate rows by name+city match.
  let merged = 0;
  for (const profile of items) {
    if (!profile.fullName && !profile.name) continue;
    const fullName = profile.fullName || profile.name;
    const headline = profile.headline || profile.currentJobTitle || null;
    const company = profile.companyName || profile.currentCompany || null;
    const linkedinUrl = profile.url || profile.publicIdentifier || null;
    try {
      const { error } = await supabase
        .from("hire_alert_candidates")
        .update({
          linkedin_url: linkedinUrl,
          current_employer: company,
          current_title: headline,
        })
        .ilike("name", fullName)
        .is("linkedin_url", null);
      if (!error) merged++;
    } catch (err) {
      console.error("ingest linkedin error:", err);
    }
  }
  return merged;
}

async function maybeFireAlerts(batchId: string) {
  const { data: batch } = await supabase
    .from("apify_run_batches")
    .select("*")
    .eq("batch_id", batchId)
    .maybeSingle();

  if (!batch) return;
  if (!(batch.miosha_done && batch.indeed_done && batch.linkedin_done)) return;

  console.log(`[batch ${batchId}] all sources complete — invoking scorer + alerts`);

  // Fire scoring + alerts asynchronously — invokes existing scanner alert pipeline
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/candidate-quality-scorer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ batch_id: batchId, source: "apify_batch" }),
    });
  } catch (err) {
    console.error("scorer invoke failed:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Validate webhook secret — accept from header OR query param (Apify webhook UI has no header field).
  // If APIFY_WEBHOOK_SECRET is not configured in env, skip check (allows unauthenticated calls
  // from the Apify dashboard integration while secret isn't set up yet).
  const url = new URL(req.url);
  if (APIFY_WEBHOOK_SECRET) {
    const providedSecret =
      req.headers.get("x-apify-webhook-secret") ||
      req.headers.get("apify-webhook-secret") ||
      url.searchParams.get("secret");
    if (!providedSecret || providedSecret !== APIFY_WEBHOOK_SECRET) {
      console.warn("apify-results-handler: invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Apify webhook payload shape: { eventType, eventData: { actorId, actorRunId }, resource: { defaultDatasetId, ... } }
  const actorId: string = payload?.eventData?.actorId || payload?.resource?.actId || "";
  const actorRunId: string = payload?.eventData?.actorRunId || payload?.resource?.id || "";
  const datasetId: string = payload?.resource?.defaultDatasetId || "";
  const actorName: string | undefined = payload?.resource?.actorName;
  const customData: any = payload?.eventData?.customData || payload?.resource?.options?.webhookCustomData || {};
  let batchId: string | undefined = customData?.batch_id || url.searchParams.get("batch_id") || undefined;

  console.log(`apify webhook: actorId=${actorId} runId=${actorRunId} dataset=${datasetId} batch=${batchId}`);

  if (!datasetId) {
    return new Response(JSON.stringify({ error: "Missing defaultDatasetId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Try slug/hash routing first; fall back to runId lookup in apify_run_batches
  let source = detectSource(actorId, actorName);
  if (!source && actorRunId) {
    source = await detectSourceByRunId(actorRunId);
    if (source) console.log(`[fallback-routing] runId ${actorRunId} → ${source}`);
  }
  if (!source) {
    console.warn(`Could not route Actor ${actorId} (${actorName}) runId=${actorRunId}`);
    return new Response(JSON.stringify({ error: "Unknown Actor", actorId, actorRunId }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!batchId && actorRunId) {
    batchId = (await getBatchIdByRunId(actorRunId)) || undefined;
    if (batchId) console.log(`[fallback-batch] runId ${actorRunId} → batch ${batchId}`);
  }

  const items = await fetchDatasetItems(datasetId);
  console.log(`[${source}] dataset ${datasetId} returned ${items.length} items`);

  let processed = 0;
  if (source === "miosha") {
    const r = await ingestMioshaItems(items);
    processed = r.inserted;
  } else if (source === "indeed") processed = await ingestIndeedItems(items);
  else if (source === "linkedin") processed = await ingestLinkedInItems(items);

  if (batchId) {
    const updates: Record<string, unknown> = {};
    updates[`${source}_done`] = true;
    const { data: existing } = await supabase
      .from("apify_run_batches")
      .select("candidates_found")
      .eq("batch_id", batchId)
      .maybeSingle();
    if (existing) {
      updates.candidates_found = (existing.candidates_found || 0) + processed;
    }
    await supabase.from("apify_run_batches").update(updates).eq("batch_id", batchId);
    await maybeFireAlerts(batchId);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      source,
      items_received: items.length,
      processed,
      batch_id: batchId || null,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});

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

// Map Actor IDs (or name fragments) to source labels for routing.
// Update these once Matt confirms his Apify Actor IDs.
const ACTOR_SOURCE_MAP: Record<string, "miosha" | "indeed" | "linkedin"> = {
  "m2training": "miosha",
  "miosha": "miosha",
  "bebity~indeed-scraper": "indeed",
  "indeed-scraper": "indeed",
  "apify~linkedin-profile-scraper": "linkedin",
  "linkedin-profile-scraper": "linkedin",
};

function detectSource(actorId: string, actorName?: string): "miosha" | "indeed" | "linkedin" | null {
  const haystack = `${actorId} ${actorName || ""}`.toLowerCase();
  for (const [key, src] of Object.entries(ACTOR_SOURCE_MAP)) {
    if (haystack.includes(key.toLowerCase())) return src;
  }
  return null;
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

async function ingestMioshaItems(items: any[]): Promise<number> {
  let inserted = 0;
  for (const item of items) {
    if (!item.name) continue;
    try {
      const { error } = await supabase.from("hire_alert_candidates").upsert(
        {
          name: item.name,
          full_name: item.name,
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
  return inserted;
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

  // Validate webhook secret — accept from header OR query param (Apify webhook UI has no header field)
  const url = new URL(req.url);
  const providedSecret =
    req.headers.get("x-apify-webhook-secret") ||
    req.headers.get("apify-webhook-secret") ||
    url.searchParams.get("secret");
  if (!providedSecret || providedSecret !== APIFY_WEBHOOK_SECRET) {
    console.warn("apify-results-handler: invalid or missing webhook secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
  const batchId: string | undefined = customData?.batch_id;

  console.log(`apify webhook: actorId=${actorId} runId=${actorRunId} dataset=${datasetId} batch=${batchId}`);

  if (!datasetId) {
    return new Response(JSON.stringify({ error: "Missing defaultDatasetId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const source = detectSource(actorId, actorName);
  if (!source) {
    console.warn(`Could not route Actor ${actorId} (${actorName})`);
    return new Response(JSON.stringify({ error: "Unknown Actor", actorId }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = await fetchDatasetItems(datasetId);
  console.log(`[${source}] dataset ${datasetId} returned ${items.length} items`);

  let processed = 0;
  if (source === "miosha") processed = await ingestMioshaItems(items);
  else if (source === "indeed") processed = await ingestIndeedItems(items);
  else if (source === "linkedin") processed = await ingestLinkedInItems(items);

  // Mark this source done in the batch (if batch_id provided)
  if (batchId) {
    const updates: Record<string, unknown> = {};
    updates[`${source}_done`] = true;
    // Increment candidates_found
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

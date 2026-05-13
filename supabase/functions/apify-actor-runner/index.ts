// Generic Apify actor runner — pulls queued jobs from apify_actor_jobs,
// triggers Apify run, polls until complete, drops results into raw_buyer_candidates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ApifyJob {
  id: string;
  pool: string;
  actor_id: string;
  input_payload: any;
}

async function startRun(actorId: string, input: any): Promise<{ runId: string; cost: number }> {
  const r = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  if (!r.ok) throw new Error(`Apify start ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return { runId: j.data.id, cost: 0 };
}

async function pollRun(runId: string, maxWaitSec = 240): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitSec * 1000) {
    const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const j = await r.json();
    const s = j.data.status;
    if (s === "SUCCEEDED") return j.data;
    if (s === "FAILED" || s === "ABORTED" || s === "TIMED-OUT")
      throw new Error(`Apify run ${s}`);
    await new Promise((res) => setTimeout(res, 5000));
  }
  throw new Error("Apify poll timeout");
}

async function fetchDataset(datasetId: string): Promise<any[]> {
  const r = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true&limit=1000`
  );
  if (!r.ok) return [];
  return await r.json();
}

function normalizeRecord(pool: string, source: string, item: any) {
  // Apify actors return wildly different shapes; map common fields.
  return {
    pool,
    source,
    company_name: item.companyName || item.company || item.title || item.name || null,
    domain: (item.website || item.domain || item.url || "")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .split("/")[0] || null,
    contact_name: item.fullName || item.name || item.ownerName || null,
    contact_title: item.title || item.jobTitle || item.position || null,
    contact_email: item.email || item.emails?.[0] || null,
    contact_phone: item.phone || item.phones?.[0] || item.phoneNumber || null,
    city: item.city || item.locality || null,
    state: item.state || item.region || null,
    zip: item.zip || item.postalCode || null,
    raw_payload: item,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    if (!APIFY_TOKEN) throw new Error("APIFY_API_TOKEN missing");

    // Pull up to 3 queued jobs per invocation
    const { data: jobs, error } = await sb
      .from("apify_actor_jobs")
      .select("id, pool, actor_id, input_payload")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(3);
    if (error) throw error;
    if (!jobs?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const job of jobs as ApifyJob[]) {
      await sb.from("apify_actor_jobs").update({
        status: "running",
        started_at: new Date().toISOString(),
      }).eq("id", job.id);

      try {
        const { runId } = await startRun(job.actor_id, job.input_payload);
        await sb.from("apify_actor_jobs").update({ apify_run_id: runId }).eq("id", job.id);

        const runData = await pollRun(runId);
        const items = await fetchDataset(runData.defaultDatasetId);

        // Insert into raw_buyer_candidates (dedupe by dedupe_key)
        const candidates = items
          .map((it) => normalizeRecord(job.pool, `apify:${job.actor_id}`, it))
          .filter((c) => c.company_name || c.contact_email);

        if (candidates.length) {
          // Insert in batches of 100
          for (let i = 0; i < candidates.length; i += 100) {
            await sb.from("raw_buyer_candidates").insert(candidates.slice(i, i + 100));
          }
        }

        const cost = Number(runData.usage?.totalUsd ?? 0);
        await sb.from("apify_actor_jobs").update({
          status: "done",
          finished_at: new Date().toISOString(),
          results_count: candidates.length,
          cost_usd: cost,
        }).eq("id", job.id);

        results.push({ job: job.id, pool: job.pool, count: candidates.length, cost });
      } catch (e: any) {
        await sb.from("apify_actor_jobs").update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error: String(e?.message ?? e).slice(0, 500),
        }).eq("id", job.id);
        results.push({ job: job.id, pool: job.pool, error: String(e?.message ?? e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: jobs.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("apify-actor-runner error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

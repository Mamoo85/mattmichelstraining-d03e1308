// heygen-youtube-retry — retries YouTube upload for all rendered-but-not-uploaded HeyGen jobs
//
// Fires automatically at 08:15 UTC daily (15 min after YouTube quota resets at midnight Pacific).
// Can also be triggered manually after a quota reset.
//
// POST {} or POST {"retryRendered":true}
//   → queries heygen_jobs WHERE status='rendered' AND youtube_url IS NULL
//   → calls heygen-webhook for each job with the stored video_url
//   → stops on first YouTube quota error (429) to avoid burning all new quota at once
//   → returns {processed, uploaded, quotaHit, errors[]}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[HEYGEN-RETRY] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

  // Find all rendered-but-not-uploaded jobs
  const { data: jobs, error: fetchErr } = await sb
    .from("heygen_jobs")
    .select("id, heygen_video_id, niche, title, video_url")
    .eq("status", "rendered")
    .is("youtube_url", null)
    .order("created_at", { ascending: true })
    .limit(20); // cap at 20 to avoid runaway

  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!jobs || jobs.length === 0) {
    log("No rendered jobs pending YouTube upload");
    return json({ processed: 0, uploaded: 0, message: "No pending jobs" });
  }

  log("Found rendered jobs to retry", { count: jobs.length });

  const results: Array<{ heygenVideoId: string; youtubeUrl: string | null; youtubeError: string | null }> = [];
  let uploaded = 0;
  let quotaHit = false;

  for (const job of jobs) {
    if (quotaHit) break; // Stop immediately — don't waste quota on remaining jobs

    log("Retrying upload", { heygenVideoId: job.heygen_video_id, niche: job.niche });

    try {
      const webhookRes = await fetch(`${SUPABASE_URL}/functions/v1/heygen-webhook`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          heygenVideoId: job.heygen_video_id,
          // Pass stored video_url so the function skips HeyGen CDN re-fetch
          ...(job.video_url ? { video_url: job.video_url } : {}),
        }),
        signal: AbortSignal.timeout(180_000),
      });

      const result = await webhookRes.json();

      if (result.youtubeUrl) {
        uploaded++;
        log("Uploaded", { youtubeUrl: result.youtubeUrl });
      }

      if (result.youtubeError?.includes("rateLimitExceeded") || result.youtubeError?.includes("Quota exceeded")) {
        log("Quota hit — stopping retry loop", { error: result.youtubeError?.slice(0, 100) });
        quotaHit = true;
      }

      results.push({
        heygenVideoId: job.heygen_video_id,
        youtubeUrl: result.youtubeUrl ?? null,
        youtubeError: result.youtubeError ?? null,
      });

      // Brief pause between uploads to avoid hammering the API
      if (!quotaHit) await new Promise(r => setTimeout(r, 3000));

    } catch (e) {
      const msg = String(e);
      log("Webhook call failed", { heygenVideoId: job.heygen_video_id, error: msg });
      results.push({ heygenVideoId: job.heygen_video_id, youtubeUrl: null, youtubeError: msg });
    }
  }

  return json({
    processed: results.length,
    uploaded,
    quotaHit,
    remaining: jobs.length - results.length,
    results,
  });
});

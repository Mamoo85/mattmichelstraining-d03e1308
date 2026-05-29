// youtube-stats-collector — pull view/like/comment counts from YouTube Data API v3
// and store them in youtube_shorts table. Run daily via cron.
// Also logs top-5 performers so we can see which niches/title formulas win.
//
// HUMAN UNLOCK REQUIRED:
//   If you see "human_action_required: true" in the response, go to
//   Google Cloud Console → APIs & Services → Credentials → select the YOUTUBE_API_KEY
//   → Application restrictions → select "None" (or add Supabase edge function IPs).
//   The key restriction blocks server-side calls from Supabase's IP ranges.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[YT-STATS] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// Detect whether a YouTube API error body indicates a key restriction issue
function isKeyRestrictionError(body: string): boolean {
  try {
    const parsed = JSON.parse(body);
    const reason = parsed?.error?.errors?.[0]?.reason ?? "";
    return ["keyInvalid", "accessNotConfigured", "ipRefererBlocked", "refererNotAllowedByKey"].includes(reason);
  } catch {
    return body.includes("keyInvalid") || body.includes("ipRefererBlocked") || body.includes("accessNotConfigured");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const YOUTUBE_API_KEY  = Deno.env.get("YOUTUBE_API_KEY") ?? "";
  const CLIENT_ID        = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
  const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!YOUTUBE_API_KEY && !CLIENT_ID) {
    return new Response(JSON.stringify({
      error: "Need YOUTUBE_API_KEY or YOUTUBE_CLIENT_ID",
      human_action_required: false,
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Fetch all video IDs from DB ─────────────────────────────────────────────
  const { data: rows, error: fetchErr } = await sb
    .from("youtube_shorts")
    .select("id, youtube_video_id, title, type, niche")
    .not("youtube_video_id", "is", null)
    .order("created_at", { ascending: false });

  if (fetchErr || !rows || rows.length === 0) {
    return new Response(JSON.stringify({ error: fetchErr?.message ?? "No videos found" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("Fetching stats", { total: rows.length });

  // YouTube Data API v3 allows 50 video IDs per request
  const CHUNK = 50;
  const updated: Array<{ id: number; videoId: string; views: number; likes: number; comments: number }> = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const ids   = chunk.map(r => r.youtube_video_id).join(",");

    // Use API key (simpler, no OAuth needed for public video stats)
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${YOUTUBE_API_KEY}`;
    const res    = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) });

    if (!res.ok) {
      const errText = await res.text();
      log("YouTube API error", { status: res.status, body: errText.slice(0, 200) });

      // Detect API key restriction — requires human action in Google Cloud Console
      if ((res.status === 400 || res.status === 403) && isKeyRestrictionError(errText)) {
        return new Response(JSON.stringify({
          error: "YOUTUBE_API_KEY is restricted and cannot be called from server-side IPs",
          human_action_required: true,
          fix: "Google Cloud Console → APIs & Services → Credentials → your key → Application restrictions → None",
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      errors.push(`chunk ${i/CHUNK}: HTTP ${res.status}`);
      continue;
    }

    const json = await res.json() as {
      items?: Array<{
        id: string;
        statistics: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
      }>;
    };

    // Build a map: videoId → stats
    const statsMap = new Map<string, { views: number; likes: number; comments: number }>();
    for (const item of json.items ?? []) {
      statsMap.set(item.id, {
        views:    parseInt(item.statistics.viewCount    ?? "0", 10),
        likes:    parseInt(item.statistics.likeCount    ?? "0", 10),
        comments: parseInt(item.statistics.commentCount ?? "0", 10),
      });
    }

    // Update each row
    for (const row of chunk) {
      const stats = statsMap.get(row.youtube_video_id);
      if (!stats) continue; // video deleted or private

      // Backfill niche from `type` column if not already set
      // `type` is the content category set at upload time (e.g. "sidehustle", "wallart")
      const nicheUpdate: Record<string, unknown> = {
        view_count:       stats.views,
        like_count:       stats.likes,
        comment_count:    stats.comments,
        stats_updated_at: new Date().toISOString(),
      };
      if (!row.niche && row.type) nicheUpdate.niche = row.type;

      const { error: upErr } = await sb
        .from("youtube_shorts")
        .update(nicheUpdate)
        .eq("id", row.id);

      if (upErr) {
        errors.push(`id=${row.id}: ${upErr.message}`);
      } else {
        updated.push({ id: row.id, videoId: row.youtube_video_id, ...stats });
      }
    }

    // Respect rate limits between chunks
    if (i + CHUNK < rows.length) await new Promise(r => setTimeout(r, 500));
  }

  // ── Build top-performers summary ────────────────────────────────────────────
  const topVideos = [...updated]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
    .map(v => {
      const row = rows.find(r => r.id === v.id);
      return { videoId: v.videoId, title: row?.title ?? "", views: v.views, likes: v.likes };
    });

  const totalViews = updated.reduce((sum, v) => sum + v.views, 0);
  const avgViews   = updated.length > 0 ? Math.round(totalViews / updated.length) : 0;

  log("Stats collected", {
    updated: updated.length,
    errors: errors.length,
    totalViews,
    avgViews,
    top1: topVideos[0]?.title?.slice(0, 60),
    top1Views: topVideos[0]?.views,
  });

  return new Response(JSON.stringify({
    success:    true,
    updated:    updated.length,
    errors:     errors.length > 0 ? errors : undefined,
    totalViews,
    avgViews,
    topVideos,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

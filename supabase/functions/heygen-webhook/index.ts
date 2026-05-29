// heygen-webhook — receives HeyGen completion callback, downloads MP4, uploads to YouTube
// v1: Polls HeyGen status (or receives webhook), downloads rendered MP4 from CDN,
// uploads directly to YouTube via resumable upload API, updates heygen_jobs table.
//
// HeyGen sends a webhook to this URL when video rendering is complete.
// Also supports manual polling: POST { "heygenVideoId": "xxx" } to check status.
//
// Secrets needed (secondary project):
//   HEYGEN_API_KEY, YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[HEYGEN-WH] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ─── YouTube token management (reuse from youtube-shorts-now) ─────────────────
async function getValidYouTubeToken(
  sb: ReturnType<typeof createClient>,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const { data: tokenRows } = await sb
    .from("youtube_oauth_tokens")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!tokenRows || tokenRows.length === 0) return null;

  const token = tokenRows[0];
  const expiresAt = new Date(token.expires_at).getTime();
  const now = Date.now();

  if (expiresAt - now > 60_000) {
    return token.access_token; // Still valid
  }

  // Refresh token
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshRes.ok) {
    log("Token refresh failed", { status: refreshRes.status });
    return null;
  }

  const refreshData = await refreshRes.json();
  const newAccessToken = refreshData.access_token;
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  await sb.from("youtube_oauth_tokens").update({
    access_token: newAccessToken,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq("id", token.id);

  return newAccessToken;
}

// ─── YouTube upload via resumable API ─────────────────────────────────────────
async function uploadToYouTube(
  videoBytes: Uint8Array,
  title: string,
  description: string,
  tags: string[],
  accessToken: string
): Promise<string | null> {
  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description: description.slice(0, 5000),
      tags: tags.slice(0, 500),
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  // Step 1: Initiate resumable upload
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(videoBytes.byteLength),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`YouTube upload init failed ${initRes.status}: ${err}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("No upload URL in YouTube response");

  log("YouTube upload URL obtained, uploading MP4", { bytes: videoBytes.byteLength });

  // Step 2: Upload the video bytes
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBytes.byteLength),
    },
    body: videoBytes,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`YouTube video upload failed ${uploadRes.status}: ${err}`);
  }

  const uploadData = await uploadRes.json();
  return uploadData.id ?? null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const HEYGEN_KEY = Deno.env.get("HEYGEN_API_KEY") ?? "";
  const CLIENT_ID = Deno.env.get("YOUTUBE_CLIENT_ID") ?? "";
  const CLIENT_SECRET = Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: { heygenVideoId?: string; event?: string; video_id?: string; status?: string; video_url?: string; urlOnly?: boolean } = {};
  try {
    body = await req.json();
  } catch { /* empty ok */ }

  // ── Handle HeyGen webhook callback ────────────────────────────────────────
  // HeyGen sends: { event: "avatar_video.success", video_id: "xxx", video_url: "https://..." }
  const heygenVideoId = body.heygenVideoId ?? body.video_id;
  const isWebhookCallback = body.event === "avatar_video.success" || body.event === "video.completed";
  const urlOnly = body.urlOnly === true; // return CDN URL without uploading to YouTube
  let videoUrl = body.video_url;

  if (!heygenVideoId) {
    return new Response(JSON.stringify({ error: "heygenVideoId required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("Processing HeyGen completion", { heygenVideoId, isWebhook: isWebhookCallback });

  try {
    // ── Fetch job from DB ─────────────────────────────────────────────────────
    const { data: job } = await sb
      .from("heygen_jobs")
      .select("*")
      .eq("heygen_video_id", heygenVideoId)
      .single();

    if (!job) {
      log("No job found in DB for this video ID — may have been submitted without tracking");
    }

    // ── Get video status/URL from HeyGen if not provided in webhook ───────────
    if (!videoUrl) {
      log("Fetching video status from HeyGen API");
      const statusRes = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${heygenVideoId}`,
        { headers: { "X-Api-Key": HEYGEN_KEY }, signal: AbortSignal.timeout(15_000) }
      );

      if (!statusRes.ok) {
        throw new Error(`HeyGen status check failed: ${statusRes.status}`);
      }

      const statusData = await statusRes.json();
      const videoStatus = statusData.data?.status;

      log("HeyGen status", { status: videoStatus });

      if (videoStatus === "processing" || videoStatus === "pending") {
        // Still rendering
        await sb.from("heygen_jobs").update({ status: "processing" })
          .eq("heygen_video_id", heygenVideoId);

        return new Response(JSON.stringify({
          status: "processing",
          message: "HeyGen is still rendering. Try again in 1-2 minutes.",
          heygenVideoId,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (videoStatus === "failed") {
        const errMsg = statusData.data?.error?.message ?? "Unknown HeyGen error";
        await sb.from("heygen_jobs").update({ status: "failed", error: errMsg })
          .eq("heygen_video_id", heygenVideoId);
        throw new Error(`HeyGen rendering failed: ${errMsg}`);
      }

      if (videoStatus !== "completed") {
        throw new Error(`Unexpected HeyGen status: ${videoStatus}`);
      }

      videoUrl = statusData.data?.video_url;
    }

    if (!videoUrl) {
      throw new Error("No video URL from HeyGen — rendering may not be complete");
    }

    // Save video_url + rendered status to DB (safety net for quota retries)
    if (job) {
      const { error: urlUpdateErr } = await sb.from("heygen_jobs")
        .update({ status: "rendered", error: null, video_url: videoUrl })
        .eq("heygen_video_id", heygenVideoId);
      if (urlUpdateErr) log("DB url save failed (non-fatal)", { err: urlUpdateErr.message });
    }

    // ── urlOnly mode: return CDN URL without uploading to YouTube ─────────────
    if (urlOnly) {
      log("urlOnly mode — returning CDN URL without YouTube upload");
      return new Response(JSON.stringify({
        success: true,
        heygenVideoId,
        videoUrl,
        status: "rendered",
        note: "Download this URL — it expires in ~24h. Upload manually to YouTube/Instagram.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    log("HeyGen video ready, downloading MP4", { videoUrl: videoUrl.slice(0, 80) });

    // ── Download MP4 from HeyGen CDN ──────────────────────────────────────────
    const mp4Res = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) });
    if (!mp4Res.ok) throw new Error(`Failed to download MP4: ${mp4Res.status}`);

    const mp4Bytes = new Uint8Array(await mp4Res.arrayBuffer());
    log("MP4 downloaded", { bytes: mp4Bytes.byteLength });

    // ── Save a DURABLE asset copy to Supabase Storage FIRST ───────────────────
    // The HeyGen CDN URL expires; this gives a permanent public link for the DWA
    // pitch deck / demo pages / cold emails. Done before YouTube so the asset
    // survives even when the YouTube daily quota is exhausted.
    let assetUrl: string | null = null;
    let assetError: string | null = null;
    try {
      const assetPath = `dwa-clips/${(job?.niche ?? "business")}-${heygenVideoId}.mp4`;
      const blob = new Blob([mp4Bytes], { type: "video/mp4" });
      const { error: upErr } = await sb.storage
        .from("ad-creatives")
        .upload(assetPath, blob, { contentType: "video/mp4", upsert: true });
      if (upErr) {
        assetError = upErr.message;
        log("Storage asset upload failed (non-fatal)", { err: upErr.message });
      } else {
        assetUrl = `${SUPABASE_URL}/storage/v1/object/public/ad-creatives/${assetPath}`;
        await sb.from("heygen_jobs").update({ video_url: assetUrl })
          .eq("heygen_video_id", heygenVideoId);
        log("Durable asset saved", { assetUrl });
      }
    } catch (e) {
      assetError = String(e);
      log("Storage asset upload threw (non-fatal)", { error: String(e) });
    }

    // ── Build video metadata ──────────────────────────────────────────────────
    const title = job?.title ?? `Detroit Web Agency — ${job?.niche ?? "Business"} Tips`;
    const niche = job?.niche ?? "business";
    const narration = job?.narration ?? "";

    const hashtagMap: Record<string, string[]> = {
      church: ["#church", "#pastor", "#ministry", "#churchtech", "#AItools"],
      farming: ["#farming", "#agriculture", "#grainfarmer", "#commodityprices", "#farmlife"],
      podcast: ["#podcast", "#podcasting", "#shownotes", "#contentcreator", "#podcasttips"],
      video: ["#youtube", "#contentcreator", "#AItools", "#facelessyoutube", "#videoscript"],
      trades: ["#trades", "#contractor", "#HVAC", "#plumber", "#electrician"],
      fitness: ["#fitness", "#gym", "#personaltrainer", "#fitnessbusiness", "#gymowner"],
      business: ["#smallbusiness", "#entrepreneur", "#marketing", "#AItools", "#businesstips"],
    };

    const hashtags = (hashtagMap[niche] ?? hashtagMap.business).join(" ");
    const description = `${narration}\n\n${hashtags}\n\nDetroit Web Agency — AI-powered tools for small businesses.\ndetroitwebagent.com`;

    const tags = (job?.tags ?? []).length > 0
      ? job.tags
      : (hashtagMap[niche] ?? hashtagMap.business).map((h: string) => h.replace("#", ""));

    // ── If this is a Meta video ad job — auto-post to Meta, skip YouTube ────────
    const isMetaVideoAd = job?.source === "dwa_meta_video_ad";
    let metaAdResult: Record<string, unknown> | null = null;

    if (isMetaVideoAd && assetUrl) {
      log("Meta video ad job detected — posting to Meta Ads");
      // Use product-specific brandSlug if the job niche is a product slug (e.g. "dwa-missed-call")
      // Otherwise fall back to "dwa" for generic DWA ads submitted via dwa-video-ad
      const metaBrandSlug = (job?.niche && job.niche.startsWith("dwa-")) ? job.niche : "dwa";
      log("Routing to Meta with brandSlug", { metaBrandSlug, jobNiche: job?.niche });
      try {
        const metaAdRes = await fetch(
          `${SUPABASE_URL}/functions/v1/meta-ads-poster`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              videoUrl: assetUrl,
              brandSlug: metaBrandSlug,
              dailyBudgetCents: 500,
            }),
            signal: AbortSignal.timeout(120_000),
          }
        );
        metaAdResult = await metaAdRes.json();
        log("Meta video ad created", { result: JSON.stringify(metaAdResult).slice(0, 200) });

        // Update job with adsManagerUrl
        if (metaAdResult?.adsManagerUrl) {
          await sb.from("heygen_jobs").update({
            status: "completed",
            video_url: assetUrl,
            completed_at: new Date().toISOString(),
          }).eq("heygen_video_id", heygenVideoId);
        }
      } catch (e) {
        log("Meta video ad creation failed (non-fatal — asset is saved)", { error: String(e) });
      }
    }

    // ── Upload to YouTube (NON-FATAL: the durable asset is already saved) ─────
    // Skip YouTube for Meta video ad jobs — those go to Meta, not YouTube
    let youtubeUrl: string | null = null;
    let youtubeVideoId: string | null = null;
    if (!isMetaVideoAd) {
      try {
        if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("YOUTUBE_CLIENT_ID/SECRET not set");
        const accessToken = await getValidYouTubeToken(sb, CLIENT_ID, CLIENT_SECRET);
        if (!accessToken) throw new Error("No valid YouTube token — visit /youtube-oauth-start");

        log("Uploading to YouTube", { title });
        youtubeVideoId = await uploadToYouTube(mp4Bytes, title, description, tags, accessToken);

        if (youtubeVideoId) {
          youtubeUrl = `https://www.youtube.com/shorts/${youtubeVideoId}`;
          log("YouTube upload complete", { youtubeVideoId, youtubeUrl });
          await sb.from("youtube_shorts").upsert({
            niche, title, youtube_id: youtubeVideoId, youtube_url: youtubeUrl,
            description, tags, type: "heygen_avatar",
          }, { onConflict: "youtube_id", ignoreDuplicates: true }).select();
        }
      } catch (e) {
        log("YouTube upload failed (non-fatal — durable asset is saved)", { error: String(e) });
      }
    }

    // ── Update DB ─────────────────────────────────────────────────────────────
    if (job && !isMetaVideoAd) {
      await sb.from("heygen_jobs").update({
        status: youtubeUrl ? "completed" : "rendered",
        youtube_url: youtubeUrl,
        completed_at: youtubeUrl ? new Date().toISOString() : null,
      }).eq("heygen_video_id", heygenVideoId);
    }

    // ── Send SMS notification ─────────────────────────────────────────────────
    const adminPhone = Deno.env.get("ADMIN_PHONE");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (adminPhone && twilioSid && twilioToken && twilioFrom) {
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${twilioSid}:${twilioToken}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: twilioFrom,
            To: adminPhone,
            Body: isMetaVideoAd
            ? `🎬 DWA Meta video ad live!\nAsset: ${assetUrl ?? "save failed"}\nAds Manager: ${(metaAdResult?.adsManagerUrl as string) ?? "check logs"}`
            : `🎬 HeyGen clip ready!\n"${title}"\nAsset: ${assetUrl ?? "save failed"}\nYouTube: ${youtubeUrl ?? "skipped/quota"}`,
          }),
        });
        log("SMS notification sent");
      } catch (e) {
        log("SMS notification failed (non-fatal)", { error: String(e) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      assetUrl,
      assetError,
      heygenCdnUrl: videoUrl,
      youtubeVideoId,
      youtubeUrl,
      title,
      niche,
      ...(isMetaVideoAd ? { metaAdResult } : {}),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("Error", { error: msg });

    // Update job status to failed
    if (heygenVideoId) {
      const { error: updateErr } = await sb.from("heygen_jobs")
        .update({ status: "failed", error: msg })
        .eq("heygen_video_id", heygenVideoId);
      if (updateErr) log("DB update failed (non-fatal)", { err: updateErr.message });
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

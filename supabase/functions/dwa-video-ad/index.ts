// dwa-video-ad — Creates a professional Meta video ad using HeyGen (Matt's photo avatar)
//
// Flow:
//   1. Submits a professional DWA script to HeyGen with Matt's talking photo
//   2. Background: DWA website screenshot (or custom slideshow video if provided)
//   3. Saves job to heygen_jobs with source="dwa_meta_video_ad"
//   4. When HeyGen completes, heygen-webhook auto-creates the Meta video ad
//
// Recommended workflow for best quality:
//   Step 1: POST {} to dwa-ad-background-generator → returns backgroundVideoUrl (30s slideshow)
//   Step 2: POST {"backgroundVideoUrl":"<url from step 1>"} to this function → submits to HeyGen
//
// Other options:
//   POST {}  — use default pro script, static dwa-og-image.png background
//   POST {"script":"...", "backgroundUrl":"https://..."} — custom script or background
//   POST {"backgroundVideoUrl":"https://..."} — pass any video URL as background
//   POST {"dryRun":true}  — returns plan without submitting to HeyGen
//
// Required secrets (secondary project zmyczlfuufhngzovkjdh):
//   HEYGEN_API_KEY, MATT_HEYGEN_TALKING_PHOTO_ID, HEYGEN_VOICE_ID
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[DWA-VIDEO-AD] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Professional DWA ad script ────────────────────────────────────────────────
// Target: local business owners (contractors, trades, medical, restaurant)
// Angle: website isn't working → we fix it fast → free automations included
// ~75 words, ~30 seconds spoken at deliberate pace
const DEFAULT_SCRIPT = `Most local businesses... get zero calls from their website.
Not because their work is bad — because nobody can find them.

Detroit Web Agency fixes that. In weeks. Not months.

We build you a site that actually ranks on Google. —
Automated review texts. Payment links by text. Appointment reminders.
All included. No extras.

Your competitors are paying three hundred dollars a month... for less than half of this.

See what we built for businesses like yours.
Visit Detroit Web Agent dot com.`;

// ── Background options ────────────────────────────────────────────────────────
// Default: DWA's own og:image (the website hero / brand image)
// Override: pass backgroundUrl (image) or backgroundVideoUrl (screen recording)
const DEFAULT_BG_IMAGE = "https://www.detroitwebagent.com/dwa-og-image.png";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const HEYGEN_KEY = Deno.env.get("HEYGEN_API_KEY") ?? "";
  const TALKING_PHOTO_ID = Deno.env.get("MATT_HEYGEN_TALKING_PHOTO_ID") ?? "";
  const GNG_PHOTO_ID = Deno.env.get("GNG_HEYGEN_TALKING_PHOTO_ID") ?? "";
  const VOICE_ID = Deno.env.get("HEYGEN_VOICE_ID") ?? "3275ac3dacaa4f48ba7c949f3504d73b";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (!HEYGEN_KEY) return json({ error: "HEYGEN_API_KEY not set" }, 400);
  if (!TALKING_PHOTO_ID) return json({ error: "MATT_HEYGEN_TALKING_PHOTO_ID not set" }, 400);

  let body: {
    brand?: string; // "dwa" | "gng" — routes to the correct HeyGen avatar
    script?: string;
    backgroundUrl?: string;
    backgroundVideoUrl?: string;
    customTalkingPhotoId?: string; // highest-priority override (preserves Phase 97 workaround)
    dryRun?: boolean;
  } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const script = body.script ?? DEFAULT_SCRIPT;
  const dryRun = body.dryRun === true;
  const brandPhotoId = body.brand === "gng" ? (GNG_PHOTO_ID || TALKING_PHOTO_ID) : TALKING_PHOTO_ID;
  const talkingPhotoId = body.customTalkingPhotoId ?? brandPhotoId;

  // Background: video > image > default DWA og-image
  let background: Record<string, unknown>;
  if (body.backgroundVideoUrl) {
    background = { type: "video", url: body.backgroundVideoUrl, fit: "cover" };
    log("Using custom screen recording as background", { url: body.backgroundVideoUrl.slice(0, 80) });
  } else {
    const bgImageUrl = body.backgroundUrl ?? DEFAULT_BG_IMAGE;
    background = { type: "image", url: bgImageUrl, fit: "cover" };
    log("Using background image", { url: bgImageUrl.slice(0, 80) });
  }

  const heygenPayload = {
    video_inputs: [{
      character: {
        type: "talking_photo",
        talking_photo_id: talkingPhotoId,
        talking_style: "expressive",
        super_resolution: true,
      },
      voice: {
        type: "text",
        input_text: script,
        voice_id: VOICE_ID,
        speed: 0.9, // deliberate pacing — lets each point land
      },
      background,
    }],
    // 1:1 square — best coverage across Facebook Feed + Instagram Feed
    // (Facebook recommends 1:1 for feed; works on both platforms without cropping)
    dimension: { width: 1080, height: 1080 },
    caption: true, // subtitles — most feed videos watched muted
    aspect_ratio: null,
  };

  if (dryRun) {
    return json({
      dryRun: true,
      plan: {
        avatarType: "talking_photo",
        talkingPhotoId: talkingPhotoId,
        voiceId: VOICE_ID,
        dimensions: "1080x1080 (1:1 square — Facebook + Instagram Feed)",
        background,
        scriptPreview: script.slice(0, 120) + "...",
        wordCount: script.split(/\s+/).length,
        estimatedSeconds: Math.round(script.split(/\s+/).length / 2.2),
        caption: true,
        placement: "Facebook Feed + Instagram Feed + Reels",
        landingUrl: "https://detroitwebagent.com",
        cta: "GET_QUOTE",
      },
      nextStep: "Remove dryRun:true to submit to HeyGen — renders in ~3 min, then auto-posts to Meta",
      overrideOptions: {
        slideshowBackground: 'First: POST {} to dwa-ad-background-generator → then pass returned backgroundVideoUrl here',
        customBackground: 'Add "backgroundUrl":"https://..." for a different static background image',
        screenRecording: 'Add "backgroundVideoUrl":"https://storage-url/your-video.mp4" to use any video as background',
        customScript: 'Add "script":"..." to use your own script instead',
      },
    });
  }

  log("Submitting to HeyGen", { talkingPhotoId: TALKING_PHOTO_ID, voiceId: VOICE_ID });

  const heygenRes = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "X-Api-Key": HEYGEN_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(heygenPayload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!heygenRes.ok) {
    const errText = await heygenRes.text();
    throw new Error(`HeyGen API error ${heygenRes.status}: ${errText}`);
  }

  const heygenData = await heygenRes.json();
  const heygenVideoId = heygenData.data?.video_id ?? heygenData.video_id;
  if (!heygenVideoId) return json({ error: `HeyGen returned no video_id: ${JSON.stringify(heygenData)}` }, 500);

  log("HeyGen job submitted", { videoId: heygenVideoId });

  // Save to heygen_jobs with source="dwa_meta_video_ad"
  // heygen-webhook checks this source and auto-posts to Meta when rendering completes
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: job, error: insertErr } = await sb
    .from("heygen_jobs")
    .insert({
      niche: "dwa",
      title: "Detroit Web Agency — Local Business Ad",
      narration: script,
      avatar_id: TALKING_PHOTO_ID,
      heygen_video_id: heygenVideoId,
      status: "pending",
      tags: ["detroitwebagency", "websitedesign", "localbusiness", "smallbusiness", "metaad"],
      source: "dwa_meta_video_ad", // triggers Meta video ad creation in heygen-webhook
    })
    .select()
    .single();

  if (insertErr) log("DB insert warning (job submitted but not tracked)", { error: insertErr.message });

  return json({
    success: true,
    jobId: job?.id ?? null,
    heygenVideoId,
    status: "pending",
    message: "HeyGen is rendering the video (2-5 minutes). Once complete, heygen-webhook will auto-save to storage and create the Meta video ad.",
    checkStatus: `POST https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/heygen-webhook {"heygenVideoId":"${heygenVideoId}","urlOnly":true}`,
    nextAutomation: "heygen-webhook → Supabase Storage → meta-ads-poster (video) → Meta Ads Manager",
  });
});

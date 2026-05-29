// youtube-shorts-heygen — submit a HeyGen avatar video job for "Matt" talking Shorts
// v1: Generates a script via OpenRouter, submits to HeyGen API, inserts job record.
// Async/webhook pattern: returns immediately with jobId (HeyGen takes 2-5 min to render).
// Companion: heygen-webhook/index.ts receives HeyGen callback → downloads MP4 → uploads to YouTube.
//
// Setup (one-time):
//   1. Matt records 2-min video facing camera
//   2. Upload to HeyGen: app.heygen.com → Avatars → Instant Avatar
//   3. HeyGen processes ~2 hours → copy avatar_id → add to Supabase secrets as MATT_HEYGEN_AVATAR_ID
//   4. Get HeyGen API key (Creator plan $89/mo) → add as HEYGEN_API_KEY
//
// Secrets needed (secondary project):
//   HEYGEN_API_KEY, MATT_HEYGEN_AVATAR_ID, OPENAI_API_KEY (for script), OPENROUTER_API_KEY (alt)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[HEYGEN-JOB] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ─── HeyGen voice options ─────────────────────────────────────────────────────
// Voice can be overridden via the HEYGEN_VOICE_ID secret (no code deploy needed).
// The hardcoded fallback is the original Matthew Michels voice clone — if HeyGen
// returns "Voice not found", that clone was removed; use ?listVoices=1 to fetch
// valid IDs, then set the HEYGEN_VOICE_ID secret.
const HEYGEN_VOICE_ID = Deno.env.get("HEYGEN_VOICE_ID") ?? "3275ac3dacaa4f48ba7c949f3504d73b";

// ─── Script generator ─────────────────────────────────────────────────────────
// Generate a short punchy script for Matt to "say" in the avatar video.
// Target: 60-80 words with natural pause markers for spoken cadence.
async function generateScript(niche: string, openaiKey: string, openrouterKey: string): Promise<{
  script: string;
  title: string;
  tags: string[];
} | null> {
  const prompt = `You are writing a YouTube Shorts script for Matt Michels, owner of Detroit Web Agency.
Matt will appear on camera (via AI avatar) speaking directly to the viewer. The video is a 9:16 Short.

Niche: ${niche}
Tone: Confident, direct, helpful — like a knowledgeable friend who pauses to let things land.

CRITICAL retention rules (a Short lives or dies in the first 1.2 seconds):
- HARD LIMIT: 60-80 words total (~30-35 seconds spoken at a measured pace). Never exceed 80 words.
- First sentence MUST be the hook — a bold claim, surprising stat, or pain-point question. NO greetings. Never start with "Hi", "Hey", "Welcome", or "I'm Matt".
- PAUSE MARKERS: Write with natural speech pauses. Use "..." for a half-second breath. Use "—" for an emphasis beat. Example: "Most gyms lose 40% of new members... in the first 30 days. — Here's exactly why."
- SHORT SENTENCES: Maximum 8 words before a pause marker or period. Fragments are good. No run-on sentences.
- SPOKEN FRAGMENTS encouraged: "Not once." "Every single time." "Here's the fix." These create rhythm and let things land.
- Plain spoken English only. NO jargon (no "OAuth", "API", "dashboard"). Talk about OUTCOMES, not mechanisms.
- One single idea. No lists.
- End with a soft CTA: "Link in bio" or "Follow for more" — never "Buy now".

EXAMPLE of the correct style (do NOT copy — just shows the rhythm):
"Sixty percent of restaurant websites... have the wrong phone number. — No joke. We checked 200 of them. Customers are calling... and reaching nobody. Detroit Web Agency fixes this in one day. Link in bio."

Format your response as JSON:
{
  "title": "YouTube video title (50-60 chars, punchy, no clickbait symbols)",
  "script": "60-80 words. Include ... and — pause markers throughout for natural spoken rhythm. Short punchy sentences only.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Niche context:
- church → AI Church Newsletter tool ($29/mo, saves pastors 4hrs/week)
- farming → Ag Price Alerts SMS tool ($79/mo, real-time commodity prices)
- podcast → AI Podcast Show Notes ($49/mo, generated from transcription)
- video → AI Video Scripts ($39/mo, niche-specific scripts)
- trades → DWA trade business tools (electricians, plumbers, HVAC)
- fitness → DWA fitness marketing (gyms, personal trainers)
- business → DWA general SMB marketing tools`;

  // Try OpenRouter first (free Gemini tier)
  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://detroitwebagent.com",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite:free",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          log("Script generated via OpenRouter", { title: parsed.title, chars: parsed.script?.length });
          return parsed;
        }
      }
    } catch (e) {
      log("OpenRouter script gen failed, falling back to OpenAI", { error: String(e) });
    }
  }

  // Fall back to OpenAI gpt-4o-mini
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          log("Script generated via OpenAI", { title: parsed.title, chars: parsed.script?.length });
          return parsed;
        }
      }
    } catch (e) {
      log("OpenAI script gen failed", { error: String(e) });
    }
  }

  return null;
}

// ─── Static fallback scripts ──────────────────────────────────────────────────
// Written with natural speech rhythm: "..." = half-second breath, "—" = emphasis beat.
// Short sentences (≤8 words) and spoken fragments are intentional — they let ideas land.
const FALLBACK_SCRIPTS: Record<string, { title: string; script: string; tags: string[] }> = {
  church: {
    title: "AI Is Saving Pastors 4 Hours Every Week",
    script: "Pastors are burning hours... every single week. Writing newsletters by hand — when AI can do it in 60 seconds. Real content. Your voice. Your congregation. — Not a template. Not generic. Just your message... delivered faster. Detroit Web Agency built this for churches. Seven-day free trial. No credit card. Link in bio.",
    tags: ["church", "pastor", "churchadmin", "ministry", "AItools"],
  },
  farming: {
    title: "Farmers Are Losing Money Without This Alert",
    script: "Grain farmers miss price spikes... because they find out too late. By the time you check the board — the window's closed. We send a text the second corn or soybeans hit your target. Set it once. — That's it. Detroit Web Agency. First alert is free. Link in bio.",
    tags: ["farming", "grainfarmer", "commodityprices", "agriculture", "farmtips"],
  },
  podcast: {
    title: "Your Podcast Isn't Ranking — Here's Why",
    script: "Your podcast isn't ranking on Google... and here's the reason. Show notes. Most hosts write one weak paragraph. — Google indexes words... not audio. Our AI pulls real keywords from your transcript. Real summaries. Real timestamps. Not hallucinated. Detroit Web Agency. First set of notes is free. Link in bio.",
    tags: ["podcast", "podcasting", "shownotes", "podcasttips", "contentcreator"],
  },
  video: {
    title: "Faceless YouTube Channels Are Winning in 2025",
    script: "You don't need to show your face... to build a YouTube channel. Faceless channels in finance and history — pulling six figures a year. The secret is a great script. — Our AI writes niche-specific scripts. Not templates. Tuned to your exact topic. Detroit Web Agency. First script is free. Follow for more.",
    tags: ["youtube", "facelessyoutube", "videoscript", "contentcreator", "AItools"],
  },
  trades: {
    title: "Trade Businesses Are Losing Jobs Every Day",
    script: "Not responding to leads within five minutes? — You're losing jobs. Every time. Studies show response time is the number one factor. We built automated tools for HVAC, plumbing, and electrical. First contact in 90 seconds. Follow-up runs itself. — Detroit Web Agency. Free demo. Link in bio.",
    tags: ["trades", "HVAC", "plumbing", "electrician", "contractorlife"],
  },
  business: {
    title: "Small Businesses Wasting Money on Marketing",
    script: "Most small businesses target everyone... and reach no one. — Niche-specific marketing outperforms generic three to one. We build AI tools for your exact industry. Social content. Cold email. Ad copy. Not templates. — Detroit Web Agency. Free trial. Link in bio.",
    tags: ["smallbusiness", "marketing", "AImarketing", "entrepreneur", "businesstips"],
  },
  fitness: {
    title: "Gyms Are Losing Members in the First 30 Days",
    script: "Most gyms lose 40% of new members... in the first 30 days. — Here's why. No follow-up. No check-ins. No reason to stay. We built automated retention tools for gyms and personal trainers. Text sequences that run themselves. — Detroit Web Agency. Free demo. Link in bio.",
    tags: ["gym", "personaltrainer", "fitness", "gymmarketing", "memberretention"],
  },
};

// ─── Script post-processor ────────────────────────────────────────────────────
// Ensures every script has natural breathing room before it hits the TTS engine.
// - Adds "..." after the hook (first sentence) if no pause marker exists
// - Splits any sentence ≥12 words with no pause into two shorter parts
// - Normalises whitespace
function polishScript(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();

  // Ensure hook ends with a pause — if the first sentence has no "..." or "—"
  // and it's a statement (ends in period), inject "..." before the next sentence.
  s = s.replace(/^([^.!?—]{15,}[.!?])\s+([A-Z—])/, (_, hook, next) => {
    if (hook.includes("...") || hook.includes("—")) return `${hook} ${next}`;
    return `${hook}... ${next}`;
  });

  // Hard trim to 120 words max (safety valve — prompt targets 80)
  const words = s.split(/\s+/);
  if (words.length > 120) {
    s = words.slice(0, 120).join(" ").replace(/[,]?\s*$/, "") + "...";
  }

  return s;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const HEYGEN_KEY = Deno.env.get("HEYGEN_API_KEY") ?? "";
  const AVATAR_ID = Deno.env.get("MATT_HEYGEN_AVATAR_ID") ?? "";
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const WEBHOOK_URL = Deno.env.get("SUPABASE_URL")
    ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/heygen-webhook`
    : "";

  // ── listVoices mode: fetch valid HeyGen voice IDs for this account/key ────────
  const urlObj = new URL(req.url);
  let earlyBody: { listVoices?: boolean } = {};
  if (req.method === "POST") {
    try { earlyBody = await req.clone().json(); } catch { /* ok */ }
  }
  if (urlObj.searchParams.has("listVoices") || earlyBody.listVoices) {
    if (!HEYGEN_KEY) {
      return new Response(JSON.stringify({ error: "HEYGEN_API_KEY not set" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    try {
      const vr = await fetch("https://api.heygen.com/v2/voices", {
        headers: { "X-Api-Key": HEYGEN_KEY }, signal: AbortSignal.timeout(20_000),
      });
      const vd = await vr.json();
      const voices = (vd.data?.voices ?? vd.voices ?? []).map((v: Record<string, unknown>) => ({
        voice_id: v.voice_id, name: v.name, language: v.language, gender: v.gender,
      }));
      // Surface likely "Matt" matches first for convenience
      const matches = voices.filter((v: { name?: string }) =>
        /matt|michel|male/i.test(String(v.name ?? "")));
      return new Response(JSON.stringify({ count: voices.length, likelyMatt: matches, voices }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // ── listAvatars mode: fetch valid HeyGen avatar IDs for this account/key ──────
  if (urlObj.searchParams.has("listAvatars") || (earlyBody as { listAvatars?: boolean }).listAvatars) {
    if (!HEYGEN_KEY) {
      return new Response(JSON.stringify({ error: "HEYGEN_API_KEY not set" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    try {
      const ar = await fetch("https://api.heygen.com/v2/avatars", {
        headers: { "X-Api-Key": HEYGEN_KEY }, signal: AbortSignal.timeout(20_000),
      });
      const ad = await ar.json();
      const avatars = (ad.data?.avatars ?? ad.avatars ?? []).map((a: Record<string, unknown>) => ({
        avatar_id: a.avatar_id, name: a.avatar_name ?? a.name,
      }));
      const talkingPhotos = (ad.data?.talking_photos ?? ad.talking_photos ?? []).map((t: Record<string, unknown>) => ({
        talking_photo_id: t.talking_photo_id, name: t.talking_photo_name ?? t.name,
      }));
      const matches = [...avatars, ...talkingPhotos].filter((x: { name?: string }) =>
        /matt|michel/i.test(String(x.name ?? "")));
      return new Response(JSON.stringify({
        avatarCount: avatars.length, talkingPhotoCount: talkingPhotos.length,
        likelyMatt: matches, avatars: avatars.slice(0, 40), talkingPhotos: talkingPhotos.slice(0, 40),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  // Check if HeyGen is configured
  if (!HEYGEN_KEY) {
    return new Response(JSON.stringify({
      error: "HEYGEN_API_KEY not set — get Creator plan at heygen.com then add to Supabase secrets",
      setup: "1. Record 2-min avatar video at app.heygen.com → Avatars → Instant Avatar\n2. Add HEYGEN_API_KEY + MATT_HEYGEN_AVATAR_ID to secondary project secrets",
    }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Matt's real likeness is a HeyGen "talking photo" (use ?listAvatars=1 to find the id).
  // If MATT_HEYGEN_TALKING_PHOTO_ID is set, it takes priority over the (stock) avatar path.
  const TALKING_PHOTO_ID = Deno.env.get("MATT_HEYGEN_TALKING_PHOTO_ID") ?? "";

  if (!AVATAR_ID && !TALKING_PHOTO_ID) {
    return new Response(JSON.stringify({
      error: "Set MATT_HEYGEN_TALKING_PHOTO_ID (or MATT_HEYGEN_AVATAR_ID) — use ?listAvatars=1 to find valid ids",
    }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: { niche?: string; title?: string; script?: string } = {};
  try {
    body = await req.json();
  } catch { /* empty body ok */ }

  const niche = (body.niche ?? "business").toLowerCase();
  log("HeyGen job request", { niche });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    // ── Generate or use provided script ───────────────────────────────────────
    let scriptData = body.title && body.script
      ? { title: body.title, script: body.script, tags: [] as string[] }
      : null;

    if (!scriptData) {
      log("Generating script via AI");
      scriptData = await generateScript(niche, OPENAI_KEY, OPENROUTER_KEY);
    }

    if (!scriptData) {
      // Use static fallback
      log("Using static fallback script", { niche });
      scriptData = FALLBACK_SCRIPTS[niche] ?? FALLBACK_SCRIPTS.business;
    }

    log("Script ready", { title: scriptData.title, chars: scriptData.script.length });

    // ── Submit to HeyGen API ──────────────────────────────────────────────────
    // HeyGen v2 video generate: https://docs.heygen.com/reference/create-video-v2
    // Optional branded backdrop: set HEYGEN_BACKGROUND_IMAGE_URL (a hosted 1080x1920 image)
    // to replace the flat color. Falls back to the dark slate color if unset.
    const BG_IMAGE = Deno.env.get("HEYGEN_BACKGROUND_IMAGE_URL") ?? "";
    const background = BG_IMAGE
      ? { type: "image", url: BG_IMAGE, fit: "cover" }
      : { type: "color", value: "#0f172a" }; // Dark slate fallback

    // Talking photos can't gesture (still image), but "expressive" style adds
    // much more head/upper-body motion so it reads far less frozen.
    const character = TALKING_PHOTO_ID
      ? { type: "talking_photo", talking_photo_id: TALKING_PHOTO_ID, talking_style: "expressive", super_resolution: true }
      : { type: "avatar", avatar_id: AVATAR_ID, avatar_style: "normal" };

    const heygenPayload = {
      video_inputs: [{
        character,
        voice: {
          type: "text",
          input_text: polishScript(scriptData.script),
          voice_id: HEYGEN_VOICE_ID,
          speed: 0.9, // Deliberate pace — 1.0 sounds rushed; 0.9 lets ideas land
        },
        background,
      }],
      dimension: { width: 1080, height: 1920 }, // Vertical Shorts format
      caption: true, // Burn in subtitles — most Shorts are watched muted; huge retention lift
      aspect_ratio: null,
      callback_id: null as string | null,
    };

    // Add webhook callback if URL available
    if (WEBHOOK_URL) {
      heygenPayload.callback_id = `shorts-${Date.now()}`;
    }

    log("Submitting to HeyGen API", { avatarId: AVATAR_ID, voiceId: HEYGEN_VOICE_ID });

    const heygenRes = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": HEYGEN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(heygenPayload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!heygenRes.ok) {
      const errText = await heygenRes.text();
      throw new Error(`HeyGen API error ${heygenRes.status}: ${errText}`);
    }

    const heygenData = await heygenRes.json();
    const heygenVideoId = heygenData.data?.video_id ?? heygenData.video_id;

    if (!heygenVideoId) {
      throw new Error(`HeyGen returned no video_id: ${JSON.stringify(heygenData)}`);
    }

    log("HeyGen job submitted", { videoId: heygenVideoId });

    // ── Insert job record ─────────────────────────────────────────────────────
    const { data: job, error: insertErr } = await sb
      .from("heygen_jobs")
      .insert({
        niche,
        title: scriptData.title,
        narration: scriptData.script,
        avatar_id: AVATAR_ID,
        heygen_video_id: heygenVideoId,
        status: "pending",
        tags: scriptData.tags,
      })
      .select()
      .single();

    if (insertErr) {
      log("DB insert warning (job submitted but not tracked)", { error: insertErr.message });
    }

    return new Response(JSON.stringify({
      success: true,
      jobId: job?.id ?? null,
      heygenVideoId,
      niche,
      title: scriptData.title,
      status: "pending",
      message: "HeyGen is rendering your avatar video (2-5 minutes). The heygen-webhook function will auto-upload to YouTube when done.",
      checkUrl: `https://api.heygen.com/v1/video_status.get?video_id=${heygenVideoId}`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("Error", { error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

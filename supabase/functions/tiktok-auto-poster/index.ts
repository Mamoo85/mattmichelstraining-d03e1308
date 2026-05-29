// tiktok-auto-poster — generate + upload a TikTok Short using TikTok Content Posting API
// Reuses image/video generation from youtube-shorts-now (same MJPEG/AVI pipeline)
// POST body: { niche?: string, dryRun?: boolean }
// Requires: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET stored in Supabase Vault
//           TIKTOK_ACCESS_TOKEN stored in tiktok_oauth_tokens table
// Deploy when Matt has TikTok credentials approved (seller.tiktok.com + developers.tiktok.com)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[TIKTOK-POSTER] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ─── Themes — focused on lifestyle + side hustle content for max TikTok reach ───
interface Theme {
  niche: string;
  title: string;
  prompt: string;
  prompt2?: string;
  cta: string;
  hashtags: string[];
}

const THEMES: Theme[] = [
  // Side hustle / passive income — highest engagement niche on TikTok
  {
    niche: "sidehustle",
    title: "I make $200/month while I sleep — here's the automation",
    prompt: "Cozy dark home office at night — soft lamp glow on a laptop screen showing colorful product listings appearing automatically one by one, green revenue counter ticking up, calm productive night atmosphere, no readable text on screen",
    prompt2: "Flat lay of a phone on a wooden desk showing sales notification badges and rising chart icons, warm morning light, no readable text on screen",
    cta: "Link in bio to get the same system →",
    hashtags: ["#sidehustle", "#passiveincome", "#etsy", "#etsyseller", "#aitools", "#makemoneyonline", "#printondemand", "#automation", "#workfromhome", "#tiktokfinance"],
  },
  {
    niche: "sidehustle",
    title: "My AI posted 5 products on Etsy while I was at the gym",
    prompt: "Athletic person walking into a gym with a gym bag, phone in hand showing a notification screen with package and dollar sign icons stacked, bright gym entrance, no readable text on screen",
    prompt2: "Person lifting weights in a gym, phone propped on equipment showing a dashboard with rising green bars in the background, action shot, no readable text on screen",
    cta: "Want this for your store? Link in bio",
    hashtags: ["#sidehustle", "#etsyseller", "#passiveincome", "#gymlife", "#aitools", "#printondemand", "#automation", "#tiktokfinance", "#financetok", "#makemoney"],
  },
  {
    niche: "sidehustle",
    title: "This AI system runs my entire Etsy store — zero daily effort",
    prompt: "Top-down view of a minimalist home office desk — laptop open showing a grid of colorful product thumbnails auto-populating, coffee mug beside it, potted plant, clean white surface, no readable text on screen",
    prompt2: "Close-up of a laptop screen showing a pipeline flow diagram with arrows connecting colorful steps, progress indicators and green checkmarks, dark background, no readable text on screen",
    cta: "Comment 'AUTOPOD' and I'll send you the link",
    hashtags: ["#etsy", "#etsybusiness", "#sidehustle", "#aitools", "#passiveincome", "#printondemand", "#automation", "#smallbusiness", "#onlinebusiness", "#tiktokfinance"],
  },
  // Printable wall art niche — high purchase intent buyers on TikTok
  {
    niche: "wallart",
    title: "3 printable wall art files for under $5 — I framed all of them",
    prompt: "Stylish living room gallery wall with three matching framed art prints — minimalist botanical illustrations in sage green and cream tones, warm afternoon light casting soft shadows, modern home decor aesthetic, no text visible",
    prompt2: "Close-up of a hand holding a freshly printed minimalist botanical art print in front of a gallery wall, sage green line art on cream paper, elegant white frame nearby, no text visible",
    cta: "Link in bio — instant download prints",
    hashtags: ["#homedecor", "#wallart", "#printableart", "#homeinspo", "#interiordesign", "#gallerywall", "#etsy", "#etsyfinds", "#instantdownload", "#homeideas"],
  },
  {
    niche: "wallart",
    title: "How I decorated my whole apartment for $25 in printable art",
    prompt: "Bright airy apartment living room with multiple gallery walls — coordinating minimalist art prints in matching frames, natural light pouring through tall windows, clean Scandinavian aesthetic, no text visible",
    prompt2: "Person holding a stack of freshly printed art pages in front of a clean white wall with an empty frame ready to be hung, excited expression, modern apartment setting, no text visible",
    cta: "Get the prints I used → link in bio",
    hashtags: ["#homedecor", "#apartmentdecor", "#budgetdecor", "#printableart", "#wallart", "#homeinspo", "#etsyfinds", "#gallerywall", "#decorating", "#tiktokdecor"],
  },
  // Home gym / fitness
  {
    niche: "fitness",
    title: "The chart every home gym needs on the wall — I printed mine",
    prompt: "Clean bright home gym with motivational reference chart poster mounted on white wall above workout equipment — dumbbell rack in foreground, chart showing exercise diagrams in bold colors, inspirational professional aesthetic, no readable text on screen",
    prompt2: "Person standing in front of a home gym wall chart studying exercise diagrams, athletic wear, weights visible, chart has colorful illustrations with clear visual sections, no readable text visible",
    cta: "Printable chart → link in bio",
    hashtags: ["#homegym", "#garagegym", "#gymlife", "#fitness", "#workout", "#gymsetup", "#fitnessroutine", "#printableart", "#gyminspo", "#fitnessgoals"],
  },
];

// ─── Image Generation ────────────────────────────────────────────────────────

async function generateImage(prompt: string, openaiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "low",
      n: 1,
      output_format: "jpeg",
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Image gen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data from OpenAI");
  return b64;
}

// ─── Hallucination check ──────────────────────────────────────────────────────

async function checkHallucination(b64Jpeg: string, openrouterKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://zmyczlfuufhngzovkjdh.supabase.co",
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64Jpeg}` } },
            { type: "text", text: "Does this image contain any visible text, letters, words, numbers, characters, signs, labels, captions, or watermarks? Answer only YES or NO." },
          ],
        }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;
    const answer = ((await res.json())?.choices?.[0]?.message?.content ?? "").trim().toUpperCase();
    return answer.startsWith("YES");
  } catch {
    return false; // fail open — don't block on hallucination check infra failure
  }
}

// ─── AVI builder (MJPEG container — same as youtube-shorts-now) ──────────────

function buildAvi(frames: Uint8Array[], secsPerFrame = 4): Uint8Array {
  const W = 1024, H = 1024;
  const FPS = 1;
  const expanded: Uint8Array[] = [];
  for (const f of frames) {
    for (let i = 0; i < secsPerFrame; i++) expanded.push(f);
  }
  const frameCount = expanded.length;

  const u32 = (n: number) => { const b = new Uint8Array(4); b[0]=n&0xff; b[1]=(n>>8)&0xff; b[2]=(n>>16)&0xff; b[3]=(n>>24)&0xff; return b; };
  const u16 = (n: number) => { const b = new Uint8Array(2); b[0]=n&0xff; b[1]=(n>>8)&0xff; return b; };
  const cc  = (s: string) => new TextEncoder().encode(s.slice(0, 4).padEnd(4, " "));
  const cat = (...a: Uint8Array[]) => { const out = new Uint8Array(a.reduce((n,x)=>n+x.length,0)); let i=0; for(const x of a){out.set(x,i);i+=x.length;} return out; };

  const chunk = (id: string, data: Uint8Array): Uint8Array => {
    const pad = data.length % 2;
    const buf = new Uint8Array(8 + data.length + pad);
    buf.set(cc(id), 0); buf.set(u32(data.length), 4); buf.set(data, 8);
    return buf;
  };
  const list = (type: string, data: Uint8Array) => chunk("LIST", cat(cc(type), data));

  const avih = cat(
    u32(1_000_000 / FPS), u32(0), u32(0), u32(0x10),
    u32(frameCount), u32(0), u32(1), u32(0),
    u32(W), u32(H),
    u32(0), u32(0), u32(0), u32(0),
  );
  const strh = cat(
    cc("vids"), cc("MJPG"),
    u32(0), u16(0), u16(0), u32(0),
    u32(1), u32(FPS),
    u32(0), u32(frameCount),
    u32(0), u32(0xffffffff), u32(0),
    u16(0), u16(0), u16(W), u16(H),
  );
  const strf = cat(
    u32(40), u32(W), u32(H),
    u16(1), u16(24),
    cc("MJPG"),
    u32(W * H * 3),
    u32(0), u32(0), u32(0), u32(0),
  );
  const strl = list("strl", cat(chunk("strh", strh), chunk("strf", strf)));
  const hdrl = list("hdrl", cat(chunk("avih", avih), strl));
  const moviFrames = expanded.map(f => chunk("00dc", f));
  const moviList   = chunk("LIST", cat(cc("movi"), ...moviFrames));
  let off = 4;
  const idxEntries = expanded.map(f => {
    const e = cat(cc("00dc"), u32(0x10), u32(off), u32(f.length));
    off += 8 + f.length + (f.length % 2);
    return e;
  });
  const idx1 = chunk("idx1", cat(...idxEntries));
  return chunk("RIFF", cat(cc("AVI "), hdrl, moviList, idx1));
}

// ─── TikTok OAuth token refresh ───────────────────────────────────────────────

async function refreshTikTokToken(
  sb: ReturnType<typeof createClient>,
  tokenRow: Record<string, string>,
  clientKey: string,
  clientSecret: string
): Promise<string> {
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) return tokenRow.access_token;

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`TikTok token refresh failed (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await sb.from("tiktok_oauth_tokens").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokenRow.refresh_token,
    expires_at: newExpiry,
    updated_at: new Date().toISOString(),
  }).eq("id", tokenRow.id);

  log("TikTok token refreshed");
  return data.access_token;
}

// ─── TikTok Content Posting API upload ───────────────────────────────────────
// Uses FILE_UPLOAD chunk method (not PULL_FROM_URL) so we control the byte stream
// Docs: https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide

async function uploadToTikTok(
  videoBytes: Uint8Array,
  title: string,
  hashtags: string[],
  accessToken: string,
): Promise<string> {
  // Step 1: Initialize upload
  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: `${title} ${hashtags.join(" ")}`.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoBytes.length,
        chunk_size: videoBytes.length,   // single-chunk upload
        total_chunk_count: 1,
      },
    }),
  });

  if (!initRes.ok) {
    const errBody = await initRes.text().catch(() => "");
    throw new Error(`TikTok init upload failed (${initRes.status}): ${errBody.slice(0, 300)}`);
  }

  const initData = await initRes.json();
  const publishId = initData?.data?.publish_id;
  const uploadUrl = initData?.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new Error(`TikTok init: missing publish_id or upload_url — ${JSON.stringify(initData)}`);
  }

  log("TikTok upload init", { publishId, videoSize: videoBytes.length });

  // Step 2: Upload chunk
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/avi",
      "Content-Length": String(videoBytes.length),
      "Content-Range": `bytes 0-${videoBytes.length - 1}/${videoBytes.length}`,
    },
    body: videoBytes,
    signal: AbortSignal.timeout(120_000),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text().catch(() => "");
    throw new Error(`TikTok chunk upload failed (${uploadRes.status}): ${err.slice(0, 200)}`);
  }

  log("TikTok chunk uploaded", { publishId });
  return publishId;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const CLIENT_KEY    = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "";
  const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
  const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") ?? "";
  const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validate required env
  if (!OPENAI_KEY) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  const nicheFilter = (body.niche as string) ?? null;
  const dryRun      = body.dryRun === true;

  // Pick theme
  const candidates = nicheFilter
    ? THEMES.filter(t => t.niche === nicheFilter)
    : THEMES;
  const theme = candidates[Math.floor(Math.random() * candidates.length)];

  // Phase 3c: build track-click URL for the bio link (set this as your TikTok bio link).
  // TikTok doesn't support clickable in-post URLs, so we route via bio link.
  // The track URL captures channel=tiktok + campaign=niche in link_clicks.
  // TODO Phase 4: store MP4 in Supabase Storage via youtube-shorts-now and pull url from youtube_shorts.mp4_url
  const shopUrl = "https://www.etsy.com/shop/mattmichelstraining";
  const trackUrl = `${SUPABASE_URL}/functions/v1/track-click?u=${encodeURIComponent(btoa(shopUrl))}&channel=tiktok&campaign=${encodeURIComponent(theme.niche)}`;
  log("Theme selected", { niche: theme.niche, title: theme.title, dryRun, trackUrl });

  // Dry run — return theme without generating or uploading
  if (dryRun) {
    return new Response(
      JSON.stringify({ dryRun: true, theme: { niche: theme.niche, title: theme.title }, trackUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Credential check
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    return new Response(
      JSON.stringify({
        error: "Missing TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET",
        hint: "Add these to Supabase Vault after TikTok Developer approval at developers.tiktok.com",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Load TikTok OAuth tokens
  const { data: tokenRows } = await sb
    .from("tiktok_oauth_tokens")
    .select("*")
    .order("updated_at", { ascending: true });

  if (!tokenRows || tokenRows.length === 0) {
    return new Response(
      JSON.stringify({ error: "No TikTok tokens — complete OAuth flow at /tiktok-oauth-start" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // ── Generate 2 images ──────────────────────────────────────────────────
    const ANTITEXT_SUFFIXES = [
      ", absolutely no text no letters no words no numbers no characters — purely visual",
      ", CRITICAL: zero text zero letters zero words — only colors shapes and composition",
      ", FINAL ATTEMPT: completely text-free — no writing of any kind",
    ];

    const images: Uint8Array[] = [];
    for (let v = 0; v < 2; v++) {
      const basePrompt = v === 0
        ? theme.prompt
        : (theme.prompt2 ?? theme.prompt + ", variation, different angle");

      let frameBytes: Uint8Array | null = null;
      for (let attempt = 0; attempt < ANTITEXT_SUFFIXES.length; attempt++) {
        const b64 = await generateImage(basePrompt + ANTITEXT_SUFFIXES[attempt], OPENAI_KEY);
        const hasText = await checkHallucination(b64, OPENROUTER_KEY);
        if (!hasText) {
          frameBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          log(`Image ${v+1}/2 passed hallucination check`, { attempt: attempt + 1 });
          break;
        }
        log(`Image ${v+1}/2 attempt ${attempt + 1} rejected (text detected)`);
      }
      if (!frameBytes) throw new Error(`Image ${v+1} failed hallucination check after ${ANTITEXT_SUFFIXES.length} attempts`);
      images.push(frameBytes);
    }

    // ── Build video (8s total — 2 frames × 4s each) ────────────────────────
    log("Building AVI video");
    const videoBytes = buildAvi(images, 4);
    log("Video built", { bytes: videoBytes.length });

    // ── Upload to every authorized TikTok account ──────────────────────────
    const uploaded: string[] = [];
    for (const tokenRow of tokenRows) {
      try {
        const accessToken = await refreshTikTokToken(sb, tokenRow, CLIENT_KEY, CLIENT_SECRET);
        log("Uploading to TikTok account", { account: tokenRow.display_name ?? tokenRow.id });
        const publishId = await uploadToTikTok(videoBytes, theme.title, theme.hashtags, accessToken);
        log("Upload complete", { publishId });

        // Track in DB
        await sb.from("tiktok_posts").insert({
          publish_id: publishId,
          title: theme.title,
          niche: theme.niche,
          hashtags: theme.hashtags,
          status: "processing",
          posted_at: new Date().toISOString(),
        });

        uploaded.push(publishId);
      } catch (chErr) {
        log("TikTok account upload failed (non-fatal)", { account: tokenRow.id, err: String(chErr) });
      }
    }

    if (uploaded.length === 0) throw new Error("Upload failed for all TikTok accounts");

    return new Response(
      JSON.stringify({
        success: true,
        publishIds: uploaded,
        niche: theme.niche,
        title: theme.title,
        trackUrl,
        note: "TikTok processes videos async — publishId status can be checked at /v2/post/publish/status/fetch/. Set trackUrl as your TikTok bio link to capture click attribution.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// dwa-ad-background-generator — Builds a 30s 16:9 background slideshow video for DWA Meta ads
//
// 6 slides × 5 seconds = 30 seconds total:
//   Slide 1: Thum.io screenshot of detroitwebagent.com — hook text overlay
//   Slide 2: AI-generated Google Maps local rankings mockup
//   Slide 3: AI-generated automation dashboard (review texts / payments)
//   Slide 4: AI-generated competitor pricing comparison table
//   Slide 5: Pure branded SVG slide — "7-Day FREE Trial · From $297/mo"
//   Slide 6: Thum.io contact page screenshot — CTA close
//
// Output: 30s MJPEG AVI at 1280×720 (16:9), uploaded to Supabase Storage ad-creatives/dwa-backgrounds/
//
// POST {}              — generate and return public URL (~2 min, costs ~$0.13)
// POST {"dryRun":true} — return slide plan without generating
//
// Required secrets (secondary project zmyczlfuufhngzovkjdh):
//   OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import sharp from "npm:sharp@0.33.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[DWA-BG-GEN] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Canvas size (16:9 landscape — optimal for Meta Feed product demos) ────────
const W = 1280;
const H = 720;

// ── DWA Brand colors ──────────────────────────────────────────────────────────
const DWA_BLUE = "#1d4ed8";
const DWA_DARK = "#0f172a";
const DWA_LIGHT_BLUE = "#93c5fd";

// ── Slide definitions ─────────────────────────────────────────────────────────
interface Slide {
  type: "screenshot" | "ai" | "branded";
  url?: string;
  prompt?: string;
  headline: string;
  sub: string;
  secs: number;
}

const SLIDES: Slide[] = [
  {
    type: "screenshot",
    url: "https://detroitwebagent.com",
    headline: "Most local businesses get zero calls from their website.",
    sub: "Not because of bad work — because no one can find them.",
    secs: 5,
  },
  {
    type: "ai",
    prompt: "Professional UI mockup of a Google Maps local business search showing plumber ranking #1 in the local 3-pack with 5-star reviews and call button, laptop screen, dark background studio lighting, no real business names, UI labels not readable",
    headline: "We build sites that actually rank on Google.",
    sub: "In weeks. Not months.",
    secs: 5,
  },
  {
    type: "ai",
    prompt: "Dark-themed CRM dashboard on laptop screen showing automated SMS sequences with green sent checkmarks, review request notifications, payment link confirmations, appointment reminders, professional clean software UI, no readable text details, dramatic studio lighting",
    headline: "Auto review texts. Payment links. Appointment reminders.",
    sub: "All included. Zero extras.",
    secs: 5,
  },
  {
    type: "ai",
    prompt: "Minimalist dark UI comparison table with three columns — two generic agencies on left grayed out, rightmost column highlighted bright blue for the winning option, checkmarks vs X marks, professional SaaS pricing table design, no readable text",
    headline: "Your competitors pay more... for less.",
    sub: "DWA delivers more for $297/mo.",
    secs: 5,
  },
  {
    type: "branded",
    headline: "7-Day FREE Trial",
    sub: "From $297/mo · No contracts · Cancel anytime",
    secs: 5,
  },
  {
    type: "screenshot",
    url: "https://detroitwebagent.com",
    headline: "Ready to get more calls from your website?",
    sub: "Visit DetroitWebAgent.com",
    secs: 5,
  },
];

// ── Screenshot capture via Thum.io (free, no API key) ─────────────────────────
async function fetchScreenshot(pageUrl: string): Promise<Buffer> {
  const thumbUrl = `https://image.thum.io/get/width/${W}/crop/${H}/${encodeURIComponent(pageUrl)}`;
  log("Fetching screenshot", { url: thumbUrl.slice(0, 100) });
  const res = await fetch(thumbUrl, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Thum.io ${res.status} for ${pageUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  log("Screenshot fetched", { bytes: buf.length });
  return buf;
}

// ── AI image generation via gpt-image-1 (~$0.042/image) ──────────────────────
async function generateAiImage(prompt: string, openaiKey: string): Promise<Buffer> {
  log("Generating AI image", { prompt: prompt.slice(0, 70) + "..." });
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
  if (!res.ok) throw new Error(`OpenAI image gen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data from OpenAI");
  const buf = Buffer.from(b64, "base64");
  log("AI image generated", { bytes: buf.length });
  return buf;
}

// ── Branded SVG slide (no external calls) ─────────────────────────────────────
async function buildBrandedSlide(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${DWA_DARK}"/>
        <stop offset="100%" stop-color="#1e3a8a"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <!-- Decorative lines -->
    <rect x="64" y="${H * 0.28}" width="${W - 128}" height="2" fill="${DWA_BLUE}" opacity="0.5"/>
    <rect x="64" y="${H * 0.78}" width="${W - 128}" height="2" fill="${DWA_BLUE}" opacity="0.5"/>
    <!-- Brand name -->
    <text x="${W / 2}" y="${H * 0.24}" text-anchor="middle"
          font-family="Arial Black,Arial,sans-serif" font-size="26" font-weight="900"
          fill="${DWA_BLUE}" letter-spacing="4">DETROIT WEB AGENCY</text>
    <!-- Main headline -->
    <text x="${W / 2}" y="${H * 0.5}" text-anchor="middle"
          font-family="Arial Black,Arial,sans-serif" font-size="88" font-weight="900"
          fill="white">7-Day FREE Trial</text>
    <!-- Sub -->
    <text x="${W / 2}" y="${H * 0.64}" text-anchor="middle"
          font-family="Arial,sans-serif" font-size="30" fill="${DWA_LIGHT_BLUE}">From $297/mo  ·  No contracts  ·  Cancel anytime</text>
    <!-- CTA button -->
    <rect x="${W / 2 - 140}" y="${H * 0.72}" width="280" height="52" rx="8" fill="${DWA_BLUE}"/>
    <text x="${W / 2}" y="${H * 0.72 + 34}" text-anchor="middle"
          font-family="Arial Black,Arial,sans-serif" font-size="20" font-weight="bold"
          fill="white">Start Free Trial Today</text>
    <!-- Domain -->
    <text x="${W / 2}" y="${H * 0.92}" text-anchor="middle"
          font-family="Arial,sans-serif" font-size="22" fill="#475569">DetroitWebAgent.com</text>
  </svg>`;
  return await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

// ── XML escape helper ─────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Text overlay: gradient + headline + sub on any image buffer ────────────────
async function addTextOverlay(imageBuffer: Buffer, headline: string, sub: string): Promise<Buffer> {
  // Resize/crop base image to canvas size
  const base = await sharp(imageBuffer)
    .resize(W, H, { fit: "cover", position: "center" })
    .jpeg({ quality: 88 })
    .toBuffer();

  // Word-wrap headline at ~42 chars per line (larger font needs fewer chars)
  const words = headline.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (candidate.length > 42 && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const fontSize = 48;
  const lineH = 60;
  const headlineBlockH = lines.length * lineH;
  // Position: headline ends ~100px from bottom, sub is below it
  const headlineTopY = H - headlineBlockH - 80;

  const textElems = lines
    .map((l, i) => `<text x="${W / 2}" y="${headlineTopY + i * lineH}"
        text-anchor="middle"
        font-family="Arial Black,Arial,sans-serif"
        font-size="${fontSize}" font-weight="900"
        fill="white" stroke="${DWA_DARK}" stroke-width="2" paint-order="stroke">${esc(l)}</text>`)
    .join("\n    ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="35%" stop-color="transparent" stop-opacity="0"/>
        <stop offset="100%" stop-color="${DWA_DARK}" stop-opacity="0.88"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#grad)"/>
    ${textElems}
    <text x="${W / 2}" y="${H - 24}" text-anchor="middle"
          font-family="Arial,sans-serif" font-size="26"
          fill="${DWA_LIGHT_BLUE}" stroke="${DWA_DARK}" stroke-width="1" paint-order="stroke">${esc(sub)}</text>
  </svg>`;

  return await sharp(base)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

// ── MJPEG AVI builder (copied from youtube-shorts-now) ────────────────────────
function buildAvi(
  frames: Uint8Array[],
  durationsInSeconds: number[],
  vidW = 1280,
  vidH = 720,
): Uint8Array {
  const FPS = 1;

  const expanded: Uint8Array[] = [];
  for (let i = 0; i < frames.length; i++) {
    const secs = durationsInSeconds[i] ?? 2;
    for (let j = 0; j < secs; j++) expanded.push(frames[i]);
  }
  const frameCount = expanded.length;

  const u32 = (n: number) => { const b = new Uint8Array(4); b[0]=n&0xff; b[1]=(n>>8)&0xff; b[2]=(n>>16)&0xff; b[3]=(n>>24)&0xff; return b; };
  const u16 = (n: number) => { const b = new Uint8Array(2); b[0]=n&0xff; b[1]=(n>>8)&0xff; return b; };
  const cc  = (s: string) => { const buf = new Uint8Array(4); const enc = new TextEncoder().encode(s.slice(0, 4)); buf.set(enc); return buf; };
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
    u32(vidW), u32(vidH),
    u32(0), u32(0), u32(0), u32(0),
  );
  const vidStrh = cat(
    cc("vids"), cc("MJPG"),
    u32(0), u16(0), u16(0), u32(0),
    u32(1), u32(FPS),
    u32(0), u32(frameCount),
    u32(0), u32(0xffffffff), u32(0),
    u16(0), u16(0), u16(vidW), u16(vidH),
  );
  const vidStrf = cat(
    u32(40), u32(vidW), u32(vidH),
    u16(1), u16(24),
    cc("MJPG"),
    u32(vidW * vidH * 3),
    u32(0), u32(0), u32(0), u32(0),
  );
  const vidStrl = list("strl", cat(chunk("strh", vidStrh), chunk("strf", vidStrf)));
  const hdrl = list("hdrl", cat(chunk("avih", avih), vidStrl));

  const moviChunks: Uint8Array[] = [];
  for (const frame of expanded) moviChunks.push(chunk("00dc", frame));
  const moviList = chunk("LIST", cat(cc("movi"), ...moviChunks));

  let off = 4;
  const idxEntries: Uint8Array[] = [];
  for (const frame of expanded) {
    const pad = frame.length % 2;
    idxEntries.push(cat(cc("00dc"), u32(0x10), u32(off), u32(frame.length)));
    off += 8 + frame.length + pad;
  }
  const idx1 = chunk("idx1", cat(...idxEntries));

  return chunk("RIFF", cat(cc("AVI "), hdrl, moviList, idx1));
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

  let body: { dryRun?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const dryRun = body.dryRun === true;

  if (dryRun) {
    const aiCount = SLIDES.filter(s => s.type === "ai").length;
    return json({
      dryRun: true,
      totalSlides: SLIDES.length,
      totalSecs: SLIDES.reduce((a, s) => a + s.secs, 0),
      resolution: `${W}×${H} (16:9 landscape)`,
      estimatedCost: `~$${(aiCount * 0.042).toFixed(2)} (${aiCount} AI images @ gpt-image-1 low quality)`,
      slides: SLIDES.map((s, i) => ({
        index: i + 1,
        type: s.type,
        secs: s.secs,
        headline: s.headline,
        sub: s.sub,
        ...(s.type === "screenshot" ? { screenshotUrl: s.url } : {}),
        ...(s.type === "ai" ? { aiPrompt: s.prompt!.slice(0, 70) + "..." } : {}),
      })),
      usage: {
        live: 'POST {} — generate and upload (takes ~2 min)',
        withCustomScript: 'No script customization needed — this is the background video only',
        chainWithHeyGen: 'Pass the returned backgroundVideoUrl to dwa-video-ad: POST {"backgroundVideoUrl":"<url>"}',
      },
    });
  }

  if (!OPENAI_KEY) return json({ error: "OPENAI_API_KEY not set" }, 400);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Supabase secrets not set" }, 400);

  try {
    const frames: Uint8Array[] = [];
    const durations: number[] = [];

    for (const [i, slide] of SLIDES.entries()) {
      log(`Building slide ${i + 1}/${SLIDES.length}`, { type: slide.type });

      let jpegBuffer: Buffer;

      if (slide.type === "branded") {
        jpegBuffer = await buildBrandedSlide();
        log(`Slide ${i + 1} (branded) built`, { bytes: jpegBuffer.length });
      } else if (slide.type === "screenshot") {
        let imgBuf: Buffer;
        try {
          imgBuf = await fetchScreenshot(slide.url!);
        } catch (e) {
          log(`Screenshot failed for slide ${i + 1}, using dark fallback`, { error: String(e) });
          // Dark gradient fallback if Thum.io is unavailable
          imgBuf = await sharp({
            create: { width: W, height: H, channels: 3, background: { r: 15, g: 23, b: 42 } },
          }).jpeg({ quality: 85 }).toBuffer();
        }
        jpegBuffer = await addTextOverlay(imgBuf, slide.headline, slide.sub);
        log(`Slide ${i + 1} (screenshot) built`, { bytes: jpegBuffer.length });
      } else {
        // AI-generated
        let imgBuf: Buffer;
        try {
          imgBuf = await generateAiImage(slide.prompt!, OPENAI_KEY);
        } catch (e) {
          log(`AI image failed for slide ${i + 1}, using dark fallback`, { error: String(e) });
          imgBuf = await sharp({
            create: { width: W, height: H, channels: 3, background: { r: 15, g: 23, b: 42 } },
          }).jpeg({ quality: 85 }).toBuffer();
        }
        jpegBuffer = await addTextOverlay(imgBuf, slide.headline, slide.sub);
        log(`Slide ${i + 1} (ai) built`, { bytes: jpegBuffer.length });
      }

      frames.push(new Uint8Array(jpegBuffer.buffer, jpegBuffer.byteOffset, jpegBuffer.byteLength));
      durations.push(slide.secs);
    }

    log("All slides built — assembling AVI", { frames: frames.length, totalSecs: durations.reduce((a, b) => a + b, 0) });
    const aviBytes = buildAvi(frames, durations, W, H);
    log("AVI assembled", { bytes: aviBytes.length });

    // Upload to Supabase Storage
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Ensure bucket exists
    await sb.storage.createBucket("ad-creatives", { public: true }).catch(() => {});

    const filename = `dwa-background-${Date.now()}.avi`;
    const storagePath = `dwa-backgrounds/${filename}`;

    const { error: uploadErr } = await sb.storage
      .from("ad-creatives")
      .upload(storagePath, aviBytes, { contentType: "video/avi", upsert: false });

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: urlData } = sb.storage.from("ad-creatives").getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl ?? "";
    log("Uploaded to Supabase Storage", { url: publicUrl });

    return json({
      success: true,
      backgroundVideoUrl: publicUrl,
      storagePath,
      totalSecs: durations.reduce((a, b) => a + b, 0),
      slides: frames.length,
      bytes: aviBytes.length,
      nextStep: `POST {"backgroundVideoUrl":"${publicUrl}"} to dwa-video-ad to submit to HeyGen`,
    });

  } catch (err) {
    log("ERROR", { message: String(err) });
    return json({ error: String(err) }, 500);
  }
});

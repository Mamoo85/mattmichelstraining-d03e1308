// ad-creative-studio — AI-generated static ad creatives for Meta, YouTube & TikTok
// Generates N concept variations × M platform formats per call.
//
// Formats:
//   Meta:    meta_feed (1080×1080) · meta_story (1080×1920) · meta_link (1200×628)
//   YouTube: yt_thumbnail (1280×720) · yt_shorts (1080×1920)
// Concepts: lifestyle · product_hero · social_proof
//
// Two rendering modes (auto-detected):
//   FULL: sharp available → resize base image + SVG text overlay composited in
//   FALLBACK: sharp unavailable → gpt-image-1 generates per-aspect-ratio images, uploaded raw
//             Text copy (headline/subhead/CTA) returned in JSON for manual overlay
//
// POST body:
//   { product, tagline?, cta?, ctaUrl?, brandColor?, niche?, formats?, variations?, platform? }
//   platform: 'meta' (default) | 'youtube' | 'all'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[AD-STUDIO] ${step}${data !== undefined ? " — " + JSON.stringify(data) : ""}`);

// ── Platform format specs ────────────────────────────────────────────────────
const FORMATS: Record<string, { w: number; h: number; label: string; platform: string }> = {
  meta_feed:    { w: 1080, h: 1080, label: "Meta Feed (1:1)",              platform: "meta"    },
  meta_story:   { w: 1080, h: 1920, label: "Meta Stories/Reels (9:16)",    platform: "meta"    },
  meta_link:    { w: 1200, h: 628,  label: "Meta Link Preview (1.91:1)",   platform: "meta"    },
  yt_thumbnail: { w: 1280, h: 720,  label: "YouTube Thumbnail (16:9)",     platform: "youtube" },
  yt_shorts:    { w: 1080, h: 1920, label: "YouTube Shorts (9:16)",        platform: "youtube" },
};

// gpt-image-1 size to use per format in fallback mode (no sharp)
const FALLBACK_SIZE: Record<string, string> = {
  meta_feed:    "1024x1024",  // square
  meta_story:   "1024x1536",  // portrait
  yt_shorts:    "1024x1536",  // portrait (same)
  meta_link:    "1536x1024",  // landscape
  yt_thumbnail: "1536x1024",  // landscape (same)
};

const DEFAULT_FORMATS = ["meta_feed", "meta_story", "meta_link"];
const YOUTUBE_FORMATS = ["yt_thumbnail", "yt_shorts"];

// ── Niche → brand color palette ───────────────────────────────────────────────
const NICHE_COLORS: Record<string, string> = {
  nurse:       "#E91E63",
  teacher:     "#3F51B5",
  dog:         "#FF9800",
  fitness:     "#F44336",
  trades:      "#FF6F00",
  coffee:      "#4E342E",
  cooking:     "#E65100",
  running:     "#1B5E20",
  woodworking: "#795548",
  photography: "#1A237E",
  welding:     "#37474F",
  funny:       "#9C27B0",
  default:     "#1565C0",
};

function getBrandColor(niche: string, userColor?: string): string {
  if (userColor) return userColor;
  const key = Object.keys(NICHE_COLORS).find(k => niche.toLowerCase().includes(k));
  return key ? NICHE_COLORS[key] : NICHE_COLORS.default;
}

// ── Try loading sharp at module start (non-blocking) ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharpReady: Promise<any | null> = import("npm:sharp@0.33.4")
  .then((m: any) => { log("sharp loaded ✓"); return m.default ?? m; })
  .catch((e: unknown) => { log("sharp unavailable — fallback mode", { err: String(e).slice(0, 80) }); return null; });

// ── Creative concept generator (GPT-4o-mini) ─────────────────────────────────
interface Concept {
  name: "lifestyle" | "product_hero" | "social_proof";
  headline: string;
  subhead: string;
  imagePrompt: string;
  colorScheme: string;
}

async function generateConcepts(
  product: string,
  tagline: string,
  niche: string,
  count: number,
  openaiKey: string,
): Promise<Concept[]> {
  const systemPrompt = `You are an expert Meta & YouTube ad copywriter.
Generate ${count} creative concept(s) for a social media ad.
STRICT RULES:
- headline: max 42 characters, punchy hook, no emoji
- subhead: max 88 characters, specific benefit or social proof, no emoji
- imagePrompt: LIFESTYLE SCENE for gpt-image-1. NO TEXT in image. Real people or settings.
- colorScheme: 2-4 word mood descriptor
CONCEPT TYPES (use each once if count=3):
- "lifestyle": real person using/gifting in beautiful setting
- "product_hero": clean dramatic background, product implied
- "social_proof": crowd scene, group photo, celebration
Return JSON array ONLY. No markdown.`;

  const userPrompt = `Product: "${product}"\nTagline: "${tagline}"\nNiche: "${niche}"\nCount: ${count}\n[{"name":"lifestyle","headline":"<42ch>","subhead":"<88ch>","imagePrompt":"<no text>","colorScheme":"warm earthy"}]`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.8,
      max_tokens: 800,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) throw new Error(`GPT concept error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  const arr: Concept[] = Array.isArray(parsed) ? parsed : (parsed.concepts ?? parsed.variations ?? [parsed]);
  return arr.slice(0, count).map((c: Partial<Concept> & { [k: string]: unknown }) => ({
    name: (c.name ?? "lifestyle") as Concept["name"],
    headline: String(c.headline ?? product).slice(0, 42),
    subhead:  String(c.subhead  ?? tagline).slice(0, 88),
    imagePrompt: String(c.imagePrompt ?? `beautiful lifestyle scene related to ${product}`),
    colorScheme: String(c.colorScheme ?? "vibrant modern"),
  }));
}

// ── gpt-image-1 background generation ────────────────────────────────────────
async function generateBaseImage(
  prompt: string,
  openaiKey: string,
  size = "1024x1024",
): Promise<Buffer> {
  const fullPrompt = `${prompt}. High-quality photography style. Vibrant colors, professional composition. CRITICAL: NO TEXT, NO LETTERS, NO WORDS, NO LABELS anywhere.`;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt: fullPrompt, n: 1, size, output_format: "jpeg", quality: "medium" }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`gpt-image-1 error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");
  return Buffer.from(b64, "base64");
}

// ── SVG overlay builder ───────────────────────────────────────────────────────
function buildOverlaySvg(w: number, h: number, format: string, headline: string, subhead: string, cta: string, brandColor: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const H = esc(headline), S = esc(subhead), C = esc(cta);

  if (format === "yt_thumbnail") {
    const panelW = Math.round(w * 0.58), headlinePx = Math.round(h * 0.13), subheadPx = Math.round(h * 0.062), pad = Math.round(w * 0.045);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity="0.90"/>
    <stop offset="80%" stop-color="#000" stop-opacity="0.68"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="${panelW + 80}" height="${h}" fill="url(#p)"/>
  <rect x="${pad}" y="${Math.round(h * 0.18)}" width="6" height="${Math.round(h * 0.64)}" rx="3" fill="${brandColor}"/>
  <text x="${pad + 22}" y="${Math.round(h * 0.40)}" font-family="'Arial Black',Arial,sans-serif" font-size="${headlinePx}" font-weight="900" fill="white" dominant-baseline="middle">${H.slice(0, 21)}</text>
  ${H.length > 21 ? `<text x="${pad + 22}" y="${Math.round(h * 0.58)}" font-family="'Arial Black',Arial,sans-serif" font-size="${headlinePx}" font-weight="900" fill="white" dominant-baseline="middle">${H.slice(21)}</text>` : ""}
  <text x="${pad + 22}" y="${Math.round(h * 0.78)}" font-family="Arial,sans-serif" font-size="${subheadPx}" fill="rgba(255,255,255,0.85)" dominant-baseline="middle">${S.slice(0, 44)}</text>
  <rect x="0" y="${h - 8}" width="${w}" height="8" fill="${brandColor}" opacity="0.9"/>
</svg>`;
  }

  if (format === "meta_link") {
    const panelW = Math.round(w * 0.55);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="#000" stop-opacity="0.88"/>
    <stop offset="85%" stop-color="#000" stop-opacity="0.72"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="${panelW + 60}" height="${h}" fill="url(#p)"/>
  <rect x="48" y="${Math.round(h * 0.22)}" width="5" height="${Math.round(h * 0.56)}" rx="3" fill="${brandColor}"/>
  <text x="72" y="${Math.round(h * 0.38)}" font-family="'Arial Black',Arial,sans-serif" font-size="${Math.round(h * 0.095)}" font-weight="900" fill="white" dominant-baseline="middle">${H}</text>
  <text x="72" y="${Math.round(h * 0.55)}" font-family="Arial,sans-serif" font-size="${Math.round(h * 0.048)}" fill="rgba(255,255,255,0.88)" dominant-baseline="middle">${S.slice(0, 44)}</text>
  <text x="72" y="${Math.round(h * 0.64)}" font-family="Arial,sans-serif" font-size="${Math.round(h * 0.048)}" fill="rgba(255,255,255,0.88)" dominant-baseline="middle">${S.slice(44, 88)}</text>
  <rect x="72" y="${Math.round(h * 0.74)}" width="${Math.round(w * 0.22)}" height="${Math.round(h * 0.11)}" rx="${Math.round(h * 0.055)}" fill="${brandColor}"/>
  <text x="${72 + Math.round(w * 0.11)}" y="${Math.round(h * 0.795)}" text-anchor="middle" font-family="'Arial Black',Arial,sans-serif" font-size="${Math.round(h * 0.048)}" font-weight="700" fill="white" dominant-baseline="middle">${C}</text>
</svg>`;
  }

  const isStory = format === "meta_story" || format === "yt_shorts";
  const gs = isStory ? 0.52 : 0.48, hy = isStory ? Math.round(h * 0.70) : Math.round(h * 0.65);
  const sy = isStory ? Math.round(h * 0.78) : Math.round(h * 0.76), cy = Math.round(h * 0.87);
  const hp = isStory ? Math.round(h * 0.048) : Math.round(h * 0.058), sp = isStory ? Math.round(h * 0.026) : Math.round(h * 0.030);
  const bw = isStory ? Math.round(w * 0.52) : Math.round(w * 0.54), bh = isStory ? Math.round(h * 0.058) : Math.round(h * 0.07);
  const cp = isStory ? Math.round(h * 0.024) : Math.round(h * 0.030), pad = Math.round(w * 0.07);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="${gs}" x2="0" y2="1">
    <stop offset="0%" stop-color="#000" stop-opacity="0"/>
    <stop offset="40%" stop-color="#000" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.92"/>
  </linearGradient></defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="${pad}" y="${hy - Math.round(h * 0.052)}" width="${Math.round(w * 0.12)}" height="4" rx="2" fill="${brandColor}"/>
  <text x="${pad}" y="${hy}" font-family="'Arial Black',Arial,sans-serif" font-size="${hp}" font-weight="900" fill="white" dominant-baseline="middle">${H}</text>
  <text x="${pad}" y="${sy}" font-family="Arial,sans-serif" font-size="${sp}" fill="rgba(255,255,255,0.85)" dominant-baseline="middle">${S.slice(0, 46)}</text>
  ${S.length > 46 ? `<text x="${pad}" y="${sy + Math.round(sp * 1.4)}" font-family="Arial,sans-serif" font-size="${sp}" fill="rgba(255,255,255,0.85)" dominant-baseline="middle">${S.slice(46, 88)}</text>` : ""}
  <rect x="${pad}" y="${cy - Math.round(bh / 2)}" width="${bw}" height="${bh}" rx="${Math.round(bh / 2)}" fill="${brandColor}"/>
  <text x="${pad + Math.round(bw / 2)}" y="${cy}" text-anchor="middle" font-family="'Arial Black',Arial,sans-serif" font-size="${cp}" font-weight="700" fill="white" dominant-baseline="middle">${C}</text>
</svg>`;
}

// ── Composite one ad image (requires sharp) ───────────────────────────────────
// deno-lint-ignore no-explicit-any
async function compositeAd(sharpFn: any, baseJpeg: Buffer, format: string, headline: string, subhead: string, cta: string, brandColor: string): Promise<Buffer> {
  const { w, h } = FORMATS[format];
  const resized = await sharpFn(baseJpeg).resize(w, h, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toBuffer();
  const svgBuf = Buffer.from(buildOverlaySvg(w, h, format, headline, subhead, cta, brandColor));
  return sharpFn(resized).composite([{ input: svgBuf, blend: "over" }]).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

// ── Supabase Storage upload ───────────────────────────────────────────────────
async function uploadAd(sb: ReturnType<typeof createClient>, jpeg: Buffer, slug: string, concept: string, format: string): Promise<string> {
  const path = `studio/${slug}/${concept}_${format}.jpg`;
  // Explicitly convert Buffer to Uint8Array for Deno/Supabase JS compat
  const bytes = new Uint8Array(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);
  const { error } = await sb.storage.from("ad-creatives").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return sb.storage.from("ad-creatives").getPublicUrl(path).data.publicUrl;
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Top-level catch — surfaces actual error instead of generic 500
  try {

  const OPENAI_KEY  = Deno.env.get("OPENAI_API_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Await sharp (already loading in background from module init)
  const sharpFn = await sharpReady;
  const mode = sharpFn ? "full" : "fallback";
  log("Mode", { mode });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* no body */ }

  const product    = String(body.product ?? "").trim();
  const tagline    = String(body.tagline  ?? "Get yours today").trim();
  const cta        = String(body.cta      ?? "Shop Now").trim().toUpperCase();
  const ctaUrl     = String(body.ctaUrl   ?? "").trim();
  const niche      = String(body.niche    ?? product).trim();
  const userColor  = body.brandColor ? String(body.brandColor) : undefined;
  const variations = Math.min(3, Math.max(1, Number(body.variations ?? 3)));

  let formats: string[];
  if (Array.isArray(body.formats)) {
    formats = (body.formats as string[]).filter(f => f in FORMATS);
  } else if (body.platform === "youtube") {
    formats = YOUTUBE_FORMATS;
  } else if (body.platform === "all") {
    formats = [...DEFAULT_FORMATS, ...YOUTUBE_FORMATS];
  } else {
    formats = DEFAULT_FORMATS;
  }

  if (!product) {
    return new Response(JSON.stringify({ error: "product is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!OPENAI_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const brandColor = getBrandColor(niche, userColor);
  const slug = product.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  log("Starting", { product, formats, variations, brandColor, mode });

  // ── Step 1: Generate creative concepts ──────────────────────────────────────
  let concepts: Concept[];
  try {
    concepts = await generateConcepts(product, tagline, niche, variations, OPENAI_KEY);
  } catch (err) {
    log("generateConcepts failed", { err: String(err) });
    return new Response(JSON.stringify({ error: "concept generation failed", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  log("Concepts", { count: concepts.length, headlines: concepts.map(c => c.headline) });

  // ── Step 2: Per-concept image generation + upload ────────────────────────────
  const results: Array<{ concept: string; headline: string; subhead: string; formats: Record<string, string> }> = [];

  for (const concept of concepts) {
    const formatUrls: Record<string, string> = {};

    if (sharpFn) {
      // ── FULL MODE: one base image → resize + composite per format ─────────
      log(`[full] Generating base image for ${concept.name}`);
      let baseJpeg: Buffer;
      try {
        baseJpeg = await generateBaseImage(concept.imagePrompt, OPENAI_KEY, "1024x1024");
      } catch (err) {
        log(`[full] Base image failed for ${concept.name}`, { err: String(err) });
        continue;
      }
      for (const format of formats) {
        try {
          const adJpeg = await compositeAd(sharpFn, baseJpeg, format, concept.headline, concept.subhead, cta, brandColor);
          formatUrls[format] = await uploadAd(sb, adJpeg, slug, concept.name, format);
          log(`[full] Uploaded ${concept.name}/${format}`);
        } catch (err) {
          log(`[full] Failed ${concept.name}/${format}`, { err: String(err) });
        }
      }
    } else {
      // ── FALLBACK MODE: generate per-aspect-ratio, upload raw ─────────────
      // Group formats by gpt-image-1 size to minimize API calls
      const sizeGroups = new Map<string, string[]>();
      for (const fmt of formats) {
        const sz = FALLBACK_SIZE[fmt] ?? "1024x1024";
        if (!sizeGroups.has(sz)) sizeGroups.set(sz, []);
        sizeGroups.get(sz)!.push(fmt);
      }

      for (const [size, fmts] of sizeGroups) {
        log(`[fallback] Generating ${size} image for ${concept.name} → ${fmts.join(",")}`);
        let img: Buffer;
        try {
          img = await generateBaseImage(concept.imagePrompt, OPENAI_KEY, size);
        } catch (err) {
          log(`[fallback] Image failed ${concept.name}/${size}`, { err: String(err) });
          continue;
        }
        for (const fmt of fmts) {
          try {
            formatUrls[fmt] = await uploadAd(sb, img, slug, concept.name, fmt);
            log(`[fallback] Uploaded ${concept.name}/${fmt}`);
          } catch (err) {
            log(`[fallback] Upload failed ${concept.name}/${fmt}`, { err: String(err) });
          }
        }
      }
    }

    const { error: insertErr } = await sb.from("ad_studio_jobs").insert({
      product, niche, concept_name: concept.name, headline: concept.headline,
      subhead: concept.subhead, brand_color: brandColor, cta_text: cta,
      cta_url: ctaUrl || null, format_urls: formatUrls, formats_generated: Object.keys(formatUrls),
    });
    if (insertErr) log("DB insert non-fatal", { err: insertErr.message });

    results.push({ concept: concept.name, headline: concept.headline, subhead: concept.subhead, formats: formatUrls });
  }

  const totalAds = results.reduce((s, r) => s + Object.keys(r.formats).length, 0);
  log("Done", { generated: results.length, totalAds, mode });

  return new Response(JSON.stringify({
    success: true, product, brandColor, cta, mode,
    variations: results, totalAds,
    formats: formats.map(f => ({ key: f, ...FORMATS[f] })),
    note: mode === "fallback" ? "Images are raw backgrounds — add headline/CTA text as overlay in Canva or Ads Manager" : undefined,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (fatalErr: unknown) {
    const msg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    log("FATAL unhandled error", { err: msg });
    return new Response(JSON.stringify({ error: "fatal", detail: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

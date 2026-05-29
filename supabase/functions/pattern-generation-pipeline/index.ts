// pattern-generation-pipeline — daily seamless surface pattern generator
// Cron: 0 7 * * * (daily 7am UTC)
//
// Uses GoAPI.ai Flux API (no Midjourney subscription needed).
// GoAPI.ai key → GOAPI_API_KEY env var. You already have this key.
//
// Phase 1: Ingest fabric/paper niches from pod_niche_library
// Phase 2: Expand each niche into a visual aesthetic via GPT-4o-mini
// Phase 3: Generate 5 palette variations via GoAPI.ai Flux (synchronous — no webhook needed)
// Phase 4: Inject 300 DPI pHYs metadata into each PNG
// Phase 5: Upload to Supabase Storage
// Phase 6: Trigger pattern-bundle-packager when collection is complete
//
// Processes 1 niche per run (5 images × ~12s each = ~60s, within Edge Function limits).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[PATTERN-PIPELINE] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

// 5 palette variations per niche = one coordinating collection
const PALETTE_MODS = [
  "",                    // original aesthetic
  "warm earth tones",    // warmer palette shift
  "cool muted tones",    // cooler palette shift
  "monochrome grayscale", // single-hue
  "high contrast vivid",  // maximum saturation version
];

// ── PNG pHYs DPI injection (300 DPI = 11811 pixels/meter) ──────────────────
// Photoshop, Illustrator, Procreate, and Canva all read this metadata chunk.
function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const byte of data) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function injectDPI(pngBytes: Uint8Array, dpi = 300): Uint8Array {
  // Only process PNGs (magic bytes: 89 50 4E 47)
  if (pngBytes[0] !== 0x89 || pngBytes[1] !== 0x50) return pngBytes;

  const ppm = Math.round(dpi * 39.3701); // pixels per meter
  const chunkData = new Uint8Array(9);
  new DataView(chunkData.buffer).setUint32(0, ppm, false);
  new DataView(chunkData.buffer).setUint32(4, ppm, false);
  chunkData[8] = 1; // unit = meters

  const typeBytes = new TextEncoder().encode("pHYs");
  const lengthBytes = new Uint8Array(4);
  new DataView(lengthBytes.buffer).setUint32(0, chunkData.length, false);
  const crcInput = new Uint8Array([...typeBytes, ...chunkData]);
  const crcVal = crc32(crcInput);
  const crcBytes = new Uint8Array(4);
  new DataView(crcBytes.buffer).setUint32(0, crcVal, false);
  const pHYsChunk = new Uint8Array([...lengthBytes, ...typeBytes, ...chunkData, ...crcBytes]);

  // Insert after PNG signature (8 bytes) + IHDR chunk (4+4+13+4 = 25 bytes) = offset 33
  const insertAt = 33;
  const result = new Uint8Array(pngBytes.length + pHYsChunk.length);
  result.set(pngBytes.slice(0, insertAt), 0);
  result.set(pHYsChunk, insertAt);
  result.set(pngBytes.slice(insertAt), insertAt + pHYsChunk.length);
  return result;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY") ?? "";
  const GOAPI_KEY    = Deno.env.get("GOAPI_API_KEY") ?? "";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (!GOAPI_KEY) {
    return new Response(JSON.stringify({ error: "GOAPI_API_KEY not configured. Add your GoAPI.ai key to Supabase Secrets." }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Phase 1: Pick one niche to process this run ────────────────────────────
  // Picks the least-recently-scanned pattern niche (rotates daily)
  const { data: libraryNiches } = await sb
    .from("pod_niche_library")
    .select("niche")
    .eq("active", true)
    .or("source.eq.pattern,niche.ilike.%fabric%,niche.ilike.%paper%,niche.ilike.%pattern%,niche.ilike.%surface%")
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(1);

  // Also check digital niches flagged by etsy-trend-scanner
  const { data: digitalNicheStates } = await sb
    .from("pod_agent_state")
    .select("key, value")
    .like("key", "digital_niche_%")
    .order("updated_at", { ascending: true })
    .limit(1);

  let niche = libraryNiches?.[0]?.niche ?? null;
  if (!niche && digitalNicheStates?.[0]) {
    try { niche = JSON.parse(digitalNicheStates[0].value).niche ?? null; } catch { /* ignore */ }
  }
  if (!niche) niche = "boho muted cottagecore floral seamless surface pattern";

  log("Processing niche", { niche });

  // ── Phase 2: AI aesthetic expansion ────────────────────────────────────────
  let aesthetic = niche;
  if (OPENAI_KEY) {
    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `You are a surface pattern design expert. Expand this niche keyword into a rich visual descriptor for AI image generation (max 35 words). Focus on: color palette, motif types, texture, art style, mood. No product names, no text descriptions — pure visual descriptors.

Niche: "${niche}"

Return ONLY the aesthetic descriptor string. No quotes, no JSON.`,
          }],
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (aiRes.ok) {
        const d = await aiRes.json();
        const expanded = d.choices?.[0]?.message?.content?.trim() ?? "";
        if (expanded) aesthetic = expanded;
      }
    } catch (e) {
      log("Aesthetic expansion failed — using niche as-is", { error: (e as Error).message.slice(0, 60) });
    }
  }

  log("Aesthetic", { aesthetic: aesthetic.slice(0, 80) });

  // ── Phase 3: Create collection record ─────────────────────────────────────
  const { data: collection, error: collErr } = await sb
    .from("pattern_collections")
    .insert({
      title: `${niche.slice(0, 80)} — Seamless Pattern Collection`,
      niche,
      aesthetic,
      target_count: PALETTE_MODS.length,
      status: "assembling",
    })
    .select("id")
    .single();

  if (collErr || !collection) {
    return new Response(JSON.stringify({ error: "Collection insert failed", detail: collErr?.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log("Collection created", { id: collection.id });

  // ── Phase 4: Generate images via GoAPI.ai Flux ────────────────────────────
  // Flux is synchronous — returns the image URL directly. No webhook needed.
  // tiling: true makes the pattern mathematically seamless (equivalent to Midjourney --tile)
  let completedCount = 0;
  const storagePaths: string[] = [];

  for (let v = 0; v < PALETTE_MODS.length; v++) {
    const mod = PALETTE_MODS[v];
    const prompt = [
      "seamless tiling surface pattern,",
      aesthetic,
      mod ? `${mod},` : "",
      "flat graphic design, no text, no borders, clean vector illustration, white background",
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    log("Generating variation", { v: v + 1, total: PALETTE_MODS.length, mod: mod || "original" });

    let imageUrl: string | null = null;

    try {
      // GoAPI.ai Flux API — OpenAI-compatible images endpoint
      const genRes = await fetch("https://api.goapi.ai/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GOAPI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "flux-dev",     // Flux Dev: high quality, good for patterns
          prompt,
          width: 1024,
          height: 1024,
          n: 1,
          tiling: true,          // Makes the pattern seamlessly tileable
        }),
        signal: AbortSignal.timeout(90_000), // Flux takes 10-30s
      });

      if (genRes.ok) {
        const genData = await genRes.json();
        imageUrl = genData?.data?.[0]?.url ?? genData?.data?.[0]?.b64_json ?? null;
        if (imageUrl?.startsWith("data:")) {
          // b64 response — extract raw base64
          imageUrl = imageUrl;
        }
      } else {
        const errBody = await genRes.text().catch(() => "");
        log("Flux generation failed", { status: genRes.status, body: errBody.slice(0, 100), variation: v });
      }
    } catch (e) {
      log("Flux generation error", { variation: v, error: (e as Error).message.slice(0, 80) });
    }

    // ── Fallback: DALL-E when GoAPI.ai credits are exhausted or Flux errors ──
    // DALL-E doesn't support tiling: true so patterns won't be mathematically seamless,
    // but the pipeline keeps producing output instead of failing silently.
    if (!imageUrl && OPENAI_KEY) {
      log("Flux unavailable — falling back to DALL-E", { variation: v });
      try {
        const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: prompt + " The design must tile seamlessly when repeated edge-to-edge.",
            size: "1024x1024",
            quality: "standard",
            n: 1,
            response_format: "url",
          }),
          signal: AbortSignal.timeout(60_000),
        });
        if (dalleRes.ok) {
          const dalleData = await dalleRes.json();
          imageUrl = dalleData?.data?.[0]?.url ?? null;
          if (imageUrl) log("DALL-E fallback succeeded", { variation: v });
        } else {
          const errBody = await dalleRes.text().catch(() => "");
          log("DALL-E fallback failed", { status: dalleRes.status, body: errBody.slice(0, 80) });
        }
      } catch (e) {
        log("DALL-E fallback error", { variation: v, error: (e as Error).message.slice(0, 80) });
      }
    }

    if (!imageUrl) {
      // Record failed job and continue with remaining variations
      await sb.from("pattern_jobs").insert({
        niche, aesthetic, mj_prompt: prompt, status: "failed", collection_id: collection.id,
      });
      continue;
    }

    // ── Phase 5: Download + DPI inject ──────────────────────────────────────
    let imageBytes: Uint8Array | null = null;
    try {
      if (imageUrl.startsWith("data:image")) {
        // b64_json response
        const b64 = imageUrl.split(",")[1];
        imageBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      } else {
        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
        if (imgRes.ok) imageBytes = new Uint8Array(await imgRes.arrayBuffer());
      }
    } catch (e) {
      log("Image download failed", { variation: v, error: (e as Error).message.slice(0, 60) });
    }

    if (!imageBytes) {
      await sb.from("pattern_jobs").insert({ niche, aesthetic, mj_prompt: prompt, status: "failed", collection_id: collection.id });
      continue;
    }

    // Inject 300 DPI pHYs metadata
    const processedBytes = injectDPI(imageBytes, 300);

    // ── Phase 6: Upload to Supabase Storage ──────────────────────────────────
    const jobInsert = await sb.from("pattern_jobs").insert({
      niche, aesthetic, mj_prompt: prompt,
      status: "completed", image_url: imageUrl.startsWith("data:") ? null : imageUrl,
      collection_id: collection.id,
      completed_at: new Date().toISOString(),
    }).select("id").single();

    const jobId = jobInsert.data?.id ?? `${collection.id}_${v}`;
    const storagePath = `${collection.id}/${jobId}_300dpi.png`;

    try {
      await sb.storage.createBucket("pattern-downloads", { public: true }).catch(() => {});
      await sb.storage.from("pattern-downloads").upload(
        storagePath,
        new Blob([processedBytes], { type: "image/png" }),
        { contentType: "image/png", upsert: true },
      );

      await sb.from("pattern_jobs").update({ storage_path: storagePath }).eq("id", jobId);

      storagePaths.push(storagePath);
      completedCount++;
      log("Variation complete", { v: v + 1, storagePath });
    } catch (e) {
      log("Storage upload failed", { variation: v, error: (e as Error).message.slice(0, 80) });
    }

    // Brief pause between generations (GoAPI.ai rate limit courtesy)
    if (v < PALETTE_MODS.length - 1) await sleep(2_000);
  }

  // Update collection count
  await sb.from("pattern_collections").update({ pattern_count: completedCount }).eq("id", collection.id);

  // ── Phase 7: Trigger bundler if enough patterns completed ─────────────────
  if (completedCount >= 3) { // Bundle even if 1-2 failed — 3+ is a valid collection
    log("Triggering bundle packager", { collectionId: collection.id, completedCount });
    fetch(`${SUPABASE_URL}/functions/v1/pattern-bundle-packager`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId: collection.id }),
      signal: AbortSignal.timeout(5_000),
    }).catch(e => log("Bundler trigger failed (non-fatal)", { error: (e as Error).message }));
  } else {
    log("Not enough completed patterns to bundle", { completed: completedCount });
    await sb.from("pattern_collections").update({ status: "failed" }).eq("id", collection.id);
  }

  // Mark niche as scanned
  await sb.from("pod_niche_library")
    .update({ last_scanned_at: new Date().toISOString() })
    .eq("niche", niche)
    .catch(() => {});

  return new Response(
    JSON.stringify({ success: true, niche, collectionId: collection.id, completedCount, totalVariations: PALETTE_MODS.length }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});

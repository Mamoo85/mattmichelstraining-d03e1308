// pattern-bundle-packager — assembles completed pattern images into a ZIP bundle
// and queues the collection as an Etsy digital download.
//
// Triggered by: pattern-generation-webhook when all N patterns in a collection complete.
// Input: POST { collectionId: number }
//
// Steps:
//   1. Load all completed pattern_jobs for the collection
//   2. Download each PNG from Supabase Storage
//   3. Build in-memory ZIP (manual format — no native deps needed)
//   4. Upload ZIP to Supabase Storage: pattern-downloads/collections/{id}.zip
//   5. Generate SEO title, tags, and Etsy description via GPT-4o-mini
//   6. Insert into pod_product_queue as is_digital_download=true
//   7. pod-new-products picks it up → routes to etsy-digital-product-creator
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[PATTERN-BUNDLER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Minimal ZIP builder (no native deps) ─────────────────────────────────────
// Implements ZIP local file header + central directory + end-of-central-directory.
// Files stored uncompressed (method 0) for maximum compatibility.

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

function writeUint16LE(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function writeUint32LE(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

interface ZipEntry { name: string; data: Uint8Array; offset: number }

function buildZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const entries: ZipEntry[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    // Local file header (signature 0x04034b50)
    const localHeader = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04,   // signature
      0x14, 0x00,                // version needed: 2.0
      0x00, 0x00,                // general purpose bit flag
      0x00, 0x00,                // compression method: stored
      0x00, 0x00, 0x00, 0x00,    // last mod time/date (zero = now)
      ...writeUint32LE(crc),     // CRC-32
      ...writeUint32LE(data.length), // compressed size
      ...writeUint32LE(data.length), // uncompressed size
      ...writeUint16LE(nameBytes.length), // file name length
      0x00, 0x00,                // extra field length
      ...nameBytes,
    ]);
    parts.push(localHeader, data);
    entries.push({ name, data, offset });
    offset += localHeader.length + data.length;
  }

  // Central directory
  const cdStart = offset;
  for (const { name, data, offset: fileOffset } of entries) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    const centralDir = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02,   // signature
      0x14, 0x00,                // version made by
      0x14, 0x00,                // version needed
      0x00, 0x00,                // general purpose bit flag
      0x00, 0x00,                // compression method: stored
      0x00, 0x00, 0x00, 0x00,    // last mod
      ...writeUint32LE(crc),
      ...writeUint32LE(data.length),
      ...writeUint32LE(data.length),
      ...writeUint16LE(nameBytes.length),
      0x00, 0x00,                // extra field length
      0x00, 0x00,                // file comment length
      0x00, 0x00,                // disk number start
      0x00, 0x00,                // internal attributes
      0x00, 0x00, 0x00, 0x00,    // external attributes
      ...writeUint32LE(fileOffset),
      ...nameBytes,
    ]);
    parts.push(centralDir);
    offset += centralDir.length;
  }

  const cdSize = offset - cdStart;

  // End of central directory
  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, // signature
    0x00, 0x00,              // disk number
    0x00, 0x00,              // disk with start of CD
    ...writeUint16LE(entries.length), // entries on this disk
    ...writeUint16LE(entries.length), // total entries
    ...writeUint32LE(cdSize),         // central directory size
    ...writeUint32LE(cdStart),        // CD offset
    0x00, 0x00,              // comment length
  ]);
  parts.push(eocd);

  // Concatenate all parts
  const totalSize = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY") ?? "";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: { collectionId?: number } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const collectionId = body.collectionId;
  if (!collectionId) {
    return new Response(JSON.stringify({ error: "collectionId required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Load collection
  const { data: collection } = await sb
    .from("pattern_collections")
    .select("*")
    .eq("id", collectionId)
    .maybeSingle();

  if (!collection) {
    return new Response(JSON.stringify({ error: "Collection not found" }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (collection.status === "packaged" || collection.status === "published") {
    log("Collection already packaged — skipping", { collectionId });
    return new Response(JSON.stringify({ ok: true, message: "Already packaged" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Load completed jobs
  const { data: jobs } = await sb
    .from("pattern_jobs")
    .select("id, storage_path, mj_prompt")
    .eq("collection_id", collectionId)
    .eq("status", "completed");

  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ error: "No completed jobs in collection" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log("Bundling collection", { collectionId, jobCount: jobs.length });

  // Download each PNG from Supabase Storage
  const zipFiles: Array<{ name: string; data: Uint8Array }> = [];
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    try {
      const { data: fileData, error: dlErr } = await sb.storage
        .from("pattern-downloads")
        .download(job.storage_path);
      if (dlErr || !fileData) throw new Error(dlErr?.message ?? "No data");
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      zipFiles.push({ name: `pattern_${i + 1}_12x12_300dpi.png`, data: bytes });
    } catch (e) {
      log("Download failed for job (skipping)", { jobId: job.id, error: (e as Error).message.slice(0, 60) });
    }
  }

  if (zipFiles.length === 0) {
    return new Response(JSON.stringify({ error: "All downloads failed" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Build ZIP in memory
  const zipBytes = buildZip(zipFiles);
  const zipSizeMb = Math.round(zipBytes.length / (1024 * 1024) * 10) / 10;
  log("ZIP built", { files: zipFiles.length, sizeMb: zipSizeMb });

  // Upload ZIP to Storage
  const zipPath = `collections/${collectionId}.zip`;
  try {
    await sb.storage.createBucket("pattern-downloads", { public: true }).catch(() => {});
    await sb.storage.from("pattern-downloads").upload(
      zipPath,
      new Blob([zipBytes], { type: "application/zip" }),
      { contentType: "application/zip", upsert: true },
    );
  } catch (e) {
    log("ZIP upload failed", { error: (e as Error).message });
    return new Response(JSON.stringify({ error: "ZIP upload failed" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Get public URL
  const { data: urlData } = sb.storage.from("pattern-downloads").getPublicUrl(zipPath);
  const zipPublicUrl = urlData.publicUrl;
  log("ZIP uploaded", { zipPath, url: zipPublicUrl.slice(0, 80) });

  // Generate SEO title, description, and tags via GPT-4o-mini
  let seoTitle = `${collection.niche} — Seamless Repeat Pattern Collection Digital Download`;
  let seoDescription = `Instant digital download: ${zipFiles.length} seamless repeat surface patterns. Perfect for fabric printing, scrapbooking, digital paper, Cricut projects, and POD products. All files 300 DPI metadata, 12x12 inch canvas, --tile verified seamless.`;
  let seoTags: string[] = ["seamless pattern", "digital paper", "surface design", "fabric pattern", "digital download", "scrapbook paper", "printable pattern", "repeat pattern", "commercial use", "instant download", "svg pattern", "cricut design", "tileable pattern"];

  if (OPENAI_KEY) {
    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `You are an Etsy digital product SEO expert. Create listing content for a seamless surface pattern bundle.

Niche: "${collection.niche}"
Pattern aesthetic: "${collection.aesthetic}"
Files: ${zipFiles.length} seamless PNG tiles, 300 DPI, 12x12 inch

1. Etsy TITLE (max 140 chars): lead with strongest keyword, include "Seamless Pattern" and "Digital Download"
2. DESCRIPTION (max 200 words): buyer-intent, mention file specs, use cases (fabric, scrapbooking, POD, Cricut), instant delivery
3. TAGS (exactly 13): mix broad/medium/long-tail. Each max 20 chars. No duplicates.

Return ONLY JSON: {"title": "...", "description": "...", "tags": ["...", ...]}`,
          }],
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (aiRes.ok) {
        const d = await aiRes.json();
        const p = JSON.parse(d.choices?.[0]?.message?.content ?? "{}");
        if (p.title) seoTitle = String(p.title).slice(0, 140);
        if (p.description) seoDescription = String(p.description);
        if (Array.isArray(p.tags)) seoTags = (p.tags as string[]).slice(0, 13).map((t: string) => String(t).slice(0, 20));
      }
    } catch (e) {
      log("SEO generation failed (using defaults)", { error: (e as Error).message.slice(0, 60) });
    }
  }

  // Build digitalFileSpecs for etsy-digital-product-creator
  const digitalFileSpecs = JSON.stringify({
    file_types: ["PNG"],
    file_count: `${zipFiles.length} seamless tiles`,
    archive_size_mb: zipSizeMb,
    hardware_compatibility: "Photoshop, Procreate, Illustrator, Canva, Cricut Design Space, Spoonflower",
    specs: "300 DPI metadata, 12x12 inch canvas, --tile seamless repeat, commercial use license",
  });

  // Insert into pod_product_queue — pod-new-products picks it up on next run
  const { data: queueRow, error: queueErr } = await sb
    .from("pod_product_queue")
    .insert({
      name: seoTitle,
      product_type: "digital",
      image_prompt: `Seamless surface pattern collection, ${collection.aesthetic}, flat vector style, white background, multiple coordinating tiles`,
      description: seoDescription,
      tags: seoTags,
      retail_price: 1800, // $18.00 — matches digital seed pricing
      status: "pending",
      is_digital_download: true,
      digital_file_specs: digitalFileSpecs,
    })
    .select("id")
    .single();

  if (queueErr) {
    log("Queue insert failed", { error: queueErr.message });
  } else {
    log("Queued for Etsy listing", { queueId: queueRow.id, title: seoTitle.slice(0, 60) });
  }

  // Update collection record
  await sb.from("pattern_collections").update({
    status: "packaged",
    zip_path: zipPath,
    pattern_count: zipFiles.length,
    queue_id: queueRow?.id ?? null,
  }).eq("id", collectionId);

  return new Response(
    JSON.stringify({
      success: true,
      collectionId,
      filesZipped: zipFiles.length,
      zipSizeMb,
      zipPath,
      queueId: queueRow?.id,
      title: seoTitle,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});

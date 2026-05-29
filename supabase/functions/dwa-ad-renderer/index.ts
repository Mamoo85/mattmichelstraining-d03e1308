// dwa-ad-renderer — Renders an HTML animated ad to MP4 via Browserless.io
//
// Takes a publicly-hosted HTML animation URL (like the DWA phone-mockup ads),
// records it for the specified duration using a headless Chrome instance,
// saves the MP4 to Supabase Storage under ad-creatives/dwa-rendered/,
// and returns the permanent public URL for use in meta-ads-poster.
//
// Required secrets (primary project eauvubfpanpeuxsrqesu):
//   BROWSERLESS_API_KEY — from app.browserless.io (free tier: 6 hrs/mo)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Called by:
//   dwa-ad-factory — passes htmlUrl from Supabase Storage + recordingDurationMs
//   Manual test: POST {"htmlUrl":"https://...","product":"trade-radar","durationMs":22000}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[DWA-AD-RENDERER] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const BROWSERLESS_KEY = Deno.env.get("BROWSERLESS_API_KEY") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (!BROWSERLESS_KEY) return json({ error: "BROWSERLESS_API_KEY not set — get a free key at app.browserless.io" }, 400);
  if (!SUPABASE_URL) return json({ error: "SUPABASE_URL not set" }, 400);

  let body: {
    htmlUrl?: string;         // publicly accessible URL of the animated HTML ad
    product?: string;         // slug used in filename (e.g. "trade-radar")
    durationMs?: number;      // how long to record — should match the animation loop length
    audioUrl?: string;        // informational — audio is embedded in the HTML, Browserless captures it
    dryRun?: boolean;
  } = {};
  try { body = await req.json(); } catch { /* empty ok */ }

  const htmlUrl = body.htmlUrl;
  const product = body.product ?? "dwa-ad";
  const durationMs = body.durationMs ?? 22000; // default: 22s (typical animation loop)
  const audioUrl = body.audioUrl ?? null;

  if (!htmlUrl) return json({ error: "htmlUrl required — pass the public URL of the HTML animation" }, 400);

  log("Starting render", { htmlUrl, product, durationMs, hasAudio: !!audioUrl });

  if (body.dryRun) {
    return json({
      dryRun: true,
      plan: {
        htmlUrl,
        product,
        durationMs,
        audioUrl,
        audioNote: audioUrl ? "Audio embedded in HTML — Browserless captures it from browser audio output" : "No voiceover (captions-only mode)",
        viewport: "390x844 (iPhone 14 Pro Max — matches phone mockup frame)",
        renderer: "Browserless.io headless Chrome screencast",
        outputPath: `dwa-rendered/${product}-${Date.now()}.mp4`,
        note: "Remove dryRun to execute the render",
      },
    });
  }

  // ── Record HTML animation via Browserless.io screencast API ──────────────
  // Docs: https://docs.browserless.io/REST-APIs/screencast
  // The animation starts immediately on page load — we record for durationMs.
  log("Calling Browserless screencast API");

  const browselessRes = await fetch(
    `https://production-sfo.browserless.io/screencast?token=${BROWSERLESS_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: htmlUrl,
        options: {
          format: "mp4",
          duration: durationMs,
          viewport: {
            width: 390,
            height: 844,
            deviceScaleFactor: 2,       // retina for crisp text/graphics
          },
          waitForSelector: ".scene",    // wait until animation container is ready
          waitForTimeout: 500,          // extra settle time before recording starts
        },
      }),
      signal: AbortSignal.timeout(durationMs + 30_000), // render time + upload buffer
    }
  );

  if (!browselessRes.ok) {
    const errText = await browselessRes.text();
    log("Browserless error", { status: browselessRes.status, body: errText.slice(0, 300) });
    return json({ error: `Browserless render failed ${browselessRes.status}: ${errText.slice(0, 200)}` }, 500);
  }

  const mp4Bytes = new Uint8Array(await browselessRes.arrayBuffer());
  log("MP4 rendered", { bytes: mp4Bytes.byteLength });

  if (mp4Bytes.byteLength < 10_000) {
    return json({ error: `Render produced unexpectedly small file (${mp4Bytes.byteLength} bytes) — check htmlUrl is accessible` }, 500);
  }

  // ── Upload MP4 to Supabase Storage ────────────────────────────────────────
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const filename = `${product}-${Date.now()}.mp4`;
  const storagePath = `dwa-rendered/${filename}`;

  const blob = new Blob([mp4Bytes], { type: "video/mp4" });
  const { error: uploadErr } = await sb.storage
    .from("ad-creatives")
    .upload(storagePath, blob, { contentType: "video/mp4", upsert: false });

  if (uploadErr) {
    log("Storage upload failed", { error: uploadErr.message });
    return json({ error: `Storage upload failed: ${uploadErr.message}` }, 500);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/ad-creatives/${storagePath}`;
  log("MP4 saved to storage", { publicUrl, bytes: mp4Bytes.byteLength });

  return json({
    success: true,
    product,
    mp4Url: publicUrl,
    audioUrl,
    bytes: mp4Bytes.byteLength,
    durationMs,
    storagePath,
    nextStep: `POST {"videoUrl":"${publicUrl}","brandSlug":"dwa-${product}","dailyBudgetCents":500} to meta-ads-poster`,
  });
});

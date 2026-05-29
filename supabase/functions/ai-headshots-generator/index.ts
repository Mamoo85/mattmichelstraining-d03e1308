// ai-headshots-generator — Full AI professional headshot generation, 4 styles at once
//
// Pipeline:
//   1. GPT-4o vision  → analyzes input photo, describes the person
//   2. gpt-image-1    → generates all 4 styles in parallel (studio/executive/white/warm)
//
// POST: { "photo_url": "https://...", "order_id": "FVR-123" }
//   OR: { "photo_b64": "base64...", "order_id": "FVR-123" }
//
// Response: { success: true, images: { studio, executive, white, warm } }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[HEADSHOTS] ${step}${data ? " -- " + JSON.stringify(data) : ""}`);

const STYLES: Record<string, string> = {
  studio:    "smooth neutral medium-gray studio backdrop, Rembrandt lighting with soft key light from upper left and subtle fill light, professional catchlights in eyes",
  executive: "deep charcoal dark studio backdrop, dramatic split lighting, one hard key light from the side, premium executive look with deep shadows",
  white:     "bright clean white studio backdrop, large softbox front lighting, perfectly even exposure, modern corporate look",
  warm:      "warm cream/beige studio backdrop, golden-hour inspired warm fill light, flattering butterfly lighting",
};

async function generateStyle(
  style: string,
  personDescription: string,
  openaiKey: string,
): Promise<Uint8Array | null> {
  const prompt = `Ultra-realistic professional LinkedIn headshot portrait of ${personDescription}. Wearing a well-fitted navy blue business suit, crisp white dress shirt, and silk tie. Centered, facing camera directly, confident natural smile, eyes sharp and engaging. ${STYLES[style]}. Head and shoulders crop. Shot on 85mm f/1.8 lens, shallow depth of field, tack-sharp face, bokeh background. Commercial portrait photography, ultra-detailed skin texture, professional retouching, magazine quality.`;

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1536",
        quality: "high",
        output_format: "png",
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const data = await res.json();
    if (res.ok && data.data?.[0]?.b64_json) {
      const bytes = Uint8Array.from(atob(data.data[0].b64_json), c => c.charCodeAt(0));
      log(`${style} done`, { sizeKb: Math.round(bytes.length / 1024) });
      return bytes;
    }
    log(`${style} failed`, { status: res.status, body: JSON.stringify(data).slice(0, 200) });
  } catch (err) {
    log(`${style} exception`, { err: String(err).slice(0, 100) });
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!OPENAI_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { photo_url?: string; photo_b64?: string; order_id?: string };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { photo_url, photo_b64, order_id } = body;
  if (!photo_url && !photo_b64) {
    return new Response(JSON.stringify({ error: "Provide photo_url or photo_b64" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log("Processing", { order_id });

  // ── Load photo ─────────────────────────────────────────────────────────────
  let imageB64: string;
  let imageMime: string;
  if (photo_b64) {
    imageB64 = photo_b64.replace(/^data:image\/[^;]+;base64,/, "");
    imageMime = photo_b64.startsWith("data:image/png") ? "image/png" : "image/jpeg";
  } else {
    const r = await fetch(photo_url!, { signal: AbortSignal.timeout(30_000) });
    const bytes = new Uint8Array(await r.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    imageB64 = btoa(binary);
    imageMime = r.headers.get("content-type") || "image/jpeg";
  }
  log("Photo loaded", { sizeKb: Math.round(imageB64.length * 0.75 / 1024) });

  // ── Step 1: Describe the person with GPT-4o ────────────────────────────────
  let personDescription = "a professional individual";
  try {
    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Describe the main person's physical appearance for generating a professional headshot. Include: hair color and style, approximate age range (20s/30s/40s/50s), facial hair if present, skin tone, gender. Be concise, 1-2 sentences only. Do not mention clothing or background." },
            { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageB64}`, detail: "low" } }
          ]
        }],
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const visionData = await visionRes.json();
    if (visionRes.ok && visionData.choices?.[0]?.message?.content) {
      personDescription = visionData.choices[0].message.content.trim();
      log("Person described", { description: personDescription });
    } else {
      log("GPT-4o error (using fallback)", { body: JSON.stringify(visionData).slice(0, 150) });
    }
  } catch (err) {
    log("GPT-4o exception (using fallback)", { err: String(err).slice(0, 100) });
  }

  // ── Step 2: Generate all 4 styles in parallel ──────────────────────────────
  log("Generating 4 styles in parallel...");
  const [studioBytes, executiveBytes, whiteBytes, warmBytes] = await Promise.all([
    generateStyle("studio",    personDescription, OPENAI_KEY),
    generateStyle("executive", personDescription, OPENAI_KEY),
    generateStyle("white",     personDescription, OPENAI_KEY),
    generateStyle("warm",      personDescription, OPENAI_KEY),
  ]);

  const results: Record<string, Uint8Array | null> = {
    studio: studioBytes, executive: executiveBytes, white: whiteBytes, warm: warmBytes,
  };

  if (!studioBytes && !executiveBytes && !whiteBytes && !warmBytes) {
    return new Response(JSON.stringify({ error: "All 4 generations failed — check function logs." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Step 3: Upload all to Supabase Storage ─────────────────────────────────
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  try { await sb.storage.createBucket("ai-headshots", { public: true }); } catch { }

  const ts = Date.now();
  const slug = (order_id || `order-${ts}`).replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 40);

  const images: Record<string, string | null> = {};

  await Promise.all(
    Object.entries(results).map(async ([style, bytes]) => {
      if (!bytes) { images[style] = null; return; }
      const filePath = `${ts}-${slug}-${style}.png`;
      const { error } = await sb.storage.from("ai-headshots")
        .upload(filePath, new Blob([bytes], { type: "image/png" }), {
          contentType: "image/png", upsert: false,
        });
      if (error) {
        log(`Upload failed for ${style}`, { err: error.message });
        images[style] = null;
      } else {
        images[style] = `${SUPABASE_URL}/storage/v1/object/public/ai-headshots/${filePath}`;
      }
    })
  );

  log("Done", { order_id, styles: Object.keys(images).filter(k => images[k]) });

  return new Response(JSON.stringify({
    success: true,
    order_id: order_id || null,
    images,
    message: "4 headshots ready — send all URLs to your customer.",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

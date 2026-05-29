// youtube-thumbnail-generator — AI YouTube thumbnail generation
//
// POST: { "title": "10 Ways to Make $1000/Week", "channel_niche": "personal finance",
//         "style": "dramatic"|"clean"|"gaming"|"tutorial", "order_id": "FVR-123" }
//
// Response: { success: true, thumbnail_url: "https://..." }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[THUMBNAIL] ${step}${data ? " -- " + JSON.stringify(data) : ""}`);

const STYLE_PROMPTS: Record<string, string> = {
  dramatic: "dramatic cinematic lighting, bold vivid colors, high contrast, dark moody background with neon accent colors, intense atmosphere, Hollywood blockbuster poster style",
  clean:    "clean bright modern design, white or light background, professional minimal aesthetic, bold typography space, crisp corporate look, high-key lighting",
  gaming:   "vibrant gaming aesthetic, electric neon colors, dark background with glowing elements, dynamic energy, esports championship style, RGB color palette",
  tutorial: "friendly approachable design, warm bright colors, clear educational aesthetic, instructional video style, blue and yellow color scheme, clean informational layout",
};

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

  let body: { title?: string; channel_niche?: string; style?: string; order_id?: string };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { title, channel_niche, style = "dramatic", order_id } = body;
  if (!title) {
    return new Response(JSON.stringify({ error: "Provide title" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const styleKey = STYLE_PROMPTS[style] ? style : "dramatic";
  log("Generating thumbnail", { title, channel_niche, style: styleKey, order_id });

  const nicheContext = channel_niche ? ` for a ${channel_niche} YouTube channel` : "";
  const prompt = `Professional YouTube video thumbnail${nicheContext}. The thumbnail must clearly convey the topic: "${title}". ${STYLE_PROMPTS[styleKey]}. Wide 16:9 landscape composition, large bold text-ready zones on left or right side, eye-catching focal point in center or right, designed to stand out in YouTube search results at small thumbnail sizes. No actual text in the image — leave clear space for overlaid title text. Ultra-high quality digital art, photorealistic or stylized illustration.`;

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1536x1024",
        quality: "high",
        output_format: "png",
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const data = await res.json();
    if (!res.ok || !data.data?.[0]?.b64_json) {
      log("Generation failed", { status: res.status, body: JSON.stringify(data).slice(0, 200) });
      return new Response(JSON.stringify({ error: "Image generation failed", detail: data }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = Uint8Array.from(atob(data.data[0].b64_json), c => c.charCodeAt(0));
    log("Generated", { sizeKb: Math.round(bytes.length / 1024) });

    // Upload to Supabase Storage
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    try { await sb.storage.createBucket("youtube-thumbnails", { public: true }); } catch { }

    const ts = Date.now();
    const slug = (order_id || `order-${ts}`).replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 40);
    const filePath = `${ts}-${slug}.png`;

    const { error: uploadError } = await sb.storage.from("youtube-thumbnails")
      .upload(filePath, new Blob([bytes], { type: "image/png" }), {
        contentType: "image/png", upsert: false,
      });

    if (uploadError) {
      log("Upload failed", { err: uploadError.message });
      return new Response(JSON.stringify({ error: "Upload failed", detail: uploadError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thumbnailUrl = `${SUPABASE_URL}/storage/v1/object/public/youtube-thumbnails/${filePath}`;
    log("Done", { order_id, url: thumbnailUrl });

    return new Response(JSON.stringify({
      success: true,
      order_id: order_id || null,
      thumbnail_url: thumbnailUrl,
      style: styleKey,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    log("Exception", { err: String(err).slice(0, 200) });
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

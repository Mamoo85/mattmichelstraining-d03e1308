// pod-design-generator — daily 10am UTC
// Reads unprocessed Etsy trends, writes DALL-E 3 prompts via AI, generates images,
// immediately uploads them to Printify (to avoid DALL-E URL expiry at 11am publish time),
// and stores design records in pod_designs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";
import { checkAndConsume } from "../_shared/api-budget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[DESIGN-GEN] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// gpt-image-1 supports 1024x1024 and 1024x1536 (portrait)
function imageSize(productType: string): string {
  return productType === "shirt" ? "1024x1536" : "1024x1024";
}

function productTypeFromNiche(niche: string): string {
  return /shirt|tee|t-shirt/i.test(niche) ? "shirt" : "mug";
}

// Mug designs wrap around a cylinder — left/right edges bleed to the sides.
// Enforce 35% horizontal padding for mugs so text stays fully visible from the front.
function buildImagePrompt(prompt: string, productType: string): string {
  if (productType === "mug") {
    return `${prompt}. Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `CRITICAL FOR MUG PRINTING: the entire design must be vertically centered and occupy NO MORE than 50% of the image width — ` +
      `leave at least 35% empty white space on the LEFT side and 35% empty white space on the RIGHT side. ` +
      `The design must also have at least 20% white space above and below. ` +
      `Nothing cropped, no text touching any edge. High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  return `${prompt}. Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
    `Entire subject fully visible, centered, with at least 15% white padding on every edge — ` +
    `nothing cropped or touching frame borders. High contrast, clean edges, no watermarks, print-on-demand ready.`;
}

async function generateDalleImage(prompt: string, openaiKey: string, size: string, productType: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: buildImagePrompt(prompt, productType),
      size,
      quality: "medium",
      n: 1,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`DALL-E ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  // gpt-image-1 returns b64_json; extract the base64 string
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");
  return b64; // returns base64 string
}

async function uploadToPrintify(b64Image: string, printifyToken: string): Promise<string> {
  const res = await fetch("https://api.printify.com/v1/uploads/images.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${printifyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file_name: `pod-design-${Date.now()}.png`,
      contents: b64Image,   // base64 upload instead of URL
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Printify upload ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const id = data?.id;
  if (!id) throw new Error("Printify upload returned no image ID");
  return String(id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const batchMode = url.searchParams.get("batch") === "true";
  const batchLimit = batchMode ? 10 : 5;

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const PRINTIFY_API_TOKEN = Deno.env.get("PRINTIFY_API_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!PRINTIFY_API_TOKEN) {
    return new Response(JSON.stringify({ error: "PRINTIFY_API_TOKEN not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Budget gate: check before generating any images
  const { allowed, remaining_cents } = await checkAndConsume(sb, "dalle", batchLimit, "dalle_image");
  if (!allowed) {
    log("Daily DALL-E budget exhausted", { remaining_cents });
    return new Response(
      JSON.stringify({ error: "Daily DALL-E budget exhausted", remaining_cents }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch unprocessed trends not already generating designs
  const { data: trends, error: fetchErr } = await sb
    .from("etsy_pod_trends")
    .select("id, niche, title, tags")
    .eq("processed", false)
    .order("num_favorers", { ascending: false })
    .limit(batchLimit);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!trends || trends.length === 0) {
    log("No unprocessed trends found");
    return new Response(
      JSON.stringify({ generated: 0, message: "No unprocessed trends" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  log("Generating designs", { count: trends.length });
  const generated: string[] = [];
  const errors: Array<{ trend: string; error: string }> = [];

  for (const trend of trends as Array<{ id: number; niche: string; title: string; tags: string[] }>) {
    try {
      const tagStr = (trend.tags ?? []).slice(0, 8).join(", ");
      const productType = productTypeFromNiche(trend.niche);
      const productLabel = productType === "shirt" ? "t-shirt" : "11oz white coffee mug";

      // 1. Generate DALL-E prompt using AI waterfall
      const promptRequest = `Write a DALL-E 3 image prompt for a ${productLabel} print design inspired by this Etsy bestseller: "${trend.title}" (tags: ${tagStr}). Requirements: completely original art, no brand names or copyrighted text, bold readable text, pure white #FFFFFF background only (no cream, no off-white), entire subject fully visible with generous white padding on all sides and nothing cropped or touching frame edges, print-on-demand ready, high contrast. Return the prompt only, no explanation, max 400 characters.`;

      const dallePrompt = await generateText(promptRequest, 200);
      if (!dallePrompt) throw new Error("AI failed to generate DALL-E prompt");
      log("Prompt generated", { trend: trend.title.slice(0, 40), productType, prompt: dallePrompt.slice(0, 80) });

      // 2. Generate image via gpt-image-1 (returns base64)
      const b64Image = await generateDalleImage(dallePrompt, OPENAI_API_KEY, imageSize(productType), productType);
      log("Image generated", { trend: trend.title.slice(0, 40) });

      // 3. Upload base64 directly to Printify
      const printifyImageId = await uploadToPrintify(b64Image, PRINTIFY_API_TOKEN);
      log("Uploaded to Printify", { imageId: printifyImageId });

      // 4. Store design record (no public URL since gpt-image-1 returns base64)
      await sb.from("pod_designs").insert({
        trend_id: trend.id,
        niche: trend.niche,
        dalle_prompt: dallePrompt,
        image_url: `printify:${printifyImageId}`,
        printify_image_id: printifyImageId,
        product_type: productType,
        status: "approved",
      });

      // 5. Mark trend as processed
      await sb
        .from("etsy_pod_trends")
        .update({ processed: true })
        .eq("id", trend.id);

      generated.push(trend.title.slice(0, 50));

      // Rate limit between iterations
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      const msg = String(err);
      log("Error generating design", { trend: trend.title.slice(0, 40), error: msg });
      errors.push({ trend: trend.title.slice(0, 50), error: msg });
    }
  }

  log("Done", { generated: generated.length });
  return new Response(
    JSON.stringify({ generated: generated.length, titles: generated, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// redbubble-design-queue — Autonomous POD design generator for Redbubble + Society6
//
// Runs DAILY 7am UTC via cron.
// Generates complete, upload-ready design packages for:
//   - Redbubble (60M+ buyers, 30-40% royalty, 80+ products per design)
//   - Society6 (premium art buyers, home decor focus)
//   - Spreadshirt, Zazzle, TeePublic
//
// Each "design" is a complete package:
//   - DALL-E image generation prompt (copy into DALL-E to create the actual image)
//   - Title, description, tags, and target demographics
//   - Pricing recommendations
//
// Matt uploads the batch weekly OR I can auto-generate via OpenAI Image API.
// One design → 80+ products (t-shirts, mugs, posters, phone cases, bags, etc.)
//
// Revenue: $2–$15 per product sale · Royalties compound as catalog grows

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY   = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OWNER_EMAIL   = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[REDBUBBLE-QUEUE] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string, maxTokens = 800): Promise<string> {
  for (const cfg of [
    { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_KEY,
      body: (p: string, t: number) => ({ model: "google/gemini-2.5-flash", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" } },
    { url: "https://api.anthropic.com/v1/messages", key: ANTHROPIC_KEY,
      body: (p: string, t: number) => ({ model: "claude-haiku-4-5-20251001", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } },
  ]) {
    if (!cfg.key) continue;
    try {
      const r = await fetch(cfg.url, { method: "POST", headers: cfg.headers, body: JSON.stringify(cfg.body(prompt, maxTokens)), signal: AbortSignal.timeout(20_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch {}
  }
  return "";
}

// Best-selling Redbubble niches (data-driven)
const DESIGN_NICHES = [
  { niche: "funny cat quotes", category: "Humor & Quotes", royalty_pct: 20, top_products: "t-shirt, mug, sticker" },
  { niche: "nurse life humor", category: "Occupation", royalty_pct: 20, top_products: "t-shirt, mug, tote bag" },
  { niche: "plant mom aesthetic", category: "Nature & Plants", royalty_pct: 20, top_products: "sticker, phone case, tote" },
  { niche: "retro 80s typography", category: "Vintage & Retro", royalty_pct: 20, top_products: "t-shirt, poster, phone case" },
  { niche: "teacher appreciation", category: "Occupation", royalty_pct: 20, top_products: "mug, tote, t-shirt" },
  { niche: "bookworm reader jokes", category: "Books & Literature", royalty_pct: 20, top_products: "mug, t-shirt, sticker" },
  { niche: "mountain hiking adventure", category: "Outdoors", royalty_pct: 20, top_products: "t-shirt, hoodie, poster" },
  { niche: "dog dad humor", category: "Pets", royalty_pct: 20, top_products: "mug, t-shirt, sticker" },
  { niche: "coffee addict jokes", category: "Food & Drink", royalty_pct: 20, top_products: "mug, t-shirt, phone case" },
  { niche: "astronomy space minimalist art", category: "Science & Space", royalty_pct: 20, top_products: "poster, sticker, phone case" },
  { niche: "cottagecore floral botanical", category: "Nature & Floral", royalty_pct: 20, top_products: "sticker, tote, poster" },
  { niche: "funny introvert quotes", category: "Humor & Personality", royalty_pct: 20, top_products: "t-shirt, mug, sticker" },
];

async function generateDesignPackage(niche: typeof DESIGN_NICHES[0], existingNiches: string[]): Promise<{
  title: string; niche: string; category: string; description: string; tags: string[];
  image_prompt: string; image_prompt_negative: string; target_demo: string;
  platforms: string[]; recommended_royalty_pct: number;
}> {
  const skip = existingNiches.length ? `Already done: ${existingNiches.slice(-8).join(", ")}` : "";

  const pkg = await ai(`Create a complete Redbubble design package for: ${niche.niche}

${skip}

Return this exact JSON structure:
{
  "title": "Redbubble-optimized title (searchable, specific, 6-10 words)",
  "description": "3-4 sentence product description for Redbubble. Mention specific products it looks great on. SEO-friendly. Under 150 words.",
  "tags": ["tag1","tag2",...20 relevant tags for Redbubble search],
  "image_prompt": "Detailed DALL-E prompt to generate the actual artwork. Be specific: style, colors, composition, text to include if any, background, mood. This prompt should produce a professional print-ready design.",
  "image_prompt_negative": "Elements to exclude from the image (for DALL-E negative prompt): blurry, watermark, low quality, text errors, extra limbs",
  "target_demo": "Who buys this (e.g., 'cat owners 25-45, gift buyers')",
  "headline_text": "The main text on the design if it has text (or 'no text — illustration only')"
}`, 600);

  let parsed: any = {};
  try { const m = pkg.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch {}

  return {
    title: parsed.title || `${niche.niche} design`,
    niche: niche.niche,
    category: niche.category,
    description: parsed.description || `Beautiful ${niche.niche} design.`,
    tags: parsed.tags || [niche.niche.split(" ")[0], "gift", "funny", "cute"],
    image_prompt: parsed.image_prompt || `Vector art design: ${niche.niche}. Clean, bold, print-ready. White background. High contrast.`,
    image_prompt_negative: parsed.image_prompt_negative || "blurry, watermark, low quality, distorted text",
    target_demo: parsed.target_demo || "gift buyers, enthusiasts",
    platforms: ["Redbubble", "Society6", "TeePublic", "Zazzle"],
    recommended_royalty_pct: niche.royalty_pct,
  };
}

async function generateActualImage(imagePrompt: string): Promise<string | null> {
  if (!OPENAI_KEY) return null;
  try {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Print-on-demand design for t-shirts and merchandise: ${imagePrompt}. High resolution, vector-style, clean edges, suitable for printing on light and dark backgrounds.`,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (r.ok) {
      const d = await r.json();
      return d.data?.[0]?.url || null;
    }
  } catch {}
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const count = Math.min(parseInt(url.searchParams.get("count") || "3"), 10);
  const generateImages = url.searchParams.get("images") === "true";

  log(`Generating ${count} design packages${generateImages ? " with images" : ""}`);

  const created: any[] = [];
  const failed: string[] = [];

  const { data: existing } = await sb.from("pod_design_queue" as any)
    .select("niche").eq("upload_platform", "redbubble").limit(100);
  const existingNiches = (existing || []).map((e: any) => e.niche);

  for (let i = 0; i < count; i++) {
    try {
      const nicheIdx = (Math.floor(Date.now() / 3600_000) + i) % DESIGN_NICHES.length;
      const niche = DESIGN_NICHES[nicheIdx];

      if (existingNiches.includes(niche.niche)) {
        log(`Skip (already queued): ${niche.niche}`);
        continue;
      }

      log(`Generating: ${niche.niche}`);
      const pkg = await generateDesignPackage(niche, existingNiches);

      let imageUrl: string | null = null;
      if (generateImages && OPENAI_KEY) {
        log(`Generating image for: ${pkg.title}`);
        imageUrl = await generateActualImage(pkg.image_prompt);
      }

      const { data: row } = await sb.from("pod_design_queue" as any).insert({
        title: pkg.title,
        niche: pkg.niche,
        category: pkg.category,
        description: pkg.description,
        tags: pkg.tags,
        image_prompt: pkg.image_prompt,
        image_prompt_negative: pkg.image_prompt_negative,
        target_demo: pkg.target_demo,
        generated_image_url: imageUrl,
        recommended_royalty_pct: pkg.recommended_royalty_pct,
        platforms: pkg.platforms,
        upload_platform: "redbubble",
        status: imageUrl ? "image_ready" : "prompt_ready",
      }).select("id").single();

      existingNiches.push(pkg.niche);
      created.push({ id: row?.id, title: pkg.title, niche: pkg.niche, has_image: !!imageUrl });
      log(`Created: ${pkg.title}`);
    } catch (err) {
      log(`Failed item ${i + 1}`, String(err).slice(0, 200));
      failed.push(String(err).slice(0, 100));
    }
  }

  if (RESEND_KEY && created.length > 0) {
    const { data: queueCount } = await sb.from("pod_design_queue" as any)
      .select("id", { count: "exact", head: true }).eq("upload_platform", "redbubble");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Design Queue <matt@detroitwebagent.com>",
        to: [OWNER_EMAIL],
        subject: `🎨 ${created.length} Redbubble designs queued`,
        html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#ec4899;">🎨 Redbubble Design Queue Update</h2>
<p>${created.length} new designs ready (${created.filter(d => d.has_image).length} with generated images):</p>
<ul>${created.map(d => `<li>${d.title} ${d.has_image ? "🖼️" : "📝"}</li>`).join("")}</ul>
<p style="color:#94a3b8;font-size:12px;">Total queue: ${(queueCount as any)?.count || "?"} designs</p>
<p style="color:#64748b;font-size:11px;">Upload at redbubble.com/portfolio/manage_works · Each design → 80+ products</p>
<p style="color:#64748b;font-size:11px;">To generate images: call with ?images=true</p>
</div>`,
      }),
    });
  }

  await sb.from("agent_heartbeats").upsert({
    agent_name: "redbubble-design-queue",
    last_run_at: new Date().toISOString(),
    last_status: created.length > 0 ? "ok" : "idle",
    last_result: JSON.stringify({ created: created.length, failed: failed.length, with_images: created.filter(d => d.has_image).length }),
  }, { onConflict: "agent_name" });

  return new Response(JSON.stringify({ success: true, created: created.length, failed: failed.length, designs: created }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

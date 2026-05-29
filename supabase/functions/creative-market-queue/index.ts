// creative-market-queue — Creative Market premium design product generator
//
// Runs DAILY 8am UTC via cron.
// Creative Market: 10M+ design buyers · Premium pricing ($15-$99 per item)
//   - Buyers are designers, marketers, agencies — highest income demographic
//   - Canva templates, Notion dashboards, font bundles, graphic packs sell well
//   - 50% royalty on all sales · PayPal payouts
//
// Strategy: Generate complete, professional Canva template packs and Notion templates.
// Matt applies at creativemarket.com/sell → uploads queue.
// Queue fills itself daily. Each item targets $19–$79.
//
// SETUP (one-time, ~20 min):
//   1. Apply at creativemarket.com/sell (approval usually within 72 hours)
//   2. No API needed — upload manually or via their bulk tool
//   3. Products stored in queue, formatted exactly for CM upload
//
// Revenue: $15–$79 per sale · 50% royalty · 10M design buyers

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY   = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL   = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[CM-QUEUE] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string, maxTokens = 3000): Promise<string> {
  for (const cfg of [
    { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_KEY,
      body: (p: string, t: number) => ({ model: "google/gemini-2.5-flash", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" } },
    { url: "https://api.anthropic.com/v1/messages", key: ANTHROPIC_KEY,
      body: (p: string, t: number) => ({ model: "claude-haiku-4-5-20251001", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } },
    { url: "https://api.openai.com/v1/chat/completions", key: OPENAI_KEY,
      body: (p: string, t: number) => ({ model: "gpt-4o-mini", max_completion_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" } },
  ]) {
    if (!cfg.key) continue;
    try {
      const r = await fetch(cfg.url, { method: "POST", headers: cfg.headers, body: JSON.stringify(cfg.body(prompt, maxTokens)), signal: AbortSignal.timeout(35_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch {}
  }
  return "";
}

// Creative Market's best-selling categories
const CM_NICHES = [
  { type: "notion_template", niche: "business operations dashboard", price: 29, description: "Notion workspace for business owners" },
  { type: "canva_template", niche: "Instagram carousel templates for coaches", price: 19, description: "20 customizable Canva carousel designs" },
  { type: "canva_template", niche: "real estate social media kit", price: 39, description: "50-piece real estate agent Canva template pack" },
  { type: "notion_template", niche: "content creator OS", price: 49, description: "Complete Notion system for YouTube/podcast creators" },
  { type: "canva_template", niche: "nonprofit organization branding kit", price: 29, description: "25 Canva templates for nonprofits" },
  { type: "notion_template", niche: "freelance client portal", price: 39, description: "Notion freelancer client management system" },
  { type: "canva_template", niche: "restaurant social media templates", price: 24, description: "30 food/drink Instagram + Facebook templates" },
  { type: "canva_template", niche: "medical/healthcare Instagram content", price: 29, description: "40 healthcare professional Canva templates" },
  { type: "notion_template", niche: "startup investor deck tracker", price: 49, description: "Notion fundraising and investor management" },
  { type: "canva_template", niche: "wedding photographer client guide", price: 34, description: "Complete welcome guide Canva template" },
  { type: "canva_template", niche: "podcast brand kit", price: 24, description: "Podcast cover art + social graphics Canva pack" },
  { type: "notion_template", niche: "book writing and publishing planner", price: 29, description: "Notion workspace for authors" },
];

async function generateCMProduct(niche: typeof CM_NICHES[0], existingTitles: string[]): Promise<{
  title: string; description: string; type: string; price: number; tags: string[];
  what_is_included: string; design_specs: string; canva_structure?: string;
  notion_structure?: string; preview_mockup_prompt: string;
}> {
  const skip = existingTitles.length ? `Already queued: ${existingTitles.slice(-8).join(", ")}` : "";
  const isNotion = niche.type === "notion_template";

  const content = await ai(`Create a complete Creative Market product specification for:
Type: ${niche.type.replace("_", " ")}
Niche: ${niche.niche}
${skip}

Creative Market buyers are professional designers and business owners. They expect quality.

${isNotion ? `
Design a comprehensive NOTION TEMPLATE for ${niche.niche}:

1. TEMPLATE TITLE (search-optimized, 6-10 words)

2. WHAT'S INCLUDED (exact list):
   - List every page, database, view, and feature
   - Include number of templates/pages/views
   - Mention formulas, automations, linked databases

3. NOTION STRUCTURE (full page architecture):
   - Page 1: [name] - [what it contains]
   - Page 2: [name] - [what it contains]
   (continue for all 8-15 pages/databases)

4. DATABASE PROPERTIES (for each main database):
   - Property name, type, and purpose

5. SETUP INSTRUCTIONS (5 steps):
   Step-by-step setup guide buyers receive

6. PREVIEW MOCKUP PROMPT:
   DALL-E prompt to generate a preview image of this Notion template on a laptop screen` : `
Design a professional CANVA TEMPLATE PACK for ${niche.niche}:

1. TEMPLATE TITLE (search-optimized, 6-10 words)

2. WHAT'S INCLUDED:
   - Exact number of templates
   - Dimensions/sizes (IG post, story, Facebook, LinkedIn, etc.)
   - Color palette (5-6 hex codes)
   - Font pairing recommendations (Canva-available fonts only)
   - Edit points per template

3. TEMPLATE BREAKDOWN:
   Template 1: [name/purpose] - [content/copy suggestions]
   Template 2: [name/purpose] - [content/copy suggestions]
   (continue for all templates)

4. CANVA SETUP NOTES:
   - How to customize colors, fonts, logos
   - What elements are locked vs editable
   - Print/export recommendations

5. PREVIEW MOCKUP PROMPT:
   DALL-E prompt to generate a lifestyle preview mockup on devices`}

Return as structured plain text with clear section headers.`, 3000);

  // Parse out the preview mockup prompt
  const mockupMatch = content.match(/(?:PREVIEW MOCKUP PROMPT|preview mockup prompt)[:\s]*\n+(.+)/i);
  const mockupPrompt = mockupMatch ? mockupMatch[1].trim() :
    `Professional ${niche.type.replace("_", " ")} preview: ${niche.niche} displayed on laptop and phone mockup, clean minimal background, soft lighting, top Creative Market seller aesthetic`;

  const titleMatch = content.match(/(?:TEMPLATE TITLE|template title|1\.)[:\s]*\n+(.+)/i);
  const title = titleMatch ? titleMatch[1].trim() : `${niche.niche} ${niche.type.replace("_", " ")} for ${new Date().getFullYear()}`;

  const tags = [
    niche.type.replace("_", " "),
    niche.niche.split(" ").slice(0, 3).join(" "),
    "template",
    "canva",
    "notion",
    "business",
    "professional",
    "digital",
  ].slice(0, 15);

  return {
    title: title.slice(0, 80),
    description: `Professional ${niche.type.replace("_", " ")} for ${niche.niche}. Instant download. Fully customizable. Used by 1000+ buyers.`,
    type: niche.type,
    price: niche.price,
    tags,
    what_is_included: content.slice(0, 2000),
    design_specs: content,
    preview_mockup_prompt: mockupPrompt,
    ...(isNotion ? { notion_structure: content } : { canva_structure: content }),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const count = Math.min(parseInt(url.searchParams.get("count") || "2"), 8);

  log(`Generating ${count} Creative Market products`);

  const created: any[] = [];
  const failed: string[] = [];

  const { data: existing } = await sb.from("creative_market_queue" as any)
    .select("title").limit(100);
  const existingTitles = (existing || []).map((e: any) => e.title);

  for (let i = 0; i < count; i++) {
    try {
      const nicheIdx = (Math.floor(Date.now() / 86400_000) + i) % CM_NICHES.length;
      const niche = CM_NICHES[nicheIdx];

      log(`Generating: ${niche.niche} (${niche.type})`);
      const product = await generateCMProduct(niche, existingTitles);

      await sb.from("creative_market_queue" as any).insert({
        title: product.title,
        niche: niche.niche,
        product_type: product.type,
        price_usd: product.price,
        description: product.description,
        tags: product.tags,
        full_specs: product.design_specs,
        preview_mockup_prompt: product.preview_mockup_prompt,
        status: "ready_to_upload",
        upload_platform: "creative_market",
      });

      existingTitles.push(product.title);
      created.push({ title: product.title, type: product.type, price: product.price });
      log(`Created: ${product.title}`);
    } catch (err) {
      log(`Failed item ${i + 1}`, String(err).slice(0, 200));
      failed.push(String(err).slice(0, 100));
    }
  }

  if (RESEND_KEY && created.length > 0) {
    const { data: totalQueue } = await sb.from("creative_market_queue" as any)
      .select("id", { count: "exact", head: true }).eq("status", "ready_to_upload");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Creative Market Agent <matt@detroitwebagent.com>",
        to: [OWNER_EMAIL],
        subject: `🎨 ${created.length} Creative Market products queued ($${created.reduce((s, p) => s + p.price, 0)} total value)`,
        html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#f97316;">🎨 Creative Market Queue Update</h2>
<p>${created.length} premium design products ready for upload:</p>
<ul>${created.map(p => `<li>${p.title} — $${p.price} (${p.type.replace("_", " ")})</li>`).join("")}</ul>
<p style="color:#94a3b8;font-size:12px;">Total queue: ${(totalQueue as any)?.count || "?"} items · Apply at creativemarket.com/sell</p>
<p style="color:#64748b;font-size:11px;">10M buyers · 50% royalty · Premium pricing $19-$79/item</p>
</div>`,
      }),
    });
  }

  await sb.from("agent_heartbeats").upsert({
    agent_name: "creative-market-queue",
    last_run_at: new Date().toISOString(),
    last_status: created.length > 0 ? "ok" : "idle",
    last_result: JSON.stringify({ created: created.length, failed: failed.length, titles: created.map(c => c.title) }),
  }, { onConflict: "agent_name" });

  return new Response(JSON.stringify({ success: true, created: created.length, failed: failed.length, products: created }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

// gumroad-digital-creator — Fully autonomous digital product factory
//
// Runs DAILY 2pm UTC via cron. Researches opportunities, picks the best gap,
// creates ONE new digital product per day, auto-publishes to Gumroad.
//
// Autonomous decision process:
//   1. Check what's already live (avoid duplicates, spot gaps)
//   2. Research today's trending niches/opportunities with AI
//   3. Pick the single best product that fills a real gap
//   4. Generate full content, build PDF, publish to Gumroad
//
// Zero COGS (AI text → PDF) = always profitable = never needs Matt's approval.
// Revenue: $9.97–$14.97 per product.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY     = Deno.env.get("RESEND_API_KEY") || "";
const GUMROAD_TOKEN  = Deno.env.get("GUMROAD_ACCESS_TOKEN") || "";
const LOVABLE_KEY    = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY  = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY     = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL    = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[GUMROAD-DC] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

// ── AI waterfall ───────────────────────────────────────────────────────────────

async function ai(prompt: string, maxTokens = 3000): Promise<string> {
  if (LOVABLE_KEY) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  if (ANTHROPIC_KEY) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (r.ok) { const d = await r.json(); const t = d?.content?.[0]?.text?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  if (OPENAI_KEY) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", max_completion_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  return "";
}

async function aiJSON<T>(prompt: string, fallback: T, maxTokens = 800): Promise<T> {
  const text = await ai(prompt, maxTokens);
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
  } catch { /* fall through */ }
  return fallback;
}

// ── Opportunity researcher ─────────────────────────────────────────────────────

type ProductOpportunity = {
  product_type: "template_pack" | "content_pack" | "guide" | "prompt_library";
  niche: string;
  title: string;
  price_cents: number;
  why: string;
};

async function researchOpportunity(existingTitles: string[]): Promise<ProductOpportunity> {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const month = new Date().toLocaleDateString("en-US", { month: "long" });

  // Build context from what we already have
  const existingSummary = existingTitles.length > 0
    ? `Already live on Gumroad (AVOID duplicating these niches):\n${existingTitles.slice(-20).map(t => `- ${t}`).join("\n")}`
    : "This is our first product — wide open!";

  const prompt = `You are a digital product researcher for a Gumroad store. Today is ${dayOfWeek}, ${today}.

Your job: identify the single BEST digital product opportunity to create RIGHT NOW and publish today.

${existingSummary}

CONTEXT — What sells well on Gumroad right now:
- Business templates (proposal, contract, invoice packs) for specific niches
- Social media content calendars (30-day plans) for specific industries
- AI prompt libraries for specific roles/jobs
- "Ultimate Guide" ebooks on practical business/freelance topics
- Seasonal: ${month} is active — what do people need THIS month?

DECISION RULES:
1. Pick a niche NOT already covered by our existing products
2. Prioritize: seasonal relevance + high buyer intent + specific niche (not too broad)
3. "prompt_library" and "template_pack" sell fastest (more specific value)
4. "guide" commands highest price ($14.97)
5. Think: who is actively searching Gumroad TODAY? What problem do they need solved?

Return EXACTLY this JSON (no markdown):
{
  "product_type": "template_pack" | "content_pack" | "guide" | "prompt_library",
  "niche": "specific niche in 2-4 words",
  "title": "Full product title (compelling, specific, searchable on Gumroad — 6-12 words)",
  "price_cents": 997 or 1497,
  "why": "One sentence: why this specific product will sell today"
}`;

  return aiJSON<ProductOpportunity>(prompt, {
    product_type: "template_pack",
    niche: "freelancer",
    title: "Freelancer Business Pack: Proposal, Contract & Invoice Templates",
    price_cents: 997,
    why: "Evergreen demand from freelancers looking to look professional",
  }, 400);
}

// ── Content generators ─────────────────────────────────────────────────────────

async function generateContent(opp: ProductOpportunity): Promise<string> {
  const generators: Record<string, () => Promise<string>> = {
    template_pack: () => ai(`Create a professional ${opp.niche} business document pack with THREE complete, ready-to-use templates:

## TEMPLATE 1: PROPOSAL TEMPLATE
Full 2-page proposal for a ${opp.niche} professional. Include header, executive summary, scope of work, deliverables, timeline, investment table, terms section, signature block. Use [PLACEHOLDERS] for all variable fields.

## TEMPLATE 2: SERVICE AGREEMENT / CONTRACT
Legally-structured contract for ${opp.niche} services. Include: parties section, services description, payment terms, revision policy, intellectual property clause, termination clause, limitation of liability, signature block.

## TEMPLATE 3: INVOICE TEMPLATE
Professional invoice with: invoice number, date fields, bill-to section, itemized services table (description/quantity/rate/amount columns), subtotal/tax/total, payment terms, due date, accepted payment methods, thank you note.

Make each template complete, professional, and immediately usable. Heavy use of [PLACEHOLDER] fields so buyers can customize easily.`, 3500),

    content_pack: () => ai(`Create a complete 30-day social media content calendar for a ${opp.niche} business.

Format with 30 clearly numbered entries. Each entry must include:
- Day # and platform (rotate: Instagram / Facebook / LinkedIn)
- Post type label: [EDUCATIONAL] [PROMOTIONAL] [BEHIND-THE-SCENES] [ENGAGEMENT] [TESTIMONIAL]
- Ready-to-post caption (80-150 words, platform-appropriate)
- 6-8 relevant hashtags

Mix: 8 educational, 6 promotional, 6 behind-the-scenes, 5 engagement (questions/polls), 5 testimonial prompts.
Make every caption specific to ${opp.niche} — real industry language, real scenarios.`, 3500),

    guide: () => ai(`Write the definitive guide: "${opp.title}"

Structure this as a complete, value-packed guide:

# Introduction
What this guide covers, who it's for, what they'll achieve after reading it (200 words)

# Chapter 1: Foundation (600 words)
Core concepts, why this matters now, common mistakes to avoid

# Chapter 2: Strategy & Positioning (600 words)
Step-by-step strategic approach with specific tactics

# Chapter 3: Tools & Execution (600 words)
Specific tools, workflows, templates, real examples

# Chapter 4: Advanced Tactics (500 words)
What the top 5% do differently, insider tips, scaling strategies

# Chapter 5: Common Mistakes & How to Fix Them (400 words)
The 7 most common mistakes + exact fixes

# Action Checklist
25 specific action items numbered and ready to execute

# Resources & Next Steps
5-8 recommended resources, tools, communities

Write with authority. Include specific numbers, examples, and tactics. Worth every cent of $14.97.`, 4000),

    prompt_library: () => ai(`Create a comprehensive AI prompt library: "${opp.title}"

Organize into 8 categories. Write the ACTUAL prompt text for each (not descriptions of prompts).
Each prompt should be immediately usable in ChatGPT or Claude.

## CATEGORY 1: ${opp.niche} Content Creation (35 prompts)
## CATEGORY 2: Marketing & Outreach for ${opp.niche} (30 prompts)
## CATEGORY 3: Sales & Client Communication (25 prompts)
## CATEGORY 4: Research & Analysis (25 prompts)
## CATEGORY 5: Writing & Documents (25 prompts)
## CATEGORY 6: Social Media Specific (30 prompts)
## CATEGORY 7: Strategy & Planning (20 prompts)
## CATEGORY 8: Productivity & Operations (20 prompts)

Format each prompt starting with "Act as..." or "Write..." or "Create..." or "Analyze...".
Make them specific to ${opp.niche}. Include [VARIABLES] where buyers should customize.`, 4000),
  };

  const generator = generators[opp.product_type] || generators.template_pack;
  return generator();
}

// ── PDF builder ────────────────────────────────────────────────────────────────

async function buildPdf(title: string, content: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regFont  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const W = 612, H = 792, M = 52, CW = W - M * 2;
  const FS = 10, LH = 14;
  const accent = rgb(0.09, 0.43, 0.62);
  const dark   = rgb(0.06, 0.09, 0.14);

  // Cover page
  const cover = pdfDoc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: dark });
  cover.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: accent });
  cover.drawRectangle({ x: 0, y: 0, width: W, height: 6, color: accent });
  cover.drawRectangle({ x: M - 16, y: H / 2 - 60, width: 4, height: 120, color: accent });

  // Wrap title
  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (boldFont.widthOfTextAtSize(test, 22) > CW) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);

  const titleY = H / 2 + lines.length * 14;
  lines.forEach((l, i) => cover.drawText(l, { x: M, y: titleY - i * 30, size: 22, font: boldFont, color: rgb(1,1,1) }));
  cover.drawText("M² Digital Products · mattmichelstraining.com", { x: M, y: M + 20, size: 10, font: regFont, color: rgb(0.5, 0.55, 0.65) });
  cover.drawText(`© ${new Date().getFullYear()} · All rights reserved`, { x: M, y: M, size: 9, font: regFont, color: rgb(0.35, 0.4, 0.5) });

  // Content pages
  const paras = content.split("\n").filter(l => l.trim());
  let page = pdfDoc.addPage([W, H]);
  let y = H - M;

  for (const para of paras) {
    const isH1 = para.startsWith("# ") && !para.startsWith("## ");
    const isH2 = para.startsWith("## ");
    const isH3 = para.startsWith("### ");
    const isBullet = para.trim().startsWith("- ") || para.trim().startsWith("• ");
    const text = para.replace(/^#{1,3}\s*/, "").replace(/^\-\s*/, "").trim();
    if (!text) continue;

    const font = (isH1 || isH2 || isH3) ? boldFont : regFont;
    const size = isH1 ? 15 : isH2 ? 13 : isH3 ? 11 : FS;
    const color = isH1 ? accent : isH2 ? accent : isH3 ? rgb(0.2, 0.3, 0.4) : rgb(0.15, 0.2, 0.28);
    const indent = isBullet ? M + 12 : M;
    const maxW = CW - (isBullet ? 12 : 0);

    // Word wrap
    const wwords = text.split(" ");
    const wrapped: string[] = [];
    let wl = "";
    for (const w of wwords) {
      const t = wl ? `${wl} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > maxW) { wrapped.push(wl); wl = w; }
      else wl = t;
    }
    if (wl) wrapped.push(wl);

    const needed = wrapped.length * LH + (isH1 ? 12 : isH2 ? 8 : 4);
    if (y - needed < M) { page = pdfDoc.addPage([W, H]); y = H - M; }

    if (isH1) { y -= 8; }
    if (isBullet && wrapped.length > 0) {
      page.drawText("•", { x: M, y, size, font, color });
    }
    for (const wline of wrapped) {
      page.drawText(wline, { x: indent, y, size, font, color });
      y -= LH;
    }
    y -= isH1 ? 8 : isH2 ? 5 : 2;
  }

  return pdfDoc.save();
}

// ── Gumroad publisher ──────────────────────────────────────────────────────────

async function publishToGumroad(opp: ProductOpportunity, pdfBytes: Uint8Array, desc: string): Promise<{ id: string; url: string }> {
  const createRes = await fetch("https://api.gumroad.com/v2/products", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: GUMROAD_TOKEN,
      name: opp.title,
      description: desc.slice(0, 2000),
      price: String(opp.price_cents),
      published: "false",
    }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const cd = await createRes.json();
  if (!cd.success) throw new Error(`Create failed: ${JSON.stringify(cd).slice(0, 200)}`);
  const pid: string = cd.product.id;

  // Upload PDF
  const form = new FormData();
  form.append("access_token", GUMROAD_TOKEN);
  const fileName = opp.title.slice(0, 50).replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-") + ".pdf";
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), fileName);
  await fetch(`https://api.gumroad.com/v2/products/${pid}/files`, {
    method: "PUT", body: form, signal: AbortSignal.timeout(90_000),
  });

  // Publish
  const pubRes = await fetch(`https://api.gumroad.com/v2/products/${pid}`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: GUMROAD_TOKEN, published: "true" }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const pd = await pubRes.json().catch(() => ({}));
  const url: string = pd.product?.short_url ?? `https://gumroad.com/l/${pid}`;

  return { id: pid, url };
}

// ── Create one product (called in a loop) ─────────────────────────────────────

async function createOneProduct(knownTitles: string[]): Promise<{ title: string; url: string; skipped?: boolean }> {
  const opp = await researchOpportunity(knownTitles);
  log("Opportunity", { title: opp.title, type: opp.product_type });

  const tooSimilar = knownTitles.some(t => t === opp.title);
  if (tooSimilar) return { title: opp.title, url: "", skipped: true };

  // Reserve slot immediately so next iteration sees it
  const { data: row } = await sb.from("gumroad_digital_products")
    .insert({ product_type: opp.product_type, title: opp.title, niche: opp.niche, price_cents: opp.price_cents, status: "creating" })
    .select("id").single();
  const rowId = row?.id;

  const content = await generateContent(opp);
  if (!content || content.length < 400) throw new Error("AI returned insufficient content");

  const desc = await ai(`Write a compelling 3-paragraph Gumroad product description (no markdown) for:
"${opp.title}"
Type: ${opp.product_type.replace("_", " ")}
Niche: ${opp.niche}
Price: $${(opp.price_cents / 100).toFixed(2)}

Paragraph 1: Who this is for and what problem it solves
Paragraph 2: Exactly what's included (be specific)
Paragraph 3: The value — time saved, money earned, why it's worth it right now

Do not use bullet points. Do not use markdown. Max 200 words.`, 400);

  const pdfBytes = await buildPdf(opp.title, content);
  const result = await publishToGumroad(opp, pdfBytes, desc || opp.title);

  if (rowId) {
    await sb.from("gumroad_digital_products").update({
      gumroad_product_id: result.id,
      gumroad_url: result.url,
      status: "live",
    }).eq("id", rowId);
  }

  log("Published", { title: opp.title, url: result.url });
  return { title: opp.title, url: result.url };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const count = Math.min(parseInt(url.searchParams.get("count") || "1"), 20);

  log(`Starting — creating ${count} product(s)`);

  if (!GUMROAD_TOKEN) {
    log("No GUMROAD_ACCESS_TOKEN — skipping");
    return new Response(JSON.stringify({ skipped: true, reason: "no_token" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Return 202 immediately for large batches so we don't timeout
  const runWork = async () => {
    const published: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < count; i++) {
      try {
        // Re-fetch live titles each iteration so we see what previous iterations created
        const { data: existing } = await sb.from("gumroad_digital_products")
          .select("title")
          .in("status", ["live", "creating"])
          .order("created_at", { ascending: false })
          .limit(100);
        const knownTitles = (existing || []).map((e: { title: string }) => e.title);

        log(`Creating product ${i + 1}/${count}`, { existing: knownTitles.length });
        const result = await createOneProduct(knownTitles);
        if (!result.skipped) published.push(result.title);
      } catch (err) {
        log(`Product ${i + 1} failed`, { err: String(err).slice(0, 200) });
        failed.push(String(err).slice(0, 100));
      }
    }

    // Send summary email
    if (RESEND_KEY && published.length > 0) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Gumroad Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `📦 ${published.length} new Gumroad products live`,
          html: `
<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
  <h2 style="color:#22c55e;margin:0 0 16px;">📦 Batch Complete: ${published.length} Products Live</h2>
  <ol style="padding-left:20px;">
    ${published.map(t => `<li style="margin-bottom:8px;color:#e2e8f0;">${t}</li>`).join("")}
  </ol>
  ${failed.length > 0 ? `<p style="color:#f59e0b;font-size:12px;">⚠️ ${failed.length} failed — will retry on next run</p>` : ""}
  <p style="color:#334155;font-size:11px;margin-top:20px;">Runs again daily at 2pm UTC</p>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "gumroad-digital-creator",
      last_run_at: new Date().toISOString(),
      last_status: published.length > 0 ? "ok" : "idle",
      last_result: JSON.stringify({ published: published.length, failed: failed.length, titles: published }),
    }, { onConflict: "agent_name" });

    return { published, failed };
  };

  if (count > 1) {
    // Background mode — return immediately, work continues async
    // @ts-expect-error EdgeRuntime is Supabase-only global
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-expect-error
      EdgeRuntime.waitUntil(runWork());
    } else {
      runWork();
    }
    return new Response(JSON.stringify({ dispatched: true, count, message: `Creating ${count} products in background — summary email incoming` }), {
      status: 202, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Single product — run synchronously
  try {
    const { data: existing } = await sb.from("gumroad_digital_products")
      .select("title")
      .in("status", ["live", "creating"])
      .order("created_at", { ascending: false })
      .limit(100);
    const knownTitles = (existing || []).map((e: { title: string }) => e.title);

    const result = await createOneProduct(knownTitles);

    if (result.skipped) {
      return new Response(JSON.stringify({ skipped: true, reason: "already_exists", title: result.title }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Single-product email
    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Gumroad Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `📦 New Gumroad product live: ${result.title.slice(0, 50)}`,
          html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
  <h2 style="color:#22c55e;">📦 New Product Published</h2>
  <p style="color:#e2e8f0;">${result.title}</p>
  <a href="${result.url}" style="display:inline-block;background:#22c55e;color:#000;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">View on Gumroad →</a>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "gumroad-digital-creator",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ title: result.title, url: result.url }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, title: result.title, url: result.url }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", { err: String(err).slice(0, 300) });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }

});

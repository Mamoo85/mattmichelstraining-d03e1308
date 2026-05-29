// medium-content-agent — Autonomous Medium Partner Program publisher
//
// Runs 3x/week (Mon/Wed/Fri 10am UTC) via cron.
// Publishes SEO articles to Medium that:
//   1. Earn $0.01–$0.10 per read via Medium Partner Program (500–5000 reads/article)
//   2. Drive traffic to Gumroad/Etsy products via in-article links
//   3. Build authority in AI, business, productivity niches
//
// SETUP (one-time, ~5 min):
//   1. Go to medium.com → Settings → Security → Integration tokens
//   2. Generate token → set secret: MEDIUM_INTEGRATION_TOKEN
//   3. Set MEDIUM_PUBLICATION_ID (optional, if posting to a publication)
//
// Revenue: $50–500/month from Partner Program + product link conversions
// Compound growth: each article earns indefinitely, audience builds over time.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MEDIUM_TOKEN     = Deno.env.get("MEDIUM_INTEGRATION_TOKEN") || "";
const MEDIUM_PUB_ID    = Deno.env.get("MEDIUM_PUBLICATION_ID") || "";
const RESEND_KEY       = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY      = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY    = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY       = Deno.env.get("OPENAI_API_KEY") || "";
const GUMROAD_BASE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://mattmichelstraining.gumroad.com";
const OWNER_EMAIL      = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[MEDIUM-AGENT] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string, maxTokens = 4000): Promise<string> {
  for (const cfg of [
    { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_KEY,
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: (p: string, t: number) => ({ model: "google/gemini-2.5-flash", max_tokens: t, messages: [{ role: "user", content: p }] }) },
    { url: "https://api.anthropic.com/v1/messages", key: ANTHROPIC_KEY,
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: (p: string, t: number) => ({ model: "claude-haiku-4-5-20251001", max_tokens: t, messages: [{ role: "user", content: p }] }) },
    { url: "https://api.openai.com/v1/chat/completions", key: OPENAI_KEY,
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: (p: string, t: number) => ({ model: "gpt-4o-mini", max_completion_tokens: t, messages: [{ role: "user", content: p }] }) },
  ]) {
    if (!cfg.key) continue;
    try {
      const r = await fetch(cfg.url, { method: "POST", headers: cfg.headers, body: JSON.stringify(cfg.body(prompt, maxTokens)), signal: AbortSignal.timeout(40_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch {}
  }
  return "";
}

// Article topics that perform well on Medium + link to our products
const ARTICLE_ANGLES = [
  { topic: "AI prompt libraries for productivity", niche: "AI tools", product_angle: "prompt library" },
  { topic: "Small business automation strategies", niche: "business", product_angle: "business templates" },
  { topic: "Freelancer workflow optimization", niche: "freelancing", product_angle: "proposal templates" },
  { topic: "Content marketing templates that convert", niche: "marketing", product_angle: "content calendar" },
  { topic: "ChatGPT use cases for entrepreneurs", niche: "AI tools", product_angle: "prompt library" },
  { topic: "Passive income with digital products", niche: "online business", product_angle: "digital products" },
  { topic: "Instagram content strategy for 2025", niche: "social media", product_angle: "content calendar" },
  { topic: "Client proposal best practices", niche: "freelancing", product_angle: "proposal templates" },
  { topic: "AI writing tools comparison", niche: "AI tools", product_angle: "prompt library" },
  { topic: "Etsy digital products that actually sell", niche: "Etsy", product_angle: "digital downloads" },
  { topic: "Side hustle income from printable products", niche: "passive income", product_angle: "printable templates" },
  { topic: "Email marketing templates for service businesses", niche: "marketing", product_angle: "email templates" },
];

async function generateArticle(angle: typeof ARTICLE_ANGLES[0], productUrl: string, existingTitles: string[]): Promise<{
  title: string; content: string; tags: string[];
}> {
  const skip = existingTitles.length ? `Avoid these angles already covered:\n${existingTitles.slice(-10).join("\n")}` : "";

  const article = await ai(`Write a high-quality Medium article about: ${angle.topic}

Target audience: ${angle.niche} professionals
Article goal: Teach something genuinely useful + naturally mention a relevant product

${skip}

Article structure:
1. Compelling headline (8-12 words, curiosity or number hook)
2. Hook paragraph (stat or surprising insight, 2-3 sentences)
3. Main body — 5-7 sections with H2 headers:
   - Real, actionable advice each section
   - Include one specific example or case study
   - Use numbered lists where helpful
4. Natural product mention (not spammy): "I created a [${angle.product_angle}] that covers this: [link]"
   Insert this naturally into the most relevant section
5. Conclusion with key takeaways

IMPORTANT:
- Write at least 1200 words (Medium Partner Program favors longer content)
- Use <h2> and <h3> for headers (Medium renders HTML)
- No fluff — every paragraph earns its place
- Tone: expert friend, not corporate

Replace [link] with: ${productUrl}

Format as clean HTML that Medium accepts (h2, h3, p, ul, li, strong, em — no divs or CSS).`, 5000);

  if (!article || article.length < 500) throw new Error("Article generation failed or too short");

  // Extract title
  const titleMatch = article.match(/<h1[^>]*>(.+?)<\/h1>|^#\s+(.+)/m);
  const title = titleMatch ? (titleMatch[1] || titleMatch[2]).replace(/<[^>]+>/g, "").trim() : `${angle.topic} — Practical Guide for ${new Date().getFullYear()}`;

  const tags = [
    angle.niche.toLowerCase().replace(/\s+/g, "-"),
    "productivity",
    "business",
    "ai",
    "side-hustle",
  ].slice(0, 5);

  return { title, content: article, tags };
}

async function getMediumUserId(): Promise<string> {
  const r = await fetch("https://api.medium.com/v1/me", {
    headers: { Authorization: `Bearer ${MEDIUM_TOKEN}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Medium auth failed: ${r.status}`);
  const d = await r.json();
  return d.data.id;
}

async function publishToMedium(userId: string, article: { title: string; content: string; tags: string[] }): Promise<{ id: string; url: string }> {
  const endpoint = MEDIUM_PUB_ID
    ? `https://api.medium.com/v1/publications/${MEDIUM_PUB_ID}/posts`
    : `https://api.medium.com/v1/users/${userId}/posts`;

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${MEDIUM_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: article.title,
      contentFormat: "html",
      content: article.content,
      tags: article.tags,
      publishStatus: "public",
      license: "all-rights-reserved",
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const d = await r.json();
  if (!r.ok) throw new Error(`Publish failed: ${JSON.stringify(d).slice(0, 300)}`);
  return { id: d.data.id, url: d.data.url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Start");

  if (!MEDIUM_TOKEN) {
    return new Response(JSON.stringify({
      skipped: true,
      reason: "MEDIUM_INTEGRATION_TOKEN not set",
      setup: "medium.com → Settings → Security → Integration tokens → Generate → set MEDIUM_INTEGRATION_TOKEN secret",
      estimated_revenue: "$50-500/month from Partner Program + product link conversions",
    }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  try {
    // Get a live Gumroad product URL to feature
    const { data: products } = await sb.from("gumroad_digital_products")
      .select("title, gumroad_url, niche").eq("status", "live").order("created_at", { ascending: false }).limit(20);

    const productForLink = products && products.length > 0
      ? products[Math.floor(Date.now() / 86400_000) % products.length]
      : null;
    const productUrl = productForLink?.gumroad_url || `${GUMROAD_BASE_URL}/l`;

    // Pick article angle
    const { data: existing } = await sb.from("medium_articles" as any).select("title").limit(50);
    const existingTitles = (existing || []).map((e: any) => e.title);
    const angleIdx = Math.floor(Date.now() / 86400_000) % ARTICLE_ANGLES.length;
    const angle = ARTICLE_ANGLES[angleIdx];

    log("Generating article", { angle: angle.topic, productUrl });
    const article = await generateArticle(angle, productUrl, existingTitles);

    // Get Medium user ID and publish
    const userId = await getMediumUserId();
    const result = await publishToMedium(userId, article);

    log("Published", result);

    await sb.from("medium_articles" as any).insert({
      title: article.title,
      medium_id: result.id,
      medium_url: result.url,
      tags: article.tags,
      niche: angle.niche,
      featured_product_url: productUrl,
      status: "published",
    }).catch(() => {});

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Medium Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `✍️ New Medium article live: ${article.title.slice(0, 50)}`,
          html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#10b981;">✍️ Article Published on Medium</h2>
<p style="font-size:16px;font-weight:bold;color:#fff;">${article.title}</p>
<p style="color:#94a3b8;">Tags: ${article.tags.join(", ")}</p>
<p style="color:#64748b;font-size:12px;">Each read earns $0.01–$0.10 via Partner Program. Links to: ${productUrl}</p>
<a href="${result.url}" style="display:inline-block;background:#10b981;color:#000;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">Read on Medium →</a>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "medium-content-agent",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ title: article.title, url: result.url }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, ...result, title: article.title }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", String(err).slice(0, 300));
    await sb.from("agent_heartbeats").upsert({
      agent_name: "medium-content-agent",
      last_run_at: new Date().toISOString(),
      last_status: "error",
      last_result: JSON.stringify({ error: String(err).slice(0, 200) }),
    }, { onConflict: "agent_name" });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});

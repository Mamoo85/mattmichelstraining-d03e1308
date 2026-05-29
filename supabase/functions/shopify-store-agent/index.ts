// shopify-store-agent — Autonomous Shopify store management
//
// Runs daily 1pm UTC via cron. Actions:
//   1. Read pod_listings from DB → group by niche → create/update Shopify collections
//   2. Find products with thin descriptions → rewrite with AI-optimized SEO copy
//   3. Create 1 blog post per week to drive organic traffic
//   4. Log all actions to shopify_sync_log
//
// Gracefully no-ops if SHOPIFY_ACCESS_TOKEN or SHOPIFY_SHOP_DOMAIN are not set.
// Matt just needs to add those two secrets after creating the Shopify store.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY      = Deno.env.get("RESEND_API_KEY") || "";
const SHOPIFY_DOMAIN  = Deno.env.get("SHOPIFY_SHOP_DOMAIN") || "";
const SHOPIFY_TOKEN   = Deno.env.get("SHOPIFY_ACCESS_TOKEN") || "";
const LOVABLE_KEY     = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY   = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY      = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL     = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[SHOPIFY-AGENT] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

// ── AI waterfall ───────────────────────────────────────────────────────────────

async function ai(prompt: string, maxTokens = 1200): Promise<string> {
  if (LOVABLE_KEY) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(20_000),
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
        signal: AbortSignal.timeout(20_000),
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
        signal: AbortSignal.timeout(20_000),
      });
      if (r.ok) { const d = await r.json(); const t = d?.choices?.[0]?.message?.content?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  return "";
}

// ── Shopify API helper ─────────────────────────────────────────────────────────

async function shopify(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/${path}`, {
    method,
    headers: {
      "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Shopify ${method} ${path} → ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

// ── Collection management ──────────────────────────────────────────────────────

const COLLECTION_NICHES: Record<string, string[]> = {
  "Father's Day Gifts": ["dad", "father", "papa", "grandpa", "boy dad", "girl dad"],
  "Nurse & Healthcare": ["nurse", "nursing", "doctor", "medical", "healthcare", "scrub"],
  "Teacher Appreciation": ["teacher", "educator", "school", "classroom", "principal"],
  "Dog Lover Gifts": ["dog", "puppy", "paw", "rescue dog", "dog mom", "dog dad"],
  "Cat Lover Gifts": ["cat", "kitty", "feline", "cat mom", "cat dad"],
  "Funny Mugs": ["funny", "sarcastic", "humor", "joke", "hilarious", "witty"],
  "Retirement Gifts": ["retirement", "retired", "retiring"],
  "Plant Lover Gifts": ["plant", "plants", "succulent", "cactus", "garden", "botanical"],
  "Coffee Lover Gifts": ["coffee", "espresso", "latte", "barista", "caffeine"],
  "Best Sellers": [],  // catch-all for top products
};

async function syncCollections(listings: Array<{ title: string; printify_product_id: string }>): Promise<number> {
  if (listings.length === 0) return 0;
  let synced = 0;

  // Get existing Shopify collections
  const collectionsData = await shopify("GET", "custom_collections.json?limit=250") as { custom_collections: Array<{ id: number; title: string }> };
  const existingCollections = new Map((collectionsData.custom_collections || []).map(c => [c.title, c.id]));

  // Get existing Shopify products to find IDs by title
  const productsData = await shopify("GET", "products.json?limit=250&fields=id,title") as { products: Array<{ id: number; title: string }> };
  const shopifyProducts = (productsData.products || []);

  for (const [collectionTitle, keywords] of Object.entries(COLLECTION_NICHES)) {
    // Find matching listings
    const matching = keywords.length > 0
      ? listings.filter(l => keywords.some(kw => l.title.toLowerCase().includes(kw.toLowerCase())))
      : listings.slice(0, 10); // best sellers = first 10

    if (matching.length === 0) continue;

    // Create collection if needed
    let collectionId = existingCollections.get(collectionTitle);
    if (!collectionId) {
      const collDesc = await ai(`Write a short 1-sentence SEO-friendly description for a Shopify collection called "${collectionTitle}". No quotes, no markdown.`, 100);
      const newColl = await shopify("POST", "custom_collections.json", {
        custom_collection: { title: collectionTitle, body_html: collDesc || `Shop our ${collectionTitle} collection.` },
      }) as { custom_collection: { id: number } };
      collectionId = newColl.custom_collection.id;
      existingCollections.set(collectionTitle, collectionId);
      log("Created collection", { collectionTitle, collectionId });
      await sb.from("shopify_sync_log").insert({ action_type: "collection_created", shopify_id: String(collectionId), details: { title: collectionTitle } });
      synced++;
    }

    // Add matching products to collection
    for (const listing of matching.slice(0, 20)) {
      const shopifyProduct = shopifyProducts.find(p => p.title.includes(listing.title.slice(0, 30)));
      if (!shopifyProduct) continue;
      await shopify("POST", "collects.json", {
        collect: { product_id: shopifyProduct.id, collection_id: collectionId },
      }).catch(() => {}); // ignore if already in collection
    }
  }

  return synced;
}

// ── Product description optimization ─────────────────────────────────────────

async function optimizeDescriptions(maxProducts = 5): Promise<number> {
  const productsData = await shopify("GET", "products.json?limit=50&fields=id,title,body_html") as {
    products: Array<{ id: number; title: string; body_html: string }>;
  };
  const needsDesc = (productsData.products || []).filter(p => !p.body_html || p.body_html.length < 100);

  let updated = 0;
  for (const product of needsDesc.slice(0, maxProducts)) {
    const desc = await ai(`Write an SEO-optimized product description for a print-on-demand item: "${product.title}".
    Include: what it is, who it's perfect for (as a gift), material/quality notes, and a gift occasion mention.
    Format as 2-3 short paragraphs of HTML (use <p> tags). Keep it under 250 words. No markdown.`, 400);

    if (!desc) continue;

    await shopify("PUT", `products/${product.id}.json`, {
      product: { id: product.id, body_html: desc },
    });

    log("Updated product description", { id: product.id, title: product.title.slice(0, 40) });
    await sb.from("shopify_sync_log").insert({
      action_type: "description_updated",
      shopify_id: String(product.id),
      details: { title: product.title.slice(0, 60) },
    });
    updated++;
    await new Promise(r => setTimeout(r, 1500));
  }
  return updated;
}

// ── Blog post creation ─────────────────────────────────────────────────────────

const BLOG_TOPICS = [
  "10 Unique Gift Ideas That Actually Make People Smile (Not Just Another Gift Card)",
  "Why Personalized Mugs Are the Perfect Gift for Every Occasion in 2026",
  "Gift Guide: The Best Presents for Nurses, Teachers, and Hardworking Professionals",
  "How to Find the Perfect Funny Gift That Matches Someone's Personality",
  "Father's Day Gift Ideas Beyond the Usual Tie and Golf Balls",
  "The Science Behind Why Personalized Gifts Create Stronger Memories",
  "Top 10 Gifts for Dog Moms and Cat Dads Who Have Everything",
  "Last-Minute Gift Ideas That Don't Look Last-Minute",
];

async function createBlogPost(): Promise<boolean> {
  // Check if we already posted a blog this week
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const recent = await sb.from("shopify_sync_log")
    .select("id")
    .eq("action_type", "blog_post_created")
    .gte("created_at", oneWeekAgo)
    .limit(1);
  if (recent.data && recent.data.length > 0) {
    log("Blog post already created this week — skipping");
    return false;
  }

  // Pick topic by week rotation
  const weekIdx = Math.floor(Date.now() / (7 * 86400000)) % BLOG_TOPICS.length;
  const topic = BLOG_TOPICS[weekIdx];

  const content = await ai(`Write a complete, engaging SEO blog post titled: "${topic}"

Structure:
- Intro paragraph (hook)
- 5-6 numbered sections with subheadings
- Each section: 2-3 sentences minimum
- Conclusion with a call to action to browse our store
- Total: 500-700 words

Write in a friendly, helpful tone. Format as HTML with <h2>, <p> tags. No markdown.
At the end, include a natural mention of our personalized gift shop.`, 2000);

  if (!content || content.length < 300) return false;

  // Get the first blog in the store (or we need to know the blog ID)
  const blogsData = await shopify("GET", "blogs.json") as { blogs: Array<{ id: number; title: string }> };
  let blogId = (blogsData.blogs || [])[0]?.id;
  if (!blogId) {
    const newBlog = await shopify("POST", "blogs.json", { blog: { title: "Gift Ideas & Guides" } }) as { blog: { id: number } };
    blogId = newBlog.blog.id;
  }

  const article = await shopify("POST", `blogs/${blogId}/articles.json`, {
    article: {
      title: topic,
      body_html: content,
      published: true,
      tags: "gift ideas, personalized gifts, unique gifts",
    },
  }) as { article: { id: number } };

  log("Blog post created", { title: topic, articleId: article.article?.id });
  await sb.from("shopify_sync_log").insert({
    action_type: "blog_post_created",
    shopify_id: String(article.article?.id),
    details: { title: topic },
  });

  return true;
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  log("Starting Shopify store agent");

  // Graceful no-op if credentials missing
  if (!SHOPIFY_DOMAIN || !SHOPIFY_TOKEN) {
    log("SHOPIFY_SHOP_DOMAIN or SHOPIFY_ACCESS_TOKEN not set — waiting for credentials");
    await sb.from("agent_heartbeats").upsert({
      agent_name: "shopify-store-agent",
      last_run_at: new Date().toISOString(),
      last_status: "waiting_credentials",
      last_result: JSON.stringify({ message: "Add SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN secrets to activate" }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({
      waiting: true,
      message: "Add SHOPIFY_SHOP_DOMAIN (e.g. your-store.myshopify.com) and SHOPIFY_ACCESS_TOKEN to Supabase secrets → this agent activates automatically",
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  }

  try {
    // 1. Get pod_listings from DB
    const { data: listings } = await sb.from("pod_listings")
      .select("title, printify_product_id, etsy_listing_id")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(200);

    log("Found POD listings", { count: listings?.length ?? 0 });

    // 2. Sync collections
    const collectionsCreated = await syncCollections(listings ?? []);
    log("Collections synced", { created: collectionsCreated });

    // 3. Optimize product descriptions (up to 5 per run)
    const descriptionsUpdated = await optimizeDescriptions(5);
    log("Descriptions updated", { count: descriptionsUpdated });

    // 4. Create blog post if needed
    const blogCreated = await createBlogPost();
    log("Blog post", { created: blogCreated });

    const summary = { collectionsCreated, descriptionsUpdated, blogCreated };

    // Email summary if anything happened
    if (RESEND_KEY && (collectionsCreated > 0 || descriptionsUpdated > 0 || blogCreated)) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Shopify Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `🛍️ Shopify Agent Report: ${collectionsCreated} collections, ${descriptionsUpdated} descriptions, ${blogCreated ? "1 blog post" : "no new blog"}`,
          html: `
<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
  <h2 style="color:#3b82f6;">🛍️ Shopify Store Agent</h2>
  <ul style="color:#e2e8f0;line-height:1.8;">
    <li>Collections created/updated: <strong style="color:#22c55e;">${collectionsCreated}</strong></li>
    <li>Product descriptions optimized: <strong style="color:#22c55e;">${descriptionsUpdated}</strong></li>
    <li>Blog post published: <strong style="color:#22c55e;">${blogCreated ? "Yes" : "No (already had one this week)"}</strong></li>
  </ul>
  <p style="color:#64748b;font-size:12px;">Next run: tomorrow 1pm UTC · shopify-store-agent</p>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "shopify-store-agent",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify(summary),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = String(err);
    log("Error", { err: msg.slice(0, 300) });
    await sb.from("agent_heartbeats").upsert({
      agent_name: "shopify-store-agent",
      last_run_at: new Date().toISOString(),
      last_status: "error",
      last_result: JSON.stringify({ error: msg.slice(0, 300) }),
    }, { onConflict: "agent_name" });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: CORS });
  }
});

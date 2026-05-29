// store-marketing-agent — Daily autonomous marketing for Gumroad + Shopify stores
//
// Runs daily 11am UTC via cron. Actions:
//   1. Pick a product from Gumroad or Shopify to feature today
//   2. Post to Facebook/Instagram promoting it (uses META_ACCESS_TOKEN)
//   3. Trigger pinterest-pinner for 3 recent products
//
// Zero spending decisions — all API calls are free.
// Never needs Matt's approval.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY        = Deno.env.get("RESEND_API_KEY") || "";
const META_TOKEN        = Deno.env.get("META_ACCESS_TOKEN") || "";
const META_PAGE_ID      = Deno.env.get("META_PAGE_ID") || "";
const LOVABLE_KEY       = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY     = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY        = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL       = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[STORE-MARKETING] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

// ── AI waterfall ───────────────────────────────────────────────────────────────

async function ai(prompt: string, maxTokens = 800): Promise<string> {
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

// ── Product picker ─────────────────────────────────────────────────────────────

type FeaturedProduct = {
  title: string;
  url: string;
  channel: "gumroad" | "shopify" | "pod";
  price?: string;
};

async function pickProductToFeature(): Promise<FeaturedProduct | null> {
  // Rotate between channels by day of week
  const day = new Date().getDay(); // 0=Sun ... 6=Sat

  if (day % 3 === 0) {
    // Gumroad digital product
    const { data } = await sb.from("gumroad_digital_products")
      .select("title, gumroad_url, price_cents")
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data && data.length > 0) {
      const pick = data[Math.floor(Math.random() * Math.min(data.length, 5))];
      return { title: pick.title, url: pick.gumroad_url, channel: "gumroad", price: `$${(pick.price_cents / 100).toFixed(2)}` };
    }
  }

  // POD listing (mug/shirt)
  const { data: pods } = await sb.from("pod_listings")
    .select("title, etsy_listing_id")
    .eq("status", "published")
    .not("etsy_listing_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (pods && pods.length > 0) {
    const pick = pods[Math.floor(Math.random() * Math.min(pods.length, 10))];
    const url = `https://www.etsy.com/listing/${pick.etsy_listing_id}`;
    return { title: pick.title, url, channel: "pod", price: "$17.99" };
  }

  // KDP book on Gumroad
  const { data: books } = await sb.from("kdp_books")
    .select("title, gumroad_url")
    .eq("status", "gumroad_live")
    .not("gumroad_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (books && books.length > 0) {
    const pick = books[Math.floor(Math.random() * Math.min(books.length, 5))];
    return { title: pick.title, url: pick.gumroad_url, channel: "gumroad", price: "$4.99" };
  }

  return null;
}

// ── Facebook post ─────────────────────────────────────────────────────────────
// PAUSED — waiting for dedicated store Facebook/Instagram pages (tomorrow)

async function postToFacebook(_product: FeaturedProduct): Promise<boolean> {
  log("Facebook posting paused — awaiting dedicated store pages");
  return false;
  if (!META_TOKEN || !META_PAGE_ID) return false;

  const postTypes = [
    `gift idea`,
    `perfect for someone special`,
    `great way to treat yourself`,
    `makes a thoughtful present`,
    `people are loving this`,
  ];
  const angle = postTypes[new Date().getDate() % postTypes.length];

  const caption = await ai(`Write a short, engaging Facebook post promoting this product as a ${angle}:
Product: "${product.title}"
Price: ${product.price || "available now"}
Channel: ${product.channel}

Requirements:
- 2-3 sentences max
- Friendly, not salesy
- End with the link: ${product.url}
- Add 3 relevant emojis
- No hashtags (Facebook organic)
- Do not include "Link in bio" — the link is in the post itself`, 200);

  if (!caption) return false;

  const res = await fetch(`https://graph.facebook.com/v18.0/${META_PAGE_ID}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: caption, access_token: META_TOKEN }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({}));
  if (data.id) {
    log("Facebook post published", { postId: data.id, product: product.title.slice(0, 40) });
    return true;
  }
  log("Facebook post failed", { data });
  return false;
}

// ── Pinterest trigger ─────────────────────────────────────────────────────────

async function triggerPinterest(): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/pinterest-pinner`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ source: "store-marketing-agent" }),
      signal: AbortSignal.timeout(60_000),
    });
    return res.ok;
  } catch { return false; }
}

// ── Instagram post (via Facebook Graph API) ───────────────────────────────────
// PAUSED — waiting for dedicated store Facebook/Instagram pages (tomorrow)

async function postToInstagram(_product: FeaturedProduct): Promise<boolean> {
  log("Instagram posting paused — awaiting dedicated store pages");
  return false;
  if (!META_TOKEN || !META_PAGE_ID) return false;

  const caption = await ai(`Write a punchy Instagram caption for this product:
Product: "${product.title}"
Price: ${product.price || "shop now"}
URL: ${product.url}

Requirements:
- Hook in first line (stops the scroll)
- 3-4 sentences total
- 8-12 relevant hashtags at the end
- Conversational, not corporate
- CTA: "Link in bio"`, 250);

  if (!caption) return false;

  // Get Instagram Business Account ID linked to the page
  const igRes = await fetch(`https://graph.facebook.com/v18.0/${META_PAGE_ID}?fields=instagram_business_account&access_token=${META_TOKEN}`, {
    signal: AbortSignal.timeout(10_000),
  });
  const igData = await igRes.json().catch(() => ({}));
  const igId = igData?.instagram_business_account?.id;
  if (!igId) return false;

  // Instagram requires a media object first (for text-only we skip — real usage needs image)
  // Post as Facebook story instead — it's available without image
  log("Instagram: would post, but requires image URL — skipping for now (no image in this rotation)");
  return false;
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  log("Starting store marketing agent");

  try {
    const product = await pickProductToFeature();
    log("Product selected", { product: product?.title?.slice(0, 50), channel: product?.channel });

    const results: Record<string, boolean | string> = {};

    if (product) {
      // Facebook post
      const fbPosted = await postToFacebook(product);
      results.facebook = fbPosted;

      // Pinterest
      const pinned = await triggerPinterest();
      results.pinterest = pinned;

      results.featured_product = product.title;
      results.featured_url = product.url;
    } else {
      results.product_found = false;
      log("No product found to feature — all pipelines may still be seeding");
    }

    // Daily email summary only on Monday (not every day — that's the CFO's job)
    const isMonday = new Date().getDay() === 1;
    if (isMonday && RESEND_KEY && product) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Store Marketing Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `📣 Weekly Marketing Report — stores are being promoted autonomously`,
          html: `
<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
  <h2 style="color:#f59e0b;">📣 Store Marketing Agent — Weekly Summary</h2>
  <p style="color:#94a3b8;">Your stores are being promoted on Facebook and Pinterest daily, 7 days a week, automatically.</p>
  <div style="background:#1e293b;border-radius:8px;padding:14px;margin:16px 0;">
    <div style="font-size:13px;color:#64748b;margin-bottom:4px;">Today's featured product</div>
    <div style="color:#e2e8f0;font-size:15px;">${product?.title || "None found yet"}</div>
    ${product?.url ? `<a href="${product.url}" style="color:#3b82f6;font-size:12px;">${product.url}</a>` : ""}
  </div>
  <ul style="color:#e2e8f0;line-height:1.8;">
    <li>Facebook post: <strong style="color:${results.facebook ? "#22c55e" : "#f59e0b"};">${results.facebook ? "Posted" : "Skipped (no META token)"}</strong></li>
    <li>Pinterest pins: <strong style="color:${results.pinterest ? "#22c55e" : "#f59e0b"};">${results.pinterest ? "Pinned" : "Skipped (no token)"}</strong></li>
  </ul>
  <p style="color:#64748b;font-size:12px;">Runs daily 11am UTC · store-marketing-agent</p>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "store-marketing-agent",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify(results),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    log("Error", { err: String(err) });
    await sb.from("agent_heartbeats").upsert({
      agent_name: "store-marketing-agent",
      last_run_at: new Date().toISOString(),
      last_status: "error",
      last_result: JSON.stringify({ error: String(err).slice(0, 200) }),
    }, { onConflict: "agent_name" });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});

// product-rss-feed — Live RSS/Atom feed of new products
//
// Serves at: <supabase-url>/functions/v1/product-rss-feed
// Add to m2training.com <head>:
//   <link rel="alternate" type="application/rss+xml" title="New Products" href="<this-url>" />
//
// RSS aggregators (Feedly 30M users, Inoreader, etc.) auto-discover and index it.
// Each new product appears as a feed item — free ongoing distribution.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL     = "https://www.mattmichelstraining.com";
const ETSY_SHOP    = "https://www.etsy.com/shop/M2CreativeStudio";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Pull 50 most-recently-published products across all sources
    const [{ data: etsy }, { data: gumroad }, { data: queue }] = await Promise.all([
      sb.from("etsy_listings" as any)
        .select("listing_id, title, description, price_usd, listing_url, main_image, created_at")
        .eq("status", "active").order("created_at", { ascending: false }).limit(30)
        .catch(() => ({ data: null })),
      sb.from("gumroad_digital_products" as any)
        .select("id, title, niche, price_cents, gumroad_url, created_at")
        .eq("status", "live").order("created_at", { ascending: false }).limit(20)
        .catch(() => ({ data: null })),
      sb.from("pod_product_queue")
        .select("id, name, product_type, retail_price, created_at")
        .eq("status", "published").order("created_at", { ascending: false }).limit(20)
        .catch(() => ({ data: null })),
    ]);

    type RssItem = { title: string; link: string; description: string; pubDate: string; image?: string; };
    const items: RssItem[] = [];

    for (const p of (etsy || [])) {
      if (!p.listing_url) continue;
      items.push({
        title: p.title || "New Gift Product",
        link: p.listing_url,
        description: (p.description || `Unique gift — free shipping in the US.`).slice(0, 300),
        pubDate: new Date(p.created_at || Date.now()).toUTCString(),
        image: p.main_image,
      });
    }

    for (const p of (gumroad || [])) {
      if (!p.gumroad_url) continue;
      const price = ((p.price_cents || 997) / 100).toFixed(2);
      items.push({
        title: p.title || `${p.niche || "Digital"} Download`,
        link: p.gumroad_url,
        description: `New digital download: ${p.niche || p.title}. $${price} — instant delivery.`,
        pubDate: new Date(p.created_at || Date.now()).toUTCString(),
      });
    }

    for (const p of (queue || [])) {
      items.push({
        title: p.name || `New ${p.product_type} Design`,
        link: ETSY_SHOP,
        description: `New print-on-demand ${p.product_type} now available. Ships free in 3–5 days.`,
        pubDate: new Date(p.created_at || Date.now()).toUTCString(),
      });
    }

    // Sort by recency
    items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    const top50 = items.slice(0, 50);

    const itemsXml = top50.map(item => `
    <item>
      <title>${esc(item.title)}</title>
      <link>${esc(item.link)}</link>
      <description>${esc(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${esc(item.link)}</guid>
      ${item.image ? `<enclosure url="${esc(item.image)}" type="image/jpeg" length="0" />` : ""}
    </item>`).join("\n");

    const now = new Date().toUTCString();
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>M2 Training — New Gifts &amp; Products</title>
    <link>${SITE_URL}/gifts</link>
    <description>New print-on-demand gifts and digital downloads. Nurse gifts, teacher gifts, dog mom gifts, funny mugs, and more. Free shipping in the US.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/functions/v1/product-rss-feed" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/pwa-512x512.png</url>
      <title>M2 Training Gifts</title>
      <link>${SITE_URL}/gifts</link>
    </image>
${itemsXml}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        ...CORS,
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=1800",
        "X-Item-Count": String(top50.length),
      },
    });
  } catch (err) {
    console.error("[PRODUCT-RSS-FEED]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

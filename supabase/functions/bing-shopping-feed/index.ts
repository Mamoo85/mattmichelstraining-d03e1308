// bing-shopping-feed — Bing Merchant Center product feed
//
// Identical schema to google-shopping-feed (Bing accepts the same Atom/g: format).
// Matt registers this URL in Bing Merchant Center once:
//   tools.bing.com/merchant/catalog → New data source → URL → paste this function URL
// Then products appear in Bing Shopping — FREE. Bing has 6B+ searches/month and
// far less seller competition than Google Shopping.
//
// Reads from: gumroad_digital_products, etsy_listings tables

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL     = Deno.env.get("PUBLIC_SITE_URL") || "https://mattmichelstraining.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string) => console.log(`[BING-SHOPPING-FEED] ${s}`);

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

type FeedItem = {
  id: string; title: string; description: string; link: string;
  price_usd: number; category: string; brand: string;
  condition: string; availability: string; image_link?: string;
};

async function collectProducts(): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  const { data: gumroad } = await sb
    .from("gumroad_digital_products")
    .select("id, title, niche, price_cents, gumroad_url, product_type")
    .eq("status", "live").order("created_at", { ascending: false }).limit(200);

  for (const p of (gumroad || [])) {
    if (!p.gumroad_url) continue;
    items.push({
      id: `gumroad-${p.id}`,
      title: p.title || "Digital Product",
      description: `${p.niche || ""} digital download — templates, guides, printables. Instant delivery.`.trim(),
      link: p.gumroad_url,
      price_usd: (p.price_cents || 997) / 100,
      category: "Media > Books > Digital",
      brand: "M2 Digital Products",
      condition: "new", availability: "in stock",
      image_link: `${SITE_URL}/images/products/default-product.png`,
    });
  }

  const { data: etsy } = await sb
    .from("etsy_listings" as any)
    .select("listing_id, title, description, price_usd, listing_url, main_image")
    .eq("status", "active").limit(500)
    .catch(() => ({ data: null }));

  for (const p of (etsy || [])) {
    if (!p.listing_url) continue;
    items.push({
      id: `etsy-${p.listing_id}`,
      title: p.title || "Gift Product",
      description: ((p.description || "").slice(0, 500)) || `Unique gift — ships free in 3-5 days. 100% satisfaction guaranteed.`,
      link: p.listing_url,
      price_usd: p.price_usd || 18.99,
      category: "Arts & Entertainment > Party & Celebration > Gift Giving > Gifts",
      brand: "M2 Creative Studio",
      condition: "new", availability: "in stock",
      image_link: p.main_image || undefined,
    });
  }

  log(`Collected ${items.length} products`);
  return items;
}

function buildFeed(items: FeedItem[]): string {
  const updated = new Date().toISOString();
  const entries = items.map(item => `
  <entry>
    <id>${esc(item.id)}</id>
    <title>${esc(item.title)}</title>
    <link href="${esc(item.link)}" />
    <updated>${updated}</updated>
    <content type="html">${esc(item.description)}</content>
    <g:id>${esc(item.id)}</g:id>
    <g:title>${esc(item.title)}</g:title>
    <g:description>${esc(item.description.slice(0, 500))}</g:description>
    <g:link>${esc(item.link)}</g:link>
    <g:price>${item.price_usd.toFixed(2)} USD</g:price>
    <g:availability>${item.availability}</g:availability>
    <g:condition>${item.condition}</g:condition>
    <g:brand>${esc(item.brand)}</g:brand>
    <g:google_product_category>${esc(item.category)}</g:google_product_category>
    ${item.image_link ? `<g:image_link>${esc(item.image_link)}</g:image_link>` : ""}
    <g:shipping>
      <g:country>US</g:country>
      <g:service>Free Shipping</g:service>
      <g:price>0.00 USD</g:price>
    </g:shipping>
  </entry>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:g="http://base.google.com/ns/1.0">
  <title>M2 Training — Gifts &amp; Digital Products</title>
  <link href="${SITE_URL}" />
  <updated>${updated}</updated>
  <author><name>M2 Training</name></author>
  <id>${SITE_URL}/bing-products-feed</id>
${entries}
</feed>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Generating Bing feed");
  try {
    const items = await collectProducts();
    const feed = buildFeed(items);
    await sb.from("agent_heartbeats").upsert({
      agent_name: "bing-shopping-feed",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ product_count: items.length }),
    }, { onConflict: "agent_name" }).catch(() => {});
    return new Response(feed, {
      headers: {
        ...CORS,
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Product-Count": String(items.length),
      },
    });
  } catch (err) {
    log(`Error: ${err}`);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

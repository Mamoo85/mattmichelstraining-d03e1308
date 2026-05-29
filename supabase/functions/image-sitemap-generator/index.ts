// image-sitemap-generator — Auto-generates sitemap-images.xml for Google Images
//
// Cron: daily 6am UTC
// Google Images drives significant gift/product search traffic. Products with
// proper image sitemaps appear in "Google Images Shopping" results.
//
// Submit to Google Search Console once:
//   Search Console → Sitemaps → Add sitemap → URL: <this-function-url>
// After that it auto-updates daily.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL     = "https://www.mattmichelstraining.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string) => console.log(`[IMAGE-SITEMAP] ${s}`);

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Generating image sitemap");

  try {
    type ImgEntry = { pageUrl: string; imageUrl: string; caption: string; title: string; };
    const images: ImgEntry[] = [];

    // Etsy listings with images
    const { data: etsy } = await sb
      .from("etsy_listings" as any)
      .select("listing_id, title, main_image, listing_url")
      .eq("status", "active")
      .not("main_image", "is", null)
      .limit(500)
      .catch(() => ({ data: null }));

    for (const p of (etsy || [])) {
      if (!p.main_image || !p.listing_url) continue;
      // Point page URL to our /gifts page (which indexes better than Etsy directly)
      const slug = (p.title || "product")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
      images.push({
        pageUrl: `${SITE_URL}/gifts`,
        imageUrl: p.main_image,
        caption: p.title || "Gift Product",
        title: p.title || "Gift Product",
      });
    }

    // Gumroad digital products
    const { data: gumroad } = await sb
      .from("gumroad_digital_products" as any)
      .select("id, title, niche, cover_url")
      .eq("status", "live")
      .not("cover_url", "is", null)
      .limit(200)
      .catch(() => ({ data: null }));

    for (const p of (gumroad || [])) {
      if (!p.cover_url) continue;
      images.push({
        pageUrl: `${SITE_URL}/gifts`,
        imageUrl: p.cover_url,
        caption: p.title || `${p.niche || "Digital"} Download`,
        title: p.title || `${p.niche || "Digital"} Download`,
      });
    }

    // Published POD products with any image data
    const { data: pod } = await sb
      .from("pod_product_queue")
      .select("id, name, product_type")
      .eq("status", "published")
      .limit(200)
      .catch(() => ({ data: null }));

    // Add category-level gift shop pages
    const categories = [
      { slug: "nurse-gifts", label: "Nurse Gifts" },
      { slug: "teacher-gifts", label: "Teacher Gifts" },
      { slug: "dog-mom-gifts", label: "Dog Mom Gifts" },
      { slug: "funny-mugs", label: "Funny Coffee Mugs" },
      { slug: "retirement-gifts", label: "Retirement Gifts" },
      { slug: "cat-mom-gifts", label: "Cat Mom Gifts" },
    ];

    log(`Collected ${images.length} product images + ${categories.length} category pages`);

    // Group images by page URL for proper sitemap format
    const byPage = new Map<string, ImgEntry[]>();
    for (const img of images) {
      const arr = byPage.get(img.pageUrl) ?? [];
      arr.push(img);
      byPage.set(img.pageUrl, arr);
    }

    // Add category pages
    for (const cat of categories) {
      const catUrl = `${SITE_URL}/gifts/${cat.slug}`;
      byPage.set(catUrl, []); // page with no extra images — just ensures it appears in sitemap
    }

    const urlEntries = Array.from(byPage.entries()).map(([pageUrl, imgs]) => {
      const imgTags = imgs.slice(0, 1000).map(img => `
    <image:image>
      <image:loc>${esc(img.imageUrl)}</image:loc>
      <image:caption>${esc(img.caption.slice(0, 200))}</image:caption>
      <image:title>${esc(img.title.slice(0, 200))}</image:title>
    </image:image>`).join("");
      return `  <url>
    <loc>${esc(pageUrl)}</loc>${imgTags}
  </url>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries}
</urlset>`;

    // Store in Supabase Storage for serving
    await sb.storage.from("public")
      .upload("sitemaps/sitemap-images.xml", new Blob([xml], { type: "application/xml" }), { upsert: true })
      .catch(() => {});

    await sb.from("agent_heartbeats").upsert({
      agent_name: "image-sitemap-generator",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ image_count: images.length }),
    }, { onConflict: "agent_name" }).catch(() => {});

    return new Response(xml, {
      headers: {
        ...CORS,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Image-Count": String(images.length),
      },
    });
  } catch (err) {
    log(`Error: ${err}`);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

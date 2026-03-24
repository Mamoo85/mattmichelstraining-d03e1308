import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://www.mattmichelstraining.com";

const STATIC_ROUTES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.8" },
  { path: "/for-parents", changefreq: "monthly", priority: "0.9" },
  { path: "/pricing", changefreq: "weekly", priority: "0.9" },
  { path: "/shop", changefreq: "weekly", priority: "0.8" },
  { path: "/learn", changefreq: "weekly", priority: "0.8" },
  { path: "/merch", changefreq: "monthly", priority: "0.6" },
  { path: "/schedule", changefreq: "daily", priority: "0.7" },
  { path: "/free-ai-generator", changefreq: "monthly", priority: "0.9" },
  { path: "/the-edge", changefreq: "monthly", priority: "0.6" },
  { path: "/install", changefreq: "monthly", priority: "0.5" },
  { path: "/detroit-web-design", changefreq: "weekly", priority: "0.9" },
  { path: "/demo-plumber", changefreq: "monthly", priority: "0.7" },
  { path: "/demo-electrician", changefreq: "monthly", priority: "0.7" },
  { path: "/demo-landscaping", changefreq: "monthly", priority: "0.7" },
  { path: "/demo-lawyer", changefreq: "monthly", priority: "0.7" },
  { path: "/demo-clinic", changefreq: "monthly", priority: "0.7" },
];

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: pages, error } = await supabase
      .from("seo_landing_pages")
      .select("slug, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Sitemap query error:", error);
    }

    const staticEntries = STATIC_ROUTES.map(
      (r) => `  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
    ).join("\n");

    const dynamicEntries = (pages || [])
      .map((p) => {
        const lastmod = p.created_at ? p.created_at.split("T")[0] : "";
        return `  <url>
    <loc>${SITE_URL}/training/${p.slug}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${dynamicEntries}
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("generate-sitemap error:", e);
    return new Response("<error>Internal Server Error</error>", {
      status: 500,
      headers: { "Content-Type": "application/xml" },
    });
  }
});

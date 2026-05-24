// Generates a fresh sitemap.xml from active etsy_products and serves it.
// GET → XML sitemap. POST {} → same. Cron: daily.
// Public route. URL: /functions/v1/gng-sitemap-rebuild
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUBLIC_BASE = Deno.env.get("DWA_PUBLIC_URL") ?? "https://m2training.lovable.app";

function xmlEscape(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: listings, error } = await sb
      .from("etsy_products")
      .select("listing_id,title,etsy_updated_ts")
      .eq("state", "active")
      .order("etsy_updated_ts", { ascending: false, nullsFirst: false })
      .limit(2000);
    if (error) throw error;

    const staticUrls = [
      { loc: `${PUBLIC_BASE}/gng`, priority: "1.0" },
      { loc: `${PUBLIC_BASE}/guild-and-grains`, priority: "0.9" },
      { loc: `${PUBLIC_BASE}/gifts`, priority: "0.9" },
    ];

    const items = (listings ?? []).map((l: any) => {
      const lastmod = l.etsy_updated_ts
        ? new Date(l.etsy_updated_ts * 1000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      return `  <url>
    <loc>${PUBLIC_BASE}/gift/${l.listing_id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    const staticXml = staticUrls.map((u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
    <changefreq>daily</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${items.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Sitemap-Entries": String(staticUrls.length + items.length),
      },
    });
  } catch (e) {
    return new Response(`<?xml version="1.0"?><error>${(e as Error).message}</error>`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});

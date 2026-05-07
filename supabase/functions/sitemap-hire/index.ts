// Public sitemap of programmatic /hire-:trade-in-:city pages.
// Pulls from prospector_targets so adding a new market = no code deploy.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE = "https://www.detroitwebagent.com";

const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await sb
    .from("prospector_targets")
    .select("trade, city, state, active, updated_at")
    .eq("active", true);

  if (error) {
    return new Response(`<error>${error.message}</error>`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }

  const today = new Date().toISOString().split("T")[0];

  // Static DWA product landing pages (P1 audit fix — were missing from sitemap)
  const STATIC_DWA_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/all-services", priority: "0.9", changefreq: "weekly" },
    { path: "/agency", priority: "0.9", changefreq: "weekly" },
    { path: "/hire-alert", priority: "0.9", changefreq: "weekly" },
    { path: "/hire-alert-trial", priority: "0.8", changefreq: "weekly" },
    { path: "/hire-alert-healthcare", priority: "0.7", changefreq: "monthly" },
    { path: "/talent-radar-vs-staffing", priority: "0.7", changefreq: "monthly" },
    { path: "/field-service", priority: "0.9", changefreq: "weekly" },
    { path: "/contractor-leads", priority: "0.9", changefreq: "weekly" },
    { path: "/contractor-marketplace", priority: "0.8", changefreq: "weekly" },
    { path: "/dead-lead-intake", priority: "0.8", changefreq: "weekly" },
    { path: "/missed-call-catch", priority: "0.9", changefreq: "weekly" },
    { path: "/missed-call-text", priority: "0.7", changefreq: "monthly" },
    { path: "/mortgage-radar", priority: "0.9", changefreq: "weekly" },
    { path: "/mortgage-radar-demo", priority: "0.7", changefreq: "monthly" },
    { path: "/mortgage-radar-vs-trigger-leads", priority: "0.7", changefreq: "monthly" },
    { path: "/mortgage-radar-vs-zillow", priority: "0.7", changefreq: "monthly" },
    { path: "/site-radar", priority: "0.8", changefreq: "weekly" },
    { path: "/ai-phone-answering", priority: "0.8", changefreq: "weekly" },
    { path: "/ai-reputation-dashboard", priority: "0.7", changefreq: "monthly" },
    { path: "/bundle-revenue-suite", priority: "0.8", changefreq: "weekly" },
    { path: "/free-tools", priority: "0.7", changefreq: "weekly" },
    { path: "/free-site-scanner", priority: "0.7", changefreq: "weekly" },
    { path: "/web-design-services", priority: "0.7", changefreq: "monthly" },
    { path: "/detroit-web-design", priority: "0.8", changefreq: "weekly" },
    { path: "/manufacturing-web-design", priority: "0.6", changefreq: "monthly" },
    { path: "/real-estate-web-design", priority: "0.6", changefreq: "monthly" },
    { path: "/roi", priority: "0.5", changefreq: "monthly" },
    { path: "/get-started", priority: "0.6", changefreq: "monthly" },
  ];

  const staticUrls = STATIC_DWA_PAGES.map((p) => `  <url>
    <loc>${SITE}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n");

  const urls = (data || []).map((r) => {
    const tradeSlug = toSlug(r.trade).replace("-contractor", "");
    const citySlug = toSlug(r.city);
    const lastmod = r.updated_at ? String(r.updated_at).split("T")[0] : today;
    return `  <url>
    <loc>${SITE}/hire-${tradeSlug}-in-${citySlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${urls}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

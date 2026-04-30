// Public sitemap of programmatic /hire-:trade-in-:city pages.
// Pulls from prospector_targets so adding a new market = no code deploy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN")!;
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url, email } = await req.json();
    if (!url || !email) {
      return new Response(JSON.stringify({ error: "url and email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call DataForSEO On-Page instant pages
    const creds = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
    const dfsRes = await fetch("https://api.dataforseo.com/v3/on_page/instant_pages", {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ url, check_spell: false }]),
    });
    const dfsData = await dfsRes.json();

    const page = dfsData?.tasks?.[0]?.result?.[0]?.items?.[0] || {};
    const meta = page.meta || {};

    const results = {
      url,
      title: meta.title || "Not found",
      title_length: (meta.title || "").length,
      description: meta.description || "Not found",
      description_length: (meta.description || "").length,
      h1_count: page.meta?.htags?.h1?.length || 0,
      word_count: page.meta?.content?.plain_text_word_count || 0,
      images_without_alt: page.meta?.images_without_alt_count || 0,
      total_images: page.meta?.images_count || 0,
      has_canonical: !!meta.canonical,
      has_robots: !!meta.robots,
      status_code: page.status_code || 0,
      score: 0,
    };

    // Calculate score
    let score = 0;
    if (results.title_length >= 30 && results.title_length <= 60) score += 20;
    else if (results.title_length > 0) score += 10;
    if (results.description_length >= 120 && results.description_length <= 160) score += 20;
    else if (results.description_length > 0) score += 10;
    if (results.h1_count === 1) score += 20;
    else if (results.h1_count > 0) score += 10;
    if (results.word_count >= 300) score += 15;
    if (results.images_without_alt === 0 && results.total_images > 0) score += 15;
    if (results.has_canonical) score += 5;
    if (results.has_robots) score += 5;
    results.score = score;

    // Save lead
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await sb.from("free_tool_leads").insert({ email, tool_used: "seo-health", input_url: url, results_summary: results });

    return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("free-seo-health-check error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

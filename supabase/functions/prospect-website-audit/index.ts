import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const { url, business_name, industry } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Scrape with Firecrawl
    let markdown = "";
    if (FIRECRAWL_API_KEY) {
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

      console.log(`[PROSPECT-AUDIT] Scraping: ${formattedUrl}`);
      const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: formattedUrl,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });

      const scrapeData = await scrapeRes.json();
      markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
      console.log(`[PROSPECT-AUDIT] Scraped ${markdown.length} chars`);
    }

    if (!markdown || markdown.length < 50) {
      return new Response(
        JSON.stringify({
          success: true,
          pain_points: [
            "Website could not be fully analyzed — may be blocking scrapers or have minimal content",
            "Consider checking if the site loads properly and has indexable content",
            "A manual review is recommended to identify specific improvement areas",
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: AI analysis via Lovable AI Gateway
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const truncatedMarkdown = markdown.slice(0, 4000);
    const prompt = `You are a web design sales consultant helping a B2B sales rep pitch website redesign services. Analyze this ${industry || "local"} business website for "${business_name || "this business"}".

Return EXACTLY 3 specific, actionable pain points about their website that would cost them customers or leads. Be specific — reference actual missing elements you can see (or not see) in the content. Each pain point should be 1-2 sentences.

Format as a JSON array of 3 strings. Example: ["No online booking — visitors can't schedule without calling.", "No testimonials or reviews shown — zero social proof.", "Mobile menu is broken — 60% of traffic can't navigate."]

Website content:
${truncatedMarkdown}`;

    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content || "[]";

    let pain_points: string[];
    try {
      const parsed = JSON.parse(content);
      pain_points = Array.isArray(parsed) ? parsed.slice(0, 3) : (parsed.pain_points || parsed.points || []).slice(0, 3);
    } catch {
      pain_points = [content.slice(0, 200)];
    }

    console.log(`[PROSPECT-AUDIT] Generated ${pain_points.length} pain points for ${business_name}`);

    return new Response(
      JSON.stringify({ success: true, pain_points }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[PROSPECT-AUDIT] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

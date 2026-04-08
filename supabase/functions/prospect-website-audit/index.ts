import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sonarResearch(query: string): Promise<{ content: string; citations: string[] }> {
  if (!OPENROUTER_API_KEY) return { content: "", citations: [] };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mattmichelstraining.com",
        "X-Title": "M2 Development Research",
      },
      body: JSON.stringify({
        model: "perplexity/sonar-reasoning",
        messages: [{ role: "user", content: query }],
        max_tokens: 1200,
      }),
    });
    if (!res.ok) return { content: "", citations: [] };
    const data = await res.json();
    return {
      content: data?.choices?.[0]?.message?.content || "",
      citations: data?.citations || [],
    };
  } catch {
    return { content: "", citations: [] };
  }
}

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

    // Step 2: AI analysis via Lovable AI Gateway (pain points from scraped content)
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

    // Step 3: Deep Research via Perplexity Sonar (live web intel)
    const sonarQuery = `Search the web for recent news, services, reviews, and business developments for "${business_name || "this business"}" ${industry ? `in the ${industry} industry` : ""}. What are their current pain points, recent changes, or competitive weaknesses? Return 3 bullet points of factual, recent intel.`;

    // Run both AI calls in parallel
    const [aiRes, sonarResult] = await Promise.all([
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      }),
      sonarResearch(sonarQuery),
    ]);

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content || "[]";

    let pain_points: string[];
    try {
      const parsed = JSON.parse(content);
      pain_points = Array.isArray(parsed) ? parsed.slice(0, 3) : (parsed.pain_points || parsed.points || []).slice(0, 3);
    } catch {
      pain_points = [content.slice(0, 200)];
    }

    // Build deep_research object
    let deep_research = null;
    if (sonarResult.content) {
      deep_research = {
        summary: sonarResult.content,
        citations: sonarResult.citations,
        researched_at: new Date().toISOString(),
      };
    }

    console.log(`[PROSPECT-AUDIT] Generated ${pain_points.length} pain points + deep research for ${business_name}`);

    return new Response(
      JSON.stringify({ success: true, pain_points, deep_research }),
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

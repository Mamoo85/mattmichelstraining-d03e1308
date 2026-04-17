import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stealthScrape, reasonToCopy } from "../_shared/stealth-scrape.ts";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function scrapeUrl(url: string): Promise<string> {
  const r = await stealthScrape(url, { maxChars: 5000 });
  return r.ok ? (r.markdown || "") : "";
}

async function aiAnalyze(prospectContent: string, competitorContents: string[]): Promise<any> {
  if (!LOVABLE_API_KEY) return { gaps: [], summary: "AI analysis unavailable" };
  const competitorText = competitorContents.map((c, i) => `--- Competitor ${i + 1} ---\n${c}`).join("\n\n");
  const prompt = `You are a competitive intelligence analyst for a home services / contractor business.

PROSPECT WEBSITE CONTENT:
${prospectContent.slice(0, 3000)}

COMPETITOR WEBSITES:
${competitorText.slice(0, 6000)}

Analyze what high-margin services the competitors offer that the prospect is MISSING from their website. Focus on specific services like "Tankless Water Heater Installation", "Hydro-jetting", "Backflow Testing", "Ductless Mini-Split", etc.

Return ONLY valid JSON:
{
  "gaps": [{"service": "Service Name", "revenue_potential": "High/Medium/Low", "reasoning": "Why this matters"}],
  "summary": "One paragraph executive summary"
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { gaps: [], summary: "Analysis failed" };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { gaps: [], summary: text.slice(0, 500) };
  } catch { return { gaps: [], summary: "Analysis error" }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url, email } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log lead (best-effort)
    if (email) {
      try {
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await sb.from("free_tool_leads").insert({
          email,
          tool_used: "service_gap_scanner",
          input_url: url,
          results_summary: { url },
        });
      } catch (e) { console.warn("lead insert failed:", e); }
    }

    // Scrape prospect (uses tiered stealth helper — sanitized errors)
    const prospectContent = await scrapeUrl(url);
    if (!prospectContent) {
      return new Response(JSON.stringify({ success: false, message: reasonToCopy("site_blocked_us") }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find competitor URLs from prospect content (look for location hints)
    // For now, use Firecrawl map to find related sites
    let competitorContents: string[] = [];
    // Scrape up to 2 competitor pages from search
    // Simple approach: extract domain, search for similar businesses
    const domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;

    // Use Firecrawl search for competitors
    try {
      const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `competitors of ${domain} local service contractor`, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
        signal: AbortSignal.timeout(25_000),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        competitorContents = (searchData?.data || [])
          .filter((r: any) => r.markdown)
          .map((r: any) => (r.markdown || "").slice(0, 3000))
          .slice(0, 3);
      }
    } catch { /* continue with whatever we have */ }

    const analysis = await aiAnalyze(prospectContent, competitorContents);

    return new Response(JSON.stringify({ success: true, ...analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

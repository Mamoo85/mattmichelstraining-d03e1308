import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url, email } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (email) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("free_tool_leads").insert({ tool_name: "ada_risk_scanner", email, company_name: url, input_data: { url } });
    }

    // Scrape with Firecrawl — get HTML for accessibility analysis
    let formatted = url.trim();
    if (!formatted.startsWith("http")) formatted = `https://${formatted}`;

    let htmlContent = "";
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: formatted, formats: ["html", "markdown"], onlyMainContent: false }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const data = await res.json();
        htmlContent = (data?.data?.html || data?.data?.markdown || "").slice(0, 8000);
      }
    } catch { /* continue */ }

    if (!htmlContent) {
      return new Response(JSON.stringify({ error: "Could not scrape the website" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // AI analysis for WCAG violations
    const prompt = `You are a WCAG 2.1 AA compliance auditor analyzing a website for ADA lawsuit risk.

WEBSITE HTML (partial):
${htmlContent.slice(0, 6000)}

Analyze for these critical WCAG violations:
1. Missing alt text on images
2. Poor color contrast (text on background)
3. Missing form labels
4. No heading hierarchy (H1, H2, etc.)
5. Missing skip navigation links
6. No ARIA landmarks
7. Non-descriptive link text ("click here", "read more")
8. Missing language attribute
9. Auto-playing media
10. Keyboard navigation issues

Return ONLY valid JSON:
{
  "risk_score": "Critical|High|Medium|Low",
  "lawsuit_probability": "Very High|High|Moderate|Low",
  "violations": [{"category": "Missing Alt Text", "severity": "Critical|High|Medium", "count": 5, "details": "Found 5 images without alt attributes"}],
  "summary": "Executive summary of risk",
  "estimated_remediation_cost": "$X,XXX - $X,XXX"
}`;

    let analysis: any = { risk_score: "Unknown", violations: [], summary: "Analysis unavailable" };
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const text = aiData?.choices?.[0]?.message?.content || "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) analysis = JSON.parse(match[0]);
      }
    } catch { /* use default */ }

    return new Response(JSON.stringify({ success: true, url: formatted, ...analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

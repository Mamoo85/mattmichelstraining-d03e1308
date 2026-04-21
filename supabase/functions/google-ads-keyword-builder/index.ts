// google-ads-keyword-builder — Claude Haiku generates keyword + ad copy for Matt to paste into Google Ads Editor
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade, city, state = "MI", business_name } = await req.json();
    if (!trade || !city) {
      return new Response(JSON.stringify({ error: "trade and city required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a Google Search Ads expert for local home-service contractors. Create a paste-ready ad campaign for:
- Trade: ${trade}
- City: ${city}, ${state}
- Business: ${business_name || "local contractor"}

Return STRICT JSON with:
{
  "keywords": [25 high-intent search keywords, exact + phrase match mix],
  "negative_keywords": [10 negatives like "free", "diy", "jobs"],
  "headlines": [15 headlines, max 30 chars each],
  "descriptions": [4 descriptions, max 90 chars each],
  "sitelinks": [4 sitelink labels with 25-char description]
}

Make keywords hyper-local and emergency-intent ("emergency ${trade.toLowerCase()} ${city.toLowerCase()}", "24 hour ${trade.toLowerCase()} near me"). NO generic broad-match. Headlines must include trade + city + urgency. Output ONLY the JSON object, no preamble.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const raw = aiData.content?.[0]?.text || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return new Response(JSON.stringify({ ok: true, trade, city, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[google-ads-keyword-builder] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

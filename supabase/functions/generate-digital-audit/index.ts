// generate-digital-audit — admin prospecting tool
// Input: contractor website URL
// Firecrawl scrapes homepage, Claude Haiku writes a cold SMS pitch identifying one weakness.
// Called from AdminSimulationSuite URL input.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { stealthScrape, reasonToCopy } from "../_shared/stealth-scrape.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const json500 = (msg: string) =>
    new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "url required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });

    if (!ANTHROPIC_API_KEY) return json500("AI engine not configured");

    // Tiered stealth fetch — sanitized errors
    const scraped = await stealthScrape(url, { maxChars: 6000 });
    if (!scraped.ok) {
      return new Response(JSON.stringify({ ok: false, message: reasonToCopy(scraped.reason) }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const pageText = scraped.markdown || "";
    if (!pageText) {
      return new Response(JSON.stringify({ ok: false, message: reasonToCopy("no_content") }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Claude Haiku generates cold SMS pitch
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `You are a web consultant analyzing a contractor's website to write a cold outreach SMS pitch.

Website content:
${pageText.slice(0, 3000)}

Write a personalized 2-3 sentence SMS pitch that:
1. Identifies ONE specific, concrete weakness (bad SEO rank for their city/trade, no online reviews shown, no mobile contact form, no call-to-action, missing service areas, outdated design)
2. States the business impact (losing jobs to competitors)
3. Offers a free audit or quick fix

Rules:
- Never use the word "AI"
- Sound like a real person, not a bot
- Keep it under 160 characters total if possible, or max 2 texts
- Casual and direct, like a local business owner talking to another

Return a JSON object:
{
  "pitch_sms": "the SMS text ready to send",
  "weakness_identified": "one sentence describing what specific weakness you found",
  "business_name": "extracted business name or null"
}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) return json500(`Claude error: ${claudeData?.error?.message}`);

    const rawText = claudeData.content?.[0]?.text || "";
    let parsed: Record<string, unknown> = { pitch_sms: rawText };
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* use raw */ }

    return new Response(JSON.stringify({ ok: true, ...parsed, raw_text: rawText }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

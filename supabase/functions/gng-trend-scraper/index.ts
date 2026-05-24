// Weekly scrape of Etsy trending-tags page via Firecrawl → gng_trend_signals.
// Feeds the tag refresher and listing writer with fresh keyword candidates.
// Cron: weekly Sun 14:00 UTC. Manual: POST {}.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Etsy doesn't publish a public trend feed; we scrape eRank-style public roll-ups and Etsy search pages.
const SOURCES = [
  "https://www.etsy.com/trending",
  "https://www.etsy.com/market/handmade_gifts",
  "https://www.etsy.com/market/personalized_gifts",
];

async function firecrawlMarkdown(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) throw new Error("firecrawl_key_missing");
  const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`firecrawl_${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j?.data?.markdown ?? "";
}

async function extractTags(corpus: string): Promise<string[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Extract 25 short (1-3 word, lowercase) trending Etsy product tags from the page. Return ONLY a JSON array of strings, no prose.",
        },
        { role: "user", content: corpus.slice(0, 12000) },
      ],
    }),
  });
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content ?? "[]";
  try {
    const m = txt.match(/\[[\s\S]*\]/);
    return m ? JSON.parse(m[0]).filter((t: any) => typeof t === "string").slice(0, 25) : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const allTags: Record<string, number> = {};
    const traces: any[] = [];

    for (const url of SOURCES) {
      try {
        const md = await firecrawlMarkdown(url);
        const tags = await extractTags(md);
        traces.push({ url, ok: true, tag_count: tags.length });
        for (const t of tags) {
          const k = t.trim().toLowerCase();
          if (k && k.length <= 30) allTags[k] = (allTags[k] ?? 0) + 1;
        }
      } catch (e) {
        traces.push({ url, ok: false, error: (e as Error).message });
      }
    }

    const ranked = Object.entries(allTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([tag, count]) => ({ tag, frequency: count, source: "etsy_scrape", captured_at: new Date().toISOString() }));

    if (ranked.length) await sb.from("gng_trend_signals").insert(ranked);

    return new Response(JSON.stringify({ ok: true, tags_captured: ranked.length, traces }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

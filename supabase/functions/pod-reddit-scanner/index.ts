// pod-reddit-scanner — Reddit Gift Subreddit Sentiment Scanner (#4)
// Cron: weekly Wednesday 8am UTC
//
// Scrapes r/giftideas, r/mug, r/Etsy for buyer demand signals using Reddit's free
// unauthenticated JSON API. Extracts emerging niches via GPT-4o-mini and inserts
// high-confidence ones into pod_niche_library with source='reddit'.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[REDDIT-SCANNER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

const SUBREDDITS = ["giftideas", "mug", "Etsy", "funny", "AskReddit"];

// Reddit's free JSON API — no auth required for public subreddit hot posts
async function fetchSubredditPosts(subreddit: string): Promise<string[]> {
  const res = await fetch(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=50`,
    {
      headers: { "User-Agent": "pod-niche-scanner/1.0" },
      signal: AbortSignal.timeout(12_000),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const posts: Array<{ data: { title: string; selftext?: string } }> = data?.data?.children ?? [];
  return posts
    .filter(p => p.data?.title)
    .map(p => p.data.title + (p.data.selftext ? " " + p.data.selftext.slice(0, 200) : ""))
    .slice(0, 30);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (!OPENAI_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY required" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Fetch posts from all target subreddits
  const allTexts: string[] = [];
  const fetchErrors: string[] = [];

  for (const sub of SUBREDDITS) {
    try {
      const posts = await fetchSubredditPosts(sub);
      allTexts.push(...posts);
      log("Fetched subreddit", { sub, posts: posts.length });
    } catch (err) {
      fetchErrors.push(`r/${sub}: ${String(err).slice(0, 60)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (allTexts.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "No Reddit posts fetched", fetchErrors }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Filter to gift-relevant posts before sending to AI
  const giftKeywords = /gift|mug|shirt|hoodie|etsy|buy|looking for|recommend|idea|present|birthday|christmas|mother.?s day|father.?s day|nurse|teacher|dog|cat|funny/i;
  const relevant = allTexts.filter(t => giftKeywords.test(t)).slice(0, 60);

  log("Relevant posts", { count: relevant.length, total: allTexts.length });

  // AI-extract emerging POD niches from post content
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `You analyze Reddit posts to find emerging gift product niches for Etsy print-on-demand sellers.

Reddit posts (${relevant.length} posts from r/giftideas, r/mug, r/Etsy, r/funny):
${relevant.slice(0, 40).map((t, i) => `${i + 1}. ${t.slice(0, 150)}`).join("\n")}

Extract up to 12 specific POD gift niches where buyers are actively seeking products.
Focus on: specific professions, hobbies, relationships (dog mom, nurse, teacher), or trending humor.
Each niche must be a specific Etsy-style search query (e.g. "funny nurse mug gift for women").

Rate each niche:
- sentiment_score 1-10 (10 = buyers actively searching and spending)
- urgency: "seasonal" (trending for a specific time) or "evergreen" (always relevant)

Return JSON: { "niches": [ { "niche": "...", "sentiment_score": 8, "urgency": "evergreen" }, ... ] }
Return ONLY the JSON.`,
      }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  let extractedNiches: Array<{ niche: string; sentiment_score: number; urgency: string }> = [];
  if (aiRes.ok) {
    const aiData = await aiRes.json();
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content ?? "{}");
    extractedNiches = Array.isArray(parsed.niches) ? parsed.niches : [];
  }

  log("Niches extracted", { count: extractedNiches.length });

  // Insert high-confidence niches (score >= 7) into niche library
  let added = 0;
  const addedNiches: string[] = [];

  for (const item of extractedNiches) {
    if ((item.sentiment_score ?? 0) >= 7 && item.niche) {
      const niche = item.niche.toLowerCase().trim();
      const { error } = await sb.from("pod_niche_library").upsert({
        niche,
        source: "reddit",
        active: true,
        // Reddit-sourced niches get a +20 bonus via higher initial weighted_score_avg
        weighted_score_avg: item.sentiment_score * 10,
      }, { onConflict: "niche", ignoreDuplicates: false });

      if (!error) {
        added++;
        addedNiches.push(niche);
        log("Added reddit niche", { niche, score: item.sentiment_score, urgency: item.urgency });
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    subredditsScanned: SUBREDDITS.length,
    postsAnalyzed: relevant.length,
    nichesExtracted: extractedNiches.length,
    nichesAdded: added,
    addedNiches,
    fetchErrors,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});

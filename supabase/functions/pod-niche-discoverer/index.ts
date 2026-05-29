// pod-niche-discoverer — Dynamic Niche Library with AI Self-Expansion (#1)
// Cron: weekly Monday 8am UTC (before etsy-trend-scanner at 9am)
//
// Analyzes top-performing niches from etsy_pod_trends, uses GPT-4o-mini to generate
// 5 adjacent niches per top performer, validates them against Etsy API (real demand),
// and upserts high-signal ones into pod_niche_library.
// Deactivates chronic underperformers to keep the library fresh and accurate.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[NICHE-DISCOVERER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY");
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (!ETSY_API_KEY || !OPENAI_KEY) {
    return new Response(JSON.stringify({ error: "ETSY_API_KEY and OPENAI_API_KEY required" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Step 1: Find top 10 performing niches from etsy_pod_trends (last 30 days)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: trendData } = await sb
    .from("etsy_pod_trends")
    .select("niche, num_favorers, competitor_count")
    .gte("created_at", since)
    .not("competitor_count", "is", null)
    .gt("competitor_count", 0);

  // Group by niche and compute weighted score
  const nicheScores: Record<string, { totalScore: number; count: number }> = {};
  for (const row of (trendData ?? [])) {
    const score = (row.num_favorers ?? 0) / Math.sqrt(Math.max(1, row.competitor_count ?? 1));
    if (!nicheScores[row.niche]) nicheScores[row.niche] = { totalScore: 0, count: 0 };
    nicheScores[row.niche].totalScore += score;
    nicheScores[row.niche].count++;
  }

  const topNiches = Object.entries(nicheScores)
    .map(([niche, { totalScore, count }]) => ({ niche, avgScore: totalScore / count }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10)
    .map(n => n.niche);

  log("Top niches", topNiches);

  if (topNiches.length === 0) {
    return new Response(JSON.stringify({ success: true, message: "No trend data — skipping expansion", added: 0 }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Step 2: AI-generate 5 adjacent niches per top niche
  const nicheListStr = topNiches.map((n, i) => `${i + 1}. "${n}"`).join("\n");

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `You are an Etsy POD product expert. For each of the following top-performing Etsy niches,
generate exactly 5 adjacent/related niches that would also sell well as print-on-demand gifts.

Top niches:
${nicheListStr}

Rules:
- Stay in the POD gift space (mugs, shirts, hoodies, tumblers, etc.)
- Make niches specific (e.g. "funny nurse retirement mug" not just "nurse mug")
- Each niche should be searchable as a buyer's actual Etsy search query
- Avoid duplicating the original niches
- Mix product types (mugs, shirts, tumblers) naturally

Return JSON: { "candidates": ["niche 1", "niche 2", ...] }
Return a flat array of all generated niches (5 per original × ${topNiches.length} niches = ${topNiches.length * 5} total).
Return ONLY the JSON.`,
      }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  let candidates: string[] = [];
  if (aiRes.ok) {
    const aiData = await aiRes.json();
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content ?? "{}");
    candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  }

  log("AI candidates generated", { count: candidates.length });

  // Step 3: Validate each candidate via Etsy API
  let added = 0;
  let skipped = 0;
  const validated: string[] = [];

  for (const niche of candidates.slice(0, 40)) { // cap at 40 to stay within API limits
    try {
      const url = new URL("https://openapi.etsy.com/v3/application/listings/active");
      url.searchParams.set("keywords", niche);
      url.searchParams.set("sort_on", "score");
      url.searchParams.set("limit", "5");

      const res = await fetch(url.toString(), {
        headers: { "x-api-key": ETSY_API_KEY },
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) { skipped++; continue; }

      const data = await res.json();
      const competitorCount: number = data.count ?? 0;
      const topListing = data.results?.[0];
      const topFavorers: number = topListing?.num_favorers ?? 0;

      // Quality gate: must have real buyer interest and not be impossibly saturated
      if (topFavorers >= 50 && competitorCount < 100_000) {
        const { error } = await sb.from("pod_niche_library").upsert({
          niche: niche.toLowerCase().trim(),
          source: "ai_expansion",
          active: true,
          weighted_score_avg: topFavorers / Math.sqrt(Math.max(1, competitorCount)),
        }, { onConflict: "niche", ignoreDuplicates: false });

        if (!error) {
          added++;
          validated.push(niche);
          log("Validated + added", { niche, favorers: topFavorers, competitors: competitorCount });
        }
      } else {
        skipped++;
        log("Failed validation", { niche, favorers: topFavorers, competitors: competitorCount });
      }

      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      log("Validation error", { niche, error: String(err).slice(0, 80) });
      skipped++;
    }
  }

  // Step 4: Update weighted_score_avg for existing niches based on recent scan performance
  const { data: existingNiches } = await sb
    .from("pod_niche_library")
    .select("niche, total_scans")
    .eq("active", true)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(50);

  // Deactivate niches with very low recent performance (pruning)
  let deactivated = 0;
  for (const n of (existingNiches ?? [])) {
    if ((n.total_scans ?? 0) > 10) {
      const nicheScore = nicheScores[n.niche];
      if (nicheScore && nicheScore.avgScore < 1) {
        await sb.from("pod_niche_library")
          .update({ active: false })
          .eq("niche", n.niche);
        deactivated++;
        log("Deactivated low-performing niche", { niche: n.niche });
      }
    }
  }

  // Update last run timestamp
  await sb.from("pod_agent_state").upsert({
    key: "niche_library_last_expanded",
    value: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });

  return new Response(JSON.stringify({
    success: true,
    topNichesAnalyzed: topNiches.length,
    candidatesGenerated: candidates.length,
    validated: added,
    skipped,
    deactivated,
    newNiches: validated,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});

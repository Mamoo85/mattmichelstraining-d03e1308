// Daily Etsy trend scanner — picks a trending niche and publishes 5 POD products
// Scheduled daily at 13:00 UTC (9am ET) via pg_cron job `etsy-trend-scanner-daily`

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRINTIFY_FN_URL = "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/printify-product-creator";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Niches already saturated in the store — never duplicate
const EXCLUDED_NICHES = [
  "fathers day", "father's day", "dad gift", "dad mug", "dad shirt", "dad tee",
  "graduation", "graduate", "grad 2026",
];

const PRICES: Record<string, number> = { mug: 1399, tshirt: 1799, hoodie: 3299, tote: 1599 };

interface ProductSpec {
  name: string;
  type: "mug" | "tshirt" | "hoodie" | "tote";
  imagePrompt: string;
  description: string;
  tags: string[];
  retailPrice: number;
}

interface NichePlan {
  niche: string;
  rationale: string;
  trend_signals: string[];
  products: ProductSpec[];
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${text.slice(0, 500)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function buildSystemPrompt(): string {
  return `You are an autonomous Etsy POD store strategist. Your job: identify ONE niche that is trending on Etsy RIGHT NOW based on the current calendar date, viral culture moments, upcoming holidays (within next 30-60 days), seasonal patterns, and persistent high-volume hobby/occupational communities. Then design 5 distinct POD products in that niche.

Output rules:
- Pick niches with PROVEN Etsy buyer intent: upcoming holidays (4th of July, Halloween, back-to-school, fall season, Thanksgiving, Christmas if within 90 days), pet owners (dog mom/cat mom), nurses/teachers/trades, hobbies (pickleball, sourdough, gardening, fishing, crochet, plant parents), life milestones (new baby, retirement, wedding, anniversaries), occupational pride, viral memes that have staying power.
- Avoid generic "self care" / "good vibes" filler — pick something specific with a defined buyer.
- NEVER pick: Father's Day, graduation, dad gifts (already in store).
- Vary the 5 products: mix mug + tshirt + hoodie + tote so we don't over-commit one format. Each product targets a different sub-angle of the niche.

Image prompt rules (MANDATORY for every product):
- ALWAYS pure solid white #FFFFFF background, no gradients, no cream, no shadows.
- MUGS: design occupies NO MORE than 50% of image width, 35% white space on left AND right sides, 20% top/bottom.
- SHIRTS/HOODIES/TOTES: centered with 15% white padding on all sides.
- Specify typography style (e.g. "chunky condensed sans-serif athletic block letters", "playful hand-lettered script", "vintage varsity serif"), exact hex color palette (2-4 colors max), and icon/illustration layout.
- No brand names, no copyrighted characters (no Disney, sports teams, etc.), no real people.
- Bold, high-contrast, print-ready flat vector style.

Prices in cents (use exactly): mug=1399, tshirt=1799, hoodie=3299, tote=1599.

Return STRICT JSON only, no prose, matching this schema:
{
  "niche": "short niche name",
  "rationale": "2-3 sentences on WHY this is trending NOW (cite the calendar timing, cultural moment, or proven evergreen buyer demand)",
  "trend_signals": ["signal 1", "signal 2", "signal 3"],
  "products": [
    {
      "name": "Product Title – Subtitle",
      "type": "mug" | "tshirt" | "hoodie" | "tote",
      "imagePrompt": "full DALL-E prompt following the rules above",
      "description": "2-3 sentence Etsy listing copy",
      "tags": ["tag1","tag2","tag3","tag4","tag5","tag6"],
      "retailPrice": 1399
    }
    // ...exactly 5 products
  ]
}`;
}

function buildUserPrompt(recentNiches: string[]): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const recent = recentNiches.length ? recentNiches.join(", ") : "(none yet)";
  const excluded = EXCLUDED_NICHES.join(", ");

  return `Today is ${dateStr}.

Niches already used in the last 30 days (DO NOT REPEAT): ${recent}
Permanently excluded niches (already saturated): ${excluded}

Pick a NEW trending niche relevant to this exact date (upcoming holiday within 60 days, seasonal moment, current viral trend, or evergreen high-volume hobby community). Then return 5 product specs as strict JSON per the system schema.`;
}

async function publishProduct(product: ProductSpec): Promise<{ status: string; printifyId?: string; error?: string }> {
  try {
    const resp = await fetch(PRINTIFY_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
    });
    const text = await resp.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* not JSON */ }

    if (!resp.ok) {
      return { status: "failed", error: `HTTP ${resp.status}: ${text.slice(0, 300)}` };
    }
    const result = body?.results?.[0];
    if (result?.status === "success" && result?.printifyId) {
      return { status: "success", printifyId: result.printifyId };
    }
    return { status: "failed", error: result?.error || `Unexpected response: ${text.slice(0, 300)}` };
  } catch (e: any) {
    return { status: "failed", error: e?.message || String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let runId: string | null = null;

  try {
    // 1. Load recent niches (last 30 days) to avoid duplication
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: recentRuns } = await sb
      .from("etsy_trend_runs")
      .select("niche")
      .gte("run_date", since)
      .order("run_date", { ascending: false });
    const recentNiches = (recentRuns ?? []).map((r: any) => r.niche);

    // 2. Create pending run row
    const { data: runRow, error: insErr } = await sb
      .from("etsy_trend_runs")
      .insert({ niche: "(pending)", status: "pending" })
      .select("id")
      .single();
    if (insErr) throw new Error(`run insert failed: ${insErr.message}`);
    runId = runRow.id;

    // 3. Ask AI for niche + 5 product specs
    const raw = await callAI(buildSystemPrompt(), buildUserPrompt(recentNiches));
    let plan: NichePlan;
    try {
      plan = JSON.parse(raw);
    } catch {
      throw new Error(`AI returned non-JSON: ${raw.slice(0, 500)}`);
    }
    if (!plan.niche || !Array.isArray(plan.products) || plan.products.length === 0) {
      throw new Error(`AI returned malformed plan: ${JSON.stringify(plan).slice(0, 500)}`);
    }

    // Normalize prices and clamp to 5 products
    const products = plan.products.slice(0, 5).map((p) => ({
      ...p,
      retailPrice: PRICES[p.type] ?? p.retailPrice ?? 1399,
    }));

    await sb.from("etsy_trend_runs").update({
      niche: plan.niche,
      niche_rationale: plan.rationale,
      trend_signals: plan.trend_signals ?? [],
      products_planned: products,
      status: "publishing",
    }).eq("id", runId);

    // 4. Publish each product sequentially (Printify rate-friendly)
    const published: any[] = [];
    const failed: any[] = [];
    for (const product of products) {
      const result = await publishProduct(product);
      if (result.status === "success") {
        published.push({ name: product.name, type: product.type, printifyId: result.printifyId });
      } else {
        failed.push({ name: product.name, type: product.type, error: result.error });
      }
    }

    // 5. Finalize run row
    await sb.from("etsy_trend_runs").update({
      products_published: published,
      products_failed: failed,
      success_count: published.length,
      failure_count: failed.length,
      status: failed.length === 0 ? "completed" : (published.length === 0 ? "failed" : "partial"),
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(JSON.stringify({
      runId,
      niche: plan.niche,
      rationale: plan.rationale,
      published_count: published.length,
      failed_count: failed.length,
      published,
      failed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (runId) {
      await sb.from("etsy_trend_runs").update({
        status: "failed",
        error: msg,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

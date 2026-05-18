// Daily Etsy trend scanner — picks a trending niche and publishes N POD products.
// Scheduled daily at 13:00 UTC via pg_cron `etsy-trend-scanner-daily`.
//
// Body (all optional): { forced_niche?, count?, intent?, reason? }
//   - forced_niche overrides AI selection (used by winner prioritizer)
//   - count = number of products to generate (default 5, max 10)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeTags, padTagsTo13, clampTitle } from "../_shared/pod-seo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORCHESTRATOR_URL = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/pod-product-orchestrator`;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXCLUDED_NICHES = [
  "fathers day", "father's day", "dad gift", "dad mug", "dad shirt", "dad tee",
  "graduation", "graduate", "grad 2026",
];

const PRICES: Record<string, number> = { mug: 1399, tshirt: 1799, hoodie: 3299, tote: 1599 };

interface ProductSpec {
  name: string;
  type: "mug" | "tshirt" | "hoodie" | "tote";
  imagePrompt: string;
  title: string;
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
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`AI gateway ${resp.status}: ${(await resp.text()).slice(0, 500)}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function buildSystemPrompt(count: number, forcedNiche?: string): string {
  const nicheRule = forcedNiche
    ? `- The niche is FORCED to "${forcedNiche}" — use it exactly, do not substitute, do not refuse.`
    : `- Pick niches with PROVEN Etsy buyer intent (upcoming holiday <60d, pet owners, nurses/teachers/trades, hobbies, occupational pride, viral memes with staying power).
- NEVER pick: Father's Day, graduation, dad gifts.`;
  return `You are an autonomous Etsy POD store strategist. Pick ONE trending niche, then design exactly ${count} distinct POD products in it, each optimized for Etsy search.

Niche rules:
${nicheRule}
- Vary products across mug/tshirt/hoodie/tote so format risk is spread.

Image prompt rules (MANDATORY each product — read carefully, these prevent white boxes on dark garments):
- SHIRTS / HOODIES / TOTES: design MUST be on a fully TRANSPARENT background (alpha=0, no color fill of any kind). Begin the imagePrompt with the exact phrase: "Isolated print-ready graphic on a 100% transparent background, no background rectangle, no white box, no canvas fill —". The artwork itself (text, illustration, badge) should fill ~75–85% of the canvas (no tiny floating design in the middle). Padding lives in the canvas alpha, NOT a white rectangle.
- MUGS: design on pure solid white #FFFFFF background (mug print area is white). CRITICAL: ALL artwork (text + illustration) MUST fit inside the CENTER 30% of the canvas — roughly the middle third horizontally and vertically. The outer 70% must be empty white space. This is non-negotiable: anything outside the center 30% wraps around the mug cylinder and is cut off. Keep designs simple, compact, and centered — short text (max 3 short lines), small icon. Do NOT fill the canvas.
- All artwork: high-contrast, bold, flat vector style, clean edges, no drop shadows, no gradients, no photographic textures, no faces, no watermarks, no mockup garments — just the standalone print graphic.
- Specify typography (e.g. "chunky condensed sans-serif athletic block letters"), 2–4 hex colors that pop on BOTH black and white garments (avoid pure black ink for apparel — use bone white / cream / a single accent color), and layout.
- No brand names, no copyrighted characters, no real people.

Etsy SEO rules (MANDATORY each product):
- title: ≤140 chars, front-load 2–3 high-intent keywords, include product type, gift angle. No emojis. Example: "Funny Pickleball Mug Dink Responsibly Coffee Cup Gift For Pickleball Player Coach Birthday Christmas".
- tags: EXACTLY 13 tags. Each ≤20 chars, lowercase, multi-word phrases preferred ("pickleball gift", "dink mug"), no special chars, no duplicates, no single-word generics like "gift" alone. Mix: 3 niche+product, 3 gift angle, 3 audience, 2 occasion, 2 long-tail.
- description: 4–6 sentences. Hook line first. Bullet-free flowing prose. End with care/shipping note. Keyword-rich but reads natural.

Prices in cents (use exactly): mug=1399, tshirt=1799, hoodie=3299, tote=1599.

Return STRICT JSON only:
{
  "niche": "short niche name",
  "rationale": "2-3 sentences on WHY trending NOW",
  "trend_signals": ["signal 1","signal 2","signal 3"],
  "products": [
    {
      "name": "Internal Name – Subtitle",
      "type": "mug" | "tshirt" | "hoodie" | "tote",
      "imagePrompt": "full DALL-E prompt per rules",
      "title": "SEO Etsy title ≤140 chars",
      "description": "4-6 sentence Etsy listing copy",
      "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],
      "retailPrice": 1399
    }
  ]
}`;
}

function buildUserPrompt(opts: {
  recentNiches: string[];
  recentTitles: string[];
  count: number;
  forcedNiche?: string;
  intent?: string;
}): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const recent = opts.recentNiches.length ? opts.recentNiches.join(", ") : "(none yet)";
  const titles = opts.recentTitles.length ? opts.recentTitles.slice(0, 30).join(" | ") : "(none yet)";

  let nicheBlock: string;
  if (opts.forcedNiche) {
    const isFathersDay = /father|dad/i.test(opts.forcedNiche);
    const fdAngles = isFathersDay
      ? `\n\nFATHER'S DAY FRESH-ANGLE MANDATE: The "dad" angle is OVERSATURATED in our store (35+ live dad listings). DO NOT create generic Dad / Father / Daddy products. Instead pick from these UNDERSERVED audiences and rotate so 10 products cover at least 6 different audiences:\n  - Step Dad / Bonus Dad\n  - Grandpa / Pawpaw / Papa / Grandfather (first-time grandpa angle is hot)\n  - Uncle / Funcle\n  - Father-in-Law / Bonus Father-in-Law\n  - Military Dad / Veteran Dad\n  - Hockey Dad / Soccer Dad / Basketball Dad / Baseball Dad (sport-specific, NOT generic "sports dad")\n  - DIY / Handyman / Tool Dad\n  - Tech / IT / Engineer Dad\n  - Trucker Dad / Mechanic Dad / Firefighter Dad / Police Dad\n  - First-Time Dad (pregnancy reveal angle)\n  - Dog Dad of a SPECIFIC breed (German Shepherd Dad, Golden Retriever Dad, etc.) — generic "Dog Dad" is taken\nForbidden concepts (already live, DO NOT make variants): Dad Jokes, Reel Cool Dad, Man Myth Legend, Grill Master/Grill Sergeant/Grillin Chillin, World's Okayest Dad, New Dad Survival Kit, Lawnfather, Dad Bod, I Paused My Game, Hi Hungry I'm Dad, Tired Dads Club, Dad Est 2026, Ain't No Hood Like Fatherhood, Girl Dad, Periodic Table Dad Jokes, Resting My Eyes, BBQ Dad, Fishing Dad (generic), Golf Dad, Dog Dad Coffee, First Father's Day Mug.`
      : "";
    nicheBlock = `FORCED NICHE: "${opts.forcedNiche}". Intent: ${opts.intent || "fresh variants"}.
Generate ${opts.count} NEW products inside this niche that do NOT duplicate any of the existing titles below.
Use fresh angles: different inside jokes, different audience sub-segments (beginner vs pro, mom vs dad, coach vs player), different formats (mug/tee/hoodie/tote), different visual styles.${fdAngles}`;
  } else {
    nicheBlock = `Pick a NEW trending niche relevant to ${today} (upcoming holiday <60d, seasonal moment, viral trend, or evergreen high-volume hobby community).
Recently used niches (DO NOT REPEAT): ${recent}
Excluded niches: ${EXCLUDED_NICHES.join(", ")}`;
  }

  return `${nicheBlock}

EXISTING TITLES IN STORE (do not duplicate, vary angles):
${titles}

Return ${opts.count} product specs as strict JSON per the system schema.`;
}

async function publishViaOrchestrator(product: ProductSpec, niche: string, runId: string, allowExcludedHoliday: boolean) {
  // Mugs print on a white ceramic surface — solid white bg is fine and avoids alpha-edge artifacts.
  // Everything else (tees, hoodies, totes) prints on dark/colored fabric — MUST be transparent PNG
  // or you get the visible white rectangle around the design seen in shop screenshots.
  const transparentBackground = product.type !== "mug";
  const enrichedProduct = {
    ...product,
    transparentBackground,
    // Hints the image generator can act on; harmless if ignored.
    imageOptions: {
      transparent_background: transparentBackground,
      format: "png",
      // Fill more of the print area so the artwork doesn't look like a small sticker.
      fill_ratio: transparentBackground ? 0.82 : 0.55,
    },
  };
  const resp = await fetch(ORCHESTRATOR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      product: enrichedProduct, niche, run_id: runId, source: "trend_scanner",
      allow_excluded_holiday: allowExcludedHoliday,
    }),
  });
  const text = await resp.text();
  try { return { http: resp.status, ...JSON.parse(text) }; }
  catch { return { http: resp.status, raw: text.slice(0, 400) }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body ok */ }
  const forcedNiche: string | undefined = body?.forced_niche;
  const intent: string | undefined = body?.intent;
  const count: number = Math.min(10, Math.max(1, body?.count ?? 5));

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let runId: string | null = null;

  try {
    // Recent niche + title context (last 60 days for dedupe)
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [{ data: recentRuns }, { data: recentListings }] = await Promise.all([
      sb.from("etsy_trend_runs").select("niche").gte("run_date", since).order("run_date", { ascending: false }),
      sb.from("pod_listings")
        .select("title, product_name, niche")
        .gte("published_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .order("published_at", { ascending: false })
        .limit(200),
    ]);
    const recentNiches = (recentRuns ?? []).map((r: any) => r.niche).filter((n: string) => n && n !== "(pending)");
    const recentTitlesAll = (recentListings ?? []).map((l: any) => l.title || l.product_name).filter(Boolean);
    const recentTitlesInNiche = forcedNiche
      ? (recentListings ?? []).filter((l: any) => l.niche === forcedNiche).map((l: any) => l.title || l.product_name)
      : recentTitlesAll;

    const { data: runRow, error: insErr } = await sb
      .from("etsy_trend_runs")
      .insert({ niche: forcedNiche || "(pending)", status: "pending" })
      .select("id")
      .single();
    if (insErr) throw new Error(`run insert: ${insErr.message}`);
    runId = runRow.id;

    const raw = await callAI(
      buildSystemPrompt(count, forcedNiche),
      buildUserPrompt({ recentNiches, recentTitles: recentTitlesInNiche, count, forcedNiche, intent }),
    );
    let plan: NichePlan;
    try { plan = JSON.parse(raw); } catch { throw new Error(`AI returned non-JSON: ${raw.slice(0, 400)}`); }
    if (!plan.niche || !Array.isArray(plan.products) || plan.products.length === 0) {
      throw new Error(`malformed plan: ${JSON.stringify(plan).slice(0, 400)}`);
    }

    // Normalize each product: title clamp + 13 tags + price coercion
    const products = plan.products.slice(0, count).map((p) => {
      const tags = padTagsTo13(normalizeTags(p.tags || []), plan.niche, p.type);
      return {
        ...p,
        title: clampTitle(p.title || p.name),
        tags,
        retailPrice: PRICES[p.type] ?? p.retailPrice ?? 1399,
      };
    });

    await sb.from("etsy_trend_runs").update({
      niche: plan.niche,
      niche_rationale: plan.rationale,
      trend_signals: plan.trend_signals ?? [],
      products_planned: products,
      status: "publishing",
    }).eq("id", runId);

    // Run publishes in background — 10 products easily exceed the 150s edge timeout.
    // Response returns immediately with the plan; caller polls etsy_trend_runs for completion.
    const allowExcludedHoliday = !!forcedNiche; // forced niches override the EXCLUDED list
    const runPublishes = async () => {
      const published: any[] = [];
      const failed: any[] = [];
      const skipped: any[] = [];
      for (const product of products) {
        const r = await publishViaOrchestrator(product, plan.niche, runId!, allowExcludedHoliday);
        if (r?.ok && r?.printifyId) {
          published.push({ name: product.name, type: product.type, printifyId: r.printifyId, attempts: r.attempts });
        } else if (r?.skipped) {
          skipped.push({ name: product.name, reason: r.reason });
        } else {
          failed.push({ name: product.name, type: product.type, attempts: r?.attempts, error: r?.error || r?.raw });
        }
      }
      const status = failed.length === 0
        ? (published.length === 0 ? "skipped_all_duplicates" : "completed")
        : (published.length === 0 ? "failed" : "partial");
      await sb.from("etsy_trend_runs").update({
        products_published: published,
        products_failed: failed,
        success_count: published.length,
        failure_count: failed.length,
        status,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
    };
    // @ts-ignore — EdgeRuntime is injected by Supabase Edge runtime
    EdgeRuntime.waitUntil(runPublishes());

    return new Response(JSON.stringify({
      runId, niche: plan.niche, rationale: plan.rationale,
      planned_count: products.length,
      note: "Publishing in background — poll etsy_trend_runs.status (completed | partial | failed) for results.",
      products_planned: products.map(p => ({ name: p.name, type: p.type })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (runId) {
      await sb.from("etsy_trend_runs").update({
        status: "failed", error: msg, completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});

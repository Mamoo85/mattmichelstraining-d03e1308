// pod-new-products v4 — trend-driven daily product creation with niche performance weighting
// Cron: 0 9-13 * * * (runs at 9, 10, 11, 12, 1pm UTC — 5 products/day)
//
// Flow per run:
//   1. First run of the day (9am): query yesterday's top Etsy trends → AI-generate 5
//      products across varied types → insert into pod_product_queue
//   2. Every run: pull next pending item from queue → create via printify-product-creator
//
// Product types chosen by favorer count from etsy_pod_trends, with a cap of
// 2 per type per day so you always get variety across mug/tshirt/hoodie/sock/hat/mousepad.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { validateListing } from "../_shared/listing-validator.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProductType = "mug" | "tshirt" | "hoodie" | "sock" | "hat" | "mousepad" | "onesie" | "tumbler" | "blanket" | "sweatshirt" | "longsleeve" | "travelmug" | "digital" | "sticker" | "poster_v" | "poster_h" | "ornament" | "journal" | "tumbler40" | "wineglass" | "pintglass" | "candle" | "pillow" | "puzzle" | "petbandana" | "coaster" | "greetingcard" | "shotglass" | "phonecase_slim" | "phonecase_tough" | "truckercap" | "laptopsleeve";

// Kept competitive/cheaper to drive first sales before reviews — raise once 5+ reviews in
const FINAL_PRICES: Record<ProductType, number> = {
  mug: 1899, tshirt: 2299, hoodie: 3899, sock: 1899, hat: 2799, mousepad: 1999, onesie: 1899,
  tumbler: 3499, blanket: 5499, sweatshirt: 3999, longsleeve: 2999, travelmug: 2999,
  sticker: 599, poster_v: 1999, poster_h: 1999, ornament: 1599, journal: 2199,
  tumbler40: 4999, wineglass: 2199, pintglass: 1899, candle: 2699, pillow: 3499,
  puzzle: 3999, petbandana: 2499, coaster: 1999, greetingcard: 1499, shotglass: 1499,
  phonecase_slim: 2499, phonecase_tough: 2799, truckercap: 3299, laptopsleeve: 2999,
};

const SUB_NICHE_MAP: Record<string, string[]> = {
  "dog mom": ["golden retriever mom","labrador mom","french bulldog mom","dachshund mom","beagle mom","german shepherd mom","rescue dog mom","corgi mom","poodle mom","husky mom"],
  "nurse": ["ER nurse","ICU nurse","NICU nurse","pediatric nurse","school nurse","travel nurse","surgical nurse","labor and delivery nurse","oncology nurse","nursing student"],
  "teacher": ["kindergarten teacher","first grade teacher","preschool teacher","art teacher","PE teacher","music teacher","science teacher","special education teacher","substitute teacher","new teacher"],
  "cat mom": ["black cat mom","orange cat mom","tabby cat mom","maine coon mom","siamese cat mom","rescue cat mom","crazy cat lady","cat grandma","cat dad","multiple cats mom"],
  "retirement": ["teacher retirement","nurse retirement","police retirement","military retirement","firefighter retirement","early retirement","forced retirement humor","retirement 2025","retirement party","grandpa retirement"],
  "grandma": ["nana gifts","granny gifts","grandma birthday","grandma christmas","new grandma gift","grandma to be","first time grandma","funny grandma","sassy grandma","grandma from grandkids"],
  "grandpa": ["papa gifts","grandfather gifts","grandpa birthday","grandpa christmas","new grandpa gift","funny grandpa","fishing grandpa","golfing grandpa","grumpy grandpa","grandpa retirement"],
  "wife": ["wife birthday gift","wife christmas gift","wife anniversary gift","wife mothers day","best wife ever","funny wife gift","wife coffee lover","wife wine lover","wife from husband","new wife gift"],
  "sister": ["sister birthday gift","big sister gift","little sister gift","sister christmas","funny sister gift","best sister ever","soul sister gift","twin sister","sister wine lover","sister from sister"],
  "best friend": ["best friend birthday","bestie gift","friendship gift","best friend christmas","long distance friend","best friend forever","girl best friend","best friend coffee","moving away gift","bff gift"],
  "mom": ["mom birthday gift","funny mom gift","new mom gift","mom christmas gift","best mom ever","tired mom gift","mom coffee lover","mom wine lover","mom from daughter","cool mom gift"],
  "aunt": ["aunt birthday gift","funny aunt gift","best aunt ever","auntie gift","aunt christmas","aunt from niece","aunt to be gift","aunt wine lover","favorite aunt gift","cool aunt gift"],
  "firefighter": ["female firefighter gift","firefighter wife gift","firefighter retirement","firefighter birthday","volunteer firefighter","fire captain gift","firefighter christmas","firefighter husband","firefighter dad","fire station gift"],
  "graduation": ["class of 2026 gift","nursing school grad","college graduation","high school graduation","medical school grad","first gen college grad","graduation party","graduation 2026","grad school gift","new graduate gift"],
  "military": ["army veteran gift","navy veteran gift","marine corps gift","military spouse gift","military retirement","military mom gift","veteran birthday","proud military family","air force gift","military dad gift"],
  "horse": ["horse mom","equestrian girl","barrel racer","horse show mom","trail riding girl","western horse lover","rodeo girl","horse dad","horse crazy girl","horse therapy lover"],
  "wedding": ["bride gift","maid of honor gift","bridesmaid gift","future mrs gift","bachelorette gift","wedding shower gift","just married gift","bride tribe gift","bridal party gift","newlywed gift"],
  "baby shower": ["new mom gift","mom to be gift","first time mom gift","twin mom gift","boy mom gift","girl mom gift","mama bear gift","new baby gift","pregnancy gift","expecting mom gift"],
};

function applySubNiche(niche: string): string {
  const key = Object.keys(SUB_NICHE_MAP).find(k => niche.toLowerCase().includes(k));
  if (!key) return niche;
  if (Math.random() > 0.70) return niche;
  const subs = SUB_NICHE_MAP[key];
  return subs[Math.floor(Math.random() * subs.length)];
}

const log = (msg: string, data?: unknown) =>
  console.log(`[POD-NEW-PRODUCTS] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

// Keyword-based product type detection from a niche string
function typeFromNicheKeywords(niche: string): ProductType | null {
  const n = niche.toLowerCase();
  if (/\btumbler\b|20oz|stanley|water bottle|insulated cup/.test(n)) return "tumbler";
  if (/\bblanket\b|\bsherpa\b|\bthrow\b/.test(n)) return "blanket";
  if (/\bsweatshirt\b|\bcrewneck\b/.test(n)) return "sweatshirt";
  if (/long sleeve|longsleeve/.test(n)) return "longsleeve";
  if (/travel mug|travelmug/.test(n)) return "travelmug";
  if (/\bmug\b|coffee mug|coffee cup/.test(n)) return "mug";
  if (/\bhoodie\b|\bpullover\b/.test(n)) return "hoodie";
  if (/\bsock\b|\bsocks\b/.test(n)) return "sock";
  if (/\bhat\b|\bcap\b/.test(n)) return "hat";
  if (/mousepad|mouse pad/.test(n)) return "mousepad";
  if (/\bonesie\b|\bbaby\b|\binfant\b|\bbodysuit\b/.test(n)) return "onesie";
  if (/\bshirt\b|\btee\b|\bt-shirt\b|\btshirt\b/.test(n)) return "tshirt";
  return null;
}

// When niche has no clear product keyword, pick type weighted by sales velocity (#2)
// velocityMap: {type → units_per_day}. Types with higher velocity / (existing count + 1) get priority.
function typeByVariety(
  typeCounts: Partial<Record<ProductType, number>>,
  velocityMap: Partial<Record<ProductType, number>> = {},
): ProductType {
  const types: ProductType[] = ["mug", "tshirt", "hoodie", "tumbler", "sock", "sweatshirt", "hat", "mousepad", "blanket", "onesie", "longsleeve", "travelmug", "sticker", "poster_v", "poster_h", "ornament", "journal", "tumbler40", "wineglass", "pintglass", "candle", "pillow", "puzzle", "petbandana", "coaster", "greetingcard", "shotglass", "phonecase_slim", "phonecase_tough", "truckercap", "laptopsleeve"];
  // Score = velocity / (count + 1) — types with zero count and high velocity win
  const scored = types
    .filter((t) => (typeCounts[t] ?? 0) < 2)
    .map((t) => ({ t, score: (velocityMap[t] ?? 0.1) / ((typeCounts[t] ?? 0) + 1) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.t ?? "tshirt";
}

// Compute dynamic price: target p65 (between median and p75), floor at FINAL_PRICES, cap at p75
function dynamicPrice(
  type: ProductType,
  marketPrices: Partial<Record<ProductType, { median_cents: number; p75_cents: number }>>,
): number {
  const market = marketPrices[type];
  if (!market) return FINAL_PRICES[type];
  const target = Math.round(market.median_cents + (market.p75_cents - market.median_cents) * 0.4);
  return Math.max(FINAL_PRICES[type], Math.min(market.p75_cents, target));
}

// Fuzzy-match a trend niche against niche_performance rows.
// Returns the sales multiplier: 1 + (sales_30d * 0.5), capped at 5.
function getNicheMultiplier(
  trendNiche: string,
  perfRows: Array<{ niche: string; sales_30d: number }>,
): number {
  const tn = trendNiche.toLowerCase();
  for (const row of perfRows) {
    const pn = row.niche.toLowerCase();
    if (tn.includes(pn) || pn.includes(tn)) {
      const multiplier = 1 + (row.sales_30d * 0.5);
      return Math.min(multiplier, 5);
    }
  }
  return 1;
}

// Query yesterday's top trends, AI-generate 5 products, insert into queue
async function fillQueueFromTrends(
  sb: ReturnType<typeof createClient>,
  openaiKey: string,
  salesVelocity: Partial<Record<ProductType, number>> = {},
  marketPrices: Partial<Record<ProductType, { median_cents: number; p75_cents: number }>> = {},
): Promise<number> {
  // Look back 48h to handle timing gaps between scanner runs
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  let { data: rawTrends } = await sb
    .from("etsy_pod_trends")
    .select("niche, title, num_favorers, competitor_count")
    .gte("created_at", since)
    .order("num_favorers", { ascending: false })
    .limit(30);

  // Fallback to all-time top if no recent data
  if (!rawTrends || rawTrends.length < 5) {
    const { data: allTime } = await sb
      .from("etsy_pod_trends")
      .select("niche, title, num_favorers, competitor_count")
      .order("num_favorers", { ascending: false })
      .limit(30);
    rawTrends = allTime ?? [];
  }

  // Load niche_performance for sales-weighted scoring
  const { data: perfRows } = await sb
    .from("niche_performance")
    .select("niche, sales_30d")
    .gt("sales_30d", 0);
  const perfData: Array<{ niche: string; sales_30d: number }> = perfRows ?? [];

  // Competition-weighted sort: score = favorers / sqrt(max(1, competitor_count))
  // Avoids picking saturated niches even if they have high raw favorites.
  // Then multiply by niche sales multiplier (proven sellers get boosted weight).
  const trends = (rawTrends ?? [])
    .map((r) => {
      const baseScore = (r.num_favorers ?? 0) / Math.sqrt(Math.max(1, r.competitor_count ?? 1));
      const salesMultiplier = getNicheMultiplier(r.niche, perfData);
      return {
        ...r,
        weightedScore: baseScore * salesMultiplier,
        salesMultiplier,
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);

  if (!trends || trends.length === 0) {
    log("No trend data available — skipping queue fill");
    return 0;
  }

  // Check for dominant niche: if top niche has >2× the favorers of #2, cluster 3 product types on it
  const topNiche = trends[0];
  const secondNiche = trends[1];
  const isCluster = topNiche && secondNiche &&
    topNiche.num_favorers > (secondNiche.num_favorers ?? 0) * 2 &&
    topNiche.num_favorers > 500;

  const typeCounts: Partial<Record<ProductType, number>> = {};
  const selected: Array<{ niche: string; title: string; favorers: number; type: ProductType }> = [];

  if (isCluster) {
    // Dominate the niche: mug + tshirt + tumbler on top niche, then 2 others
    const clusterTypes: ProductType[] = ["mug", "tshirt", "tumbler"];
    for (const t of clusterTypes) {
      selected.push({ niche: topNiche.niche, title: topNiche.title, favorers: topNiche.num_favorers, type: t });
      typeCounts[t] = 1;
    }
    log("Niche cluster triggered", { niche: topNiche.niche, favorers: topNiche.num_favorers });
    for (const row of trends.slice(1)) {
      if (selected.length >= 5) break;
      const type = typeFromNicheKeywords(row.niche) ?? typeByVariety(typeCounts, salesVelocity);
      if ((typeCounts[type] ?? 0) >= 2) continue;
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      selected.push({ niche: row.niche, title: row.title, favorers: row.num_favorers, type });
    }
  } else {
    for (const row of trends) {
      if (selected.length >= 5) break;
      const type = typeFromNicheKeywords(row.niche) ?? typeByVariety(typeCounts, salesVelocity);
      if ((typeCounts[type] ?? 0) >= 2) continue;
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      selected.push({ niche: row.niche, title: row.title, favorers: row.num_favorers, type });
    }
  }

  if (selected.length === 0) {
    log("No eligible niches after type filtering");
    return 0;
  }

  log("Top trending niches selected", selected.map((s) => `${s.type}: ${s.niche} (${s.favorers} favs)`));

  // AI-generate product name + image prompt for each niche
  const nicheList = selected
    .map((s, i) => `${i + 1}. TYPE=${s.type.toUpperCase()} NICHE="${applySubNiche(s.niche)}" TREND_TITLE="${s.title}"`)
    .join("\n");

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `You are an Etsy POD product expert. Create original, witty products for these trending niches.

${nicheList}

Return JSON: { "products": [ { "name": "catchy original product title max 80 chars", "imagePrompt": "graphic design description for AI image generation (under 80 words) — describe VISUAL DESIGN ELEMENTS ONLY: shapes, icons, patterns, colors, composition. NO TEXT, NO WORDS, NO LETTERS in the design. For drinkware use bold dark or vibrant colored background, never white. For apparel use transparent/subtle background.", "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"] }, ... ] }

One object per niche, in the same order. Tags must be exactly 13 short Etsy search phrases (2-3 words each). Return ONLY the JSON.`,
      }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  let generated: Array<{ name: string; imagePrompt: string }> = [];
  if (aiRes.ok) {
    const aiData = await aiRes.json();
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content ?? "{}");
    generated = Array.isArray(parsed.products) ? parsed.products : [];
  }

  // Upgrade #5 — LLM Self-Critique Loop: batch-validate all image prompts before queuing
  // Catches prompts missing white background, photorealism, or boundary margins before DALL-E burns the credit
  let critiqued: Array<{ approved: boolean; revised_prompt?: string }> = generated.map(() => ({ approved: true }));
  if (openaiKey && generated.length > 0) {
    const promptList = generated
      .map((g, i) => `${i + 1}. TYPE=${selected[i]?.type ?? "?"}: "${g.imagePrompt}"`)
      .join("\n");
    try {
      const critiqueRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `You are a POD art director. Review these DALL-E image prompts for print-on-demand products.
For each prompt check: (1) Pure white/transparent background specified? (2) Text legible at small size? (3) Avoids photorealism? (4) Specifies design boundary margins?
If all checks pass: approved=true. If any fail: approved=false, provide a revised_prompt that fixes ALL issues.

${promptList}

Return ONLY JSON: {"critiques": [{"index": 1, "approved": true|false, "revised_prompt": "..." or null}, ...]}`,
          }],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (critiqueRes.ok) {
        const cd = await critiqueRes.json();
        const cp = JSON.parse(cd.choices?.[0]?.message?.content ?? "{}");
        if (Array.isArray(cp.critiques)) {
          for (const c of cp.critiques) {
            const idx = (c.index ?? 0) - 1;
            if (idx >= 0 && idx < critiqued.length) {
              critiqued[idx] = { approved: c.approved !== false, revised_prompt: c.revised_prompt };
            }
          }
        }
        const rejected = critiqued.filter(c => !c.approved).length;
        if (rejected > 0) {
          log("Self-critique revised prompts", { rejected, total: critiqued.length });
          await sb.from("pod_agent_state").upsert({
            key: "critique_rejection_rate",
            value: String((rejected / critiqued.length).toFixed(2)),
            updated_at: new Date().toISOString(),
          }, { onConflict: "key" });
        }
      }
    } catch (e) {
      log("Self-critique skipped", { error: (e as Error).message.slice(0, 80) });
    }
  }

  // Insert into queue with dynamic pricing (#13)
  let inserted = 0;
  for (let i = 0; i < selected.length; i++) {
    const s = selected[i];
    const g = generated[i];
    const critique = critiqued[i] ?? { approved: true };
    const finalPrompt = (!critique.approved && critique.revised_prompt)
      ? critique.revised_prompt
      : (g?.imagePrompt ?? s.niche);
    const price = dynamicPrice(s.type, marketPrices);
    const generatedTags = Array.isArray(g?.tags) ? g.tags.slice(0, 13) : [];
    const { error } = await sb.from("pod_product_queue").insert({
      name: (g?.name ?? s.title).slice(0, 140),
      product_type: s.type,
      image_prompt: finalPrompt,
      description: `Trending ${s.type} design based on "${s.niche}". Perfect gift.`,
      tags: generatedTags,
      retail_price: price,
      status: "pending",
    });
    if (!error) {
      inserted++;
      log("Queued product", { type: s.type, name: g?.name ?? s.title, price, critiqued: !critique.approved });
    } else {
      log("Insert error", { niche: s.niche, error: error.message });
    }
  }

  return inserted;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    // Step 1: Reset any stale "processing" rows stuck >15 min
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await sb
      .from("pod_product_queue")
      .update({ status: "pending" })
      .eq("status", "processing")
      .lt("updated_at", staleThreshold);

    // Step 2: Once per day, fill queue with 5 trend-driven products
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data: stateRow } = await sb
      .from("pod_agent_state")
      .select("value")
      .eq("key", "queue_fill_date")
      .maybeSingle();

    // Load sales velocity (#2) and market prices (#13) for smarter queue filling
    const salesVelocity: Partial<Record<ProductType, number>> = {};
    const marketPrices: Partial<Record<ProductType, { median_cents: number; p75_cents: number }>> = {};
    const [velocityRows, priceRows] = await Promise.all([
      sb.from("pod_sales_metrics").select("product_type, sales_velocity"),
      sb.from("pod_market_prices").select("product_type, median_cents, p75_cents"),
    ]);
    for (const r of (velocityRows.data ?? [])) {
      salesVelocity[r.product_type as ProductType] = r.sales_velocity ?? 0;
    }
    for (const r of (priceRows.data ?? [])) {
      marketPrices[r.product_type as ProductType] = { median_cents: r.median_cents, p75_cents: r.p75_cents };
    }

    let filledToday = 0;
    if (stateRow?.value !== today && OPENAI_KEY) {
      log("First run today — filling queue from trends", { today });
      filledToday = await fillQueueFromTrends(sb, OPENAI_KEY, salesVelocity, marketPrices);
      await sb.from("pod_agent_state").upsert(
        { key: "queue_fill_date", value: today, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      log("Queue filled", { inserted: filledToday });
    }

    // Step 3: Atomically claim next pending item (FOR UPDATE SKIP LOCKED prevents race conditions
    // where multiple concurrent workers previously grabbed the same row in a 2-step select+update)
    const { data: rows, error: fetchErr } = await sb.rpc("claim_next_queue_item");

    if (fetchErr) throw new Error(`Queue claim failed: ${fetchErr.message}`);

    if (!rows || rows.length === 0) {
      log("Queue empty — nothing to create");
      return new Response(
        JSON.stringify({ success: true, message: "Queue empty", filledToday }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const item = rows[0];
    log("Creating product", { id: item.id, name: item.name, type: item.product_type });

    // Validate product type — skip unsupported types (e.g. legacy "tote")
    const validTypes: ProductType[] = ["mug", "tshirt", "hoodie", "sock", "hat", "mousepad", "onesie", "tumbler", "blanket", "sweatshirt", "longsleeve", "travelmug", "digital", "sticker", "poster_v", "poster_h", "ornament", "journal", "tumbler40", "wineglass", "pintglass", "candle", "pillow", "puzzle", "petbandana", "coaster", "greetingcard", "shotglass", "phonecase_slim", "phonecase_tough", "truckercap", "laptopsleeve"];
    if (!validTypes.includes(item.product_type as ProductType)) {
      log("Unsupported product type — skipping", { type: item.product_type, id: item.id });
      await sb.from("pod_product_queue").update({
        status: "error",
        error_msg: `Unsupported product type: ${item.product_type}`,
      }).eq("id", item.id);
      return new Response(
        JSON.stringify({ success: false, message: `Skipped unsupported type: ${item.product_type}` }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }
    // Item is already marked 'processing' by claim_next_queue_item()

    // Route digital items to etsy-digital-product-creator; physical items to printify-product-creator
    const isDigital = item.is_digital_download === true || item.product_type === "digital";
    const creatorFn = isDigital ? "etsy-digital-product-creator" : "printify-product-creator";
    const creatorTimeout = isDigital ? 60_000 : 140_000;

    let creatorBody = isDigital
      ? JSON.stringify({
          queueId: item.id,
          product: {
            name: item.name,
            type: item.product_type,
            imagePrompt: item.image_prompt,
            description: item.description,
            retailPrice: item.retail_price,
            digitalFileSpecs: item.digital_file_specs ?? "{}",
          },
        })
      : JSON.stringify({
          queueId: item.id,
          product: {
            name: item.name,
            type: item.product_type,
            imagePrompt: item.image_prompt,
            description: item.description,
            tags: item.tags ?? [],
            retailPrice: item.retail_price,
          },
        });

    // Pre-publish validation: enforce title, tag, description, and price rules
    // before spending Printify API quota on a listing that would be rejected or rank poorly.
    if (!isDigital) {
      const validationPayload = {
        title:        item.name ?? "",
        tags:         Array.isArray(item.tags) ? item.tags : [],
        description:  item.description ?? "",
        price_cents:  item.retail_price ?? 0,
        product_type: item.product_type ?? "",
      };
      const validation = validateListing(validationPayload);

      if (validation.warnings.length > 0) {
        log("Listing warnings (non-blocking)", { id: item.id, warnings: validation.warnings });
      }

      if (!validation.valid) {
        log("Listing validation FAILED — marking permanently_failed", { id: item.id, errors: validation.errors });
        await sb.from("pod_product_queue").update({
          status:            "failed",
          failed_permanently: true,
          last_publish_error: `Validation: ${validation.errors.join("; ")}`,
        }).eq("id", item.id);
        return new Response(
          JSON.stringify({ success: false, message: "Validation failed", errors: validation.errors }),
          { headers: { ...CORS, "Content-Type": "application/json" } },
        );
      }

      // Apply auto-corrected values (truncated title/tags/description) back to the creator payload
      const parsed = JSON.parse(creatorBody);
      if (validation.fixed.title)       parsed.product.name        = validation.fixed.title;
      if (validation.fixed.tags)        parsed.product.tags        = validation.fixed.tags;
      if (validation.fixed.description) parsed.product.description = validation.fixed.description;
      creatorBody = JSON.stringify(parsed);
    }

    // Circuit breaker: load consecutive failure count from persistent state
    const CIRCUIT_BREAK_THRESHOLD = 3;
    const { data: cbState } = await sb
      .from("pod_agent_state")
      .select("value")
      .eq("key", "consecutive_printify_failures")
      .maybeSingle();
    const consecutiveFailuresBefore = parseInt(cbState?.value ?? "0", 10);

    log("Routing to creator", { fn: creatorFn, id: item.id, type: item.product_type });

    // Call appropriate creator function
    const creatorRes = await fetch(`${SUPABASE_URL}/functions/v1/${creatorFn}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: creatorBody,
      signal: AbortSignal.timeout(creatorTimeout),
    });

    const result = await creatorRes.json().catch(() => ({}));
    log("Creator response", result);

    const printifyId = result.printifyId ?? result.results?.[0]?.printifyId ?? null;
    const etsyListingId = result.listingId ?? result.results?.[0]?.etsyListingId ?? null;
    const isDigitalItem = item.is_digital_download === true || item.product_type === "digital";
    // Physical products MUST have a Printify ID — summary-only success is a silent failure trap
    const succeeded = creatorRes.ok && (
      isDigitalItem
        ? (etsyListingId != null || result.summary?.includes("success"))
        : printifyId != null
    );

    if (succeeded) {
      await sb.from("pod_product_queue").update({
        status: "published",
        printify_id: printifyId,
        // Store etsy_listing_id immediately — pod-visual-confirm will read it
        ...(etsyListingId ? { etsy_listing_id: etsyListingId } : {}),
        error_msg: null,
      }).eq("id", item.id);
      log("Published", { id: item.id, name: item.name, type: item.product_type, printifyId, etsyListingId });

      // Circuit breaker: reset consecutive failure counter on success
      if (consecutiveFailuresBefore > 0) {
        await sb.from("pod_agent_state").upsert(
          { key: "consecutive_printify_failures", value: "0", updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      }

      // Fire-and-forget post-publish visual confirmation — runs independently after 90s wait.
      // Fetches the Etsy listing's primary image, GPT Vision scores it, marks visual_failed if ≤2.
      // Only fires for physical products with a confirmed Etsy listing ID.
      if (etsyListingId && !isDigitalItem) {
        fetch(`${SUPABASE_URL}/functions/v1/pod-visual-confirm`, {
          method: "POST",
          headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            queueId: item.id,
            etsyListingId,
            productName: item.name,
            productType: item.product_type,
          }),
          signal: AbortSignal.timeout(5_000),
        }).then((r) => log("Visual confirm triggered", { status: r.status }))
          .catch((e) => log("Visual confirm trigger skipped", { reason: e.message }));
      }

      // Fire-and-forget Pinterest pin — runs async, we don't wait
      fetch(`${SUPABASE_URL}/functions/v1/pinterest-pinner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5_000),
      }).then((r) => log("Pinterest trigger", { status: r.status }))
        .catch((e) => log("Pinterest trigger skipped", { reason: e.message }));

      // Fire-and-forget IndexNow ping — gets new product indexed in Bing/Yandex within hours
      const indexNowKey = "7b3e9c2a4f1d6e8b5a0c3f7d2e9b4a16";
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: "www.mattmichelstraining.com",
          key: indexNowKey,
          keyLocation: `https://www.mattmichelstraining.com/${indexNowKey}.txt`,
          urlList: [
            "https://www.mattmichelstraining.com/gifts",
          ],
        }),
        signal: AbortSignal.timeout(5_000),
      }).then((r) => log("IndexNow ping", { status: r.status }))
        .catch((e) => log("IndexNow skipped", { reason: e.message }));
    } else {
      const errMsg = result.error ?? result.results?.[0]?.error ?? result.summary ?? JSON.stringify(result).slice(0, 300);
      const newErrorCount = (item.error_count ?? 0) + 1;
      const isDead = newErrorCount >= 3;
      await sb.from("pod_product_queue").update({
        status: "error",
        error_msg: errMsg,
        error_count: newErrorCount,
        last_attempted_at: new Date().toISOString(),
        dead: isDead,
      }).eq("id", item.id);
      log(isDead ? "Dead-lettered after 3 failures" : "Error — queued for retry", { id: item.id, errorCount: newErrorCount, errMsg: errMsg.slice(0, 80) });

      // Circuit breaker: increment and halt if Printify fails repeatedly
      const newConsecutiveFailures = consecutiveFailuresBefore + 1;
      await sb.from("pod_agent_state").upsert(
        { key: "consecutive_printify_failures", value: String(newConsecutiveFailures), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      if (newConsecutiveFailures >= CIRCUIT_BREAK_THRESHOLD) {
        await sendSMS(
          ADMIN_PHONE,
          Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219",
          `🔴 pod-new-products circuit breaker: ${newConsecutiveFailures} consecutive failures. Printify may be down. Halting batch.`,
          "pod_circuit_break",
        ).catch(() => {});
        log("Circuit breaker triggered — halting", { consecutiveFailures: newConsecutiveFailures });
      }
    }

    return new Response(
      JSON.stringify({
        success: succeeded,
        product: item.name,
        type: item.product_type,
        printifyId,
        filledToday,
        creatorSummary: result.summary ?? result.error,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[POD-NEW-PRODUCTS] Fatal:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

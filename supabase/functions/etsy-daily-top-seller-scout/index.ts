// etsy-daily-top-seller-scout — finds today's top 5 Etsy sellers across all
// categories, generates near-replica POD/digital products, and queues them
// for publishing. Cron: 7:45am UTC daily (processes before pod-new-products at 9am).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[DAILY-TOP-SELLER] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

// Broad searches to surface trending products across ALL Etsy categories
const BROAD_SEARCHES = [
  "bestseller gift funny",
  "trending personalized gift",
  "popular home decor gift",
  "viral funny novelty gift",
  "top selling unique gift",
];

const SUPPORTED_POD_TYPES = [
  "mug", "tshirt", "hoodie", "sweatshirt", "hat", "tumbler", "sock",
  "mousepad", "onesie", "blanket", "sticker", "poster_v", "poster_h",
  "ornament", "journal", "tumbler40", "wineglass", "pintglass", "candle",
  "pillow", "puzzle", "petbandana", "coaster", "greetingcard", "shotglass",
  "phonecase_slim", "phonecase_tough", "truckercap", "laptopsleeve",
];

const FINAL_PRICES: Record<string, number> = {
  mug: 2199, tshirt: 2699, hoodie: 4499, sock: 1899, hat: 3299,
  mousepad: 1999, onesie: 2499, tumbler: 3999, blanket: 6499,
  sweatshirt: 4999, longsleeve: 3499, travelmug: 3499, sticker: 599,
  poster_v: 1999, poster_h: 1999, ornament: 1599, journal: 2199,
  tumbler40: 4999, wineglass: 2199, pintglass: 1899, candle: 2699,
  pillow: 3499, puzzle: 3999, petbandana: 1499, coaster: 1299,
  greetingcard: 1499, shotglass: 1499, phonecase_slim: 2499,
  phonecase_tough: 2799, truckercap: 3299, laptopsleeve: 2999,
  digital: 1499,
};

interface EtsyListing {
  listing_id: number;
  title: string;
  tags: string[];
  price?: { amount: number; divisor: number };
  num_favorers: number;
}

interface GeneratedProduct {
  product_type: string;
  name: string;
  image_prompt: string;
  description: string;
  topic: string;
  retail_price_cents: number;
  is_digital: boolean;
  digital_file_specs: Record<string, unknown> | null;
}

async function searchEtsy(query: string, apiKey: string): Promise<EtsyListing[]> {
  const url = new URL("https://openapi.etsy.com/v3/application/listings/active");
  url.searchParams.set("keywords", query);
  url.searchParams.set("sort_on", "score");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "25");
  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Etsy ${res.status}`);
  const data = await res.json();
  return (data.results ?? []) as EtsyListing[];
}

async function generateReplica(
  listing: EtsyListing,
  rank: number,
  openaiKey: string,
): Promise<GeneratedProduct | null> {
  const price = listing.price
    ? `$${(listing.price.amount / listing.price.divisor).toFixed(2)}`
    : "unknown";

  const prompt = `You are an Etsy product strategist. This is a top-selling Etsy listing. Create a near-replica for a print-on-demand shop that captures the SAME theme, niche, and buyer intent.

Source listing (#${rank} top seller): "${listing.title}"
Tags: ${listing.tags.slice(0, 8).join(", ")}
Price: ${price} | Favorites: ${listing.num_favorers}

Map to one of these supported product types (choose the best fit):
POD types: ${SUPPORTED_POD_TYPES.join(", ")}
OR: "digital" (for SVG, PDF, template, printable, download products)

Rules:
- Keep EXACTLY the same niche/theme as the source (if it's a nurse mug → make a nurse mug)
- Name must be DIFFERENT from source but in the SAME niche (avoid copyright)
- For POD: image_prompt describes the DESIGN ARTWORK ONLY — no product shape, no hands, no mock-up
  * Drinkware (tumbler, mug, travelmug, pintglass, wineglass, shotglass): BOLD DARK or VIBRANT COLORED background — NEVER white (white designs are invisible on white mockups)
  * Apparel (tshirt, hoodie, sweatshirt, longsleeve): transparent background or subtle texture — no solid fill
  * All types: NO TEXT, NO WORDS, NO LETTERS — describe shapes, icons, patterns, colors, and visual elements only
- For digital: image_prompt shows flat-lay of printed files on clean white surface

Return ONLY valid JSON:
{
  "product_type": "mug",
  "name": "SEO title max 140 chars — same niche, different wording",
  "image_prompt": "DALL-E prompt: FLAT 2D PRINT ARTWORK for print-on-demand. Bold colored background, visual design elements only, no text or words...",
  "description": "2-3 sentence buyer-focused description",
  "topic": "one-phrase niche label e.g. 'funny nurse gifts'",
  "retail_price_cents": 2199,
  "is_digital": false,
  "digital_file_specs": null
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  try {
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as GeneratedProduct;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";
  const ETSY_SECRET = Deno.env.get("ETSY_SHARED_SECRET") ?? "";
  const ETSY_HEADER_KEY = ETSY_SECRET ? `${ETSY_API_KEY}:${ETSY_SECRET}` : ETSY_API_KEY;
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

  if (!ETSY_API_KEY || !OPENAI_KEY) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Phase 1: Search Etsy broadly to surface today's top sellers
  const allListings: EtsyListing[] = [];
  const seen = new Set<number>();

  for (const query of BROAD_SEARCHES) {
    try {
      const results = await searchEtsy(query, ETSY_HEADER_KEY);
      for (const l of results) {
        if (!seen.has(l.listing_id)) { seen.add(l.listing_id); allListings.push(l); }
      }
      log("Searched", { query, found: results.length });
    } catch (e) {
      log("Search failed (skipping)", { query, error: (e as Error).message.slice(0, 80) });
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Phase 2: Rank by num_favorers → top 5 (proxy for top sellers)
  const top5 = allListings
    .sort((a, b) => b.num_favorers - a.num_favorers)
    .slice(0, 5);

  log("Top 5 sellers identified", { listings: top5.map(l => ({ id: l.listing_id, title: l.title.slice(0, 50), favorites: l.num_favorers })) });

  // Phase 3: Generate near-replica for each + insert to queue
  const products: Array<{
    rank: number;
    source_title: string;
    source_favorites: number;
    source_listing_id: number;
    generated: GeneratedProduct;
    queue_id: number | null;
    error: string | null;
  }> = [];

  for (let i = 0; i < top5.length; i++) {
    const listing = top5[i];
    try {
      const generated = await generateReplica(listing, i + 1, OPENAI_KEY);
      if (!generated?.name) {
        products.push({ rank: i + 1, source_title: listing.title, source_favorites: listing.num_favorers, source_listing_id: listing.listing_id, generated: null as unknown as GeneratedProduct, queue_id: null, error: "GPT returned nothing" });
        continue;
      }

      // Normalize product type — fall back to tshirt if unrecognized
      const validType = [...SUPPORTED_POD_TYPES, "digital"].includes(generated.product_type)
        ? generated.product_type : "tshirt";
      const isDigital = validType === "digital" || generated.is_digital === true;
      const price = (typeof generated.retail_price_cents === "number" && generated.retail_price_cents >= 100 && generated.retail_price_cents <= 50000)
        ? generated.retail_price_cents
        : (FINAL_PRICES[validType] ?? 1999);

      const insertRow: Record<string, unknown> = {
        name: String(generated.name).slice(0, 140),
        product_type: validType,
        image_prompt: String(generated.image_prompt ?? "").slice(0, 500),
        description: String(generated.description ?? "").slice(0, 1000),
        retail_price: price,
        is_digital_download: isDigital,
        status: "pending",
        source: "daily_top5",
      };
      if (isDigital && generated.digital_file_specs) {
        insertRow.digital_file_specs = JSON.stringify(generated.digital_file_specs);
      }

      const { data: inserted, error } = await sb
        .from("pod_product_queue")
        .insert(insertRow)
        .select("id")
        .single();

      products.push({
        rank: i + 1,
        source_title: listing.title,
        source_favorites: listing.num_favorers,
        source_listing_id: listing.listing_id,
        generated,
        queue_id: inserted?.id ?? null,
        error: error?.message?.slice(0, 100) ?? null,
      });

      log("Queued replica", { rank: i + 1, type: validType, name: generated.name.slice(0, 60), price, topic: generated.topic });
    } catch (e) {
      products.push({ rank: i + 1, source_title: listing.title, source_favorites: listing.num_favorers, source_listing_id: listing.listing_id, generated: null as unknown as GeneratedProduct, queue_id: null, error: (e as Error).message.slice(0, 100) });
    }
  }

  const insertedCount = products.filter((p) => p.queue_id !== null).length;
  log("Done", { scanned: allListings.length, inserted: insertedCount });

  // Phase 4: Kick off pod-new-products once to start publishing immediately
  // (remaining items published by daily cron 9am-1pm UTC)
  if (insertedCount > 0 && ANON_KEY) {
    fetch(`${SUPABASE_URL}/functions/v1/pod-new-products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(150_000),
    }).catch(() => { /* fire and forget */ });
  }

  return new Response(
    JSON.stringify({
      success: true,
      scanned: allListings.length,
      inserted: insertedCount,
      products,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } },
  );
});

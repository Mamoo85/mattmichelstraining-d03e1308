// printify-product-creator v86
// POST /functions/v1/printify-product-creator
// Body options:
//   { startIndex?, count? }                       — create from PRODUCTS array
//   { product: TrendingProduct }                  — create custom product (auto-SEO optimized)
//   { publishAll: true }                          — publish all unpublished
//   { publishIds: string[] }                      — publish specific products by Printify ID (targeted, no 60s wait)
//   { updateAll: true, offset?: number }          — SEO-update + reprice all products (3 at a time)
//   { imageRefresh: true, offset?: number }       — re-push mockup images to Etsy (7 at a time)
//   { repairMugs: true, offset?: number }         — regenerate ALL mug designs with correct scale (fixes wrap-around)
//   { repairApparel: true, offset?: number }      — regenerate shirt/hoodie/sweatshirt/longsleeve with transparent bg + correct per-type scale
//   { repairMousepads: true, offset?: number }    — regenerate ALL mousepad designs with strict 75% margins (fixes text clipping)
//   { repairBlankets: true, offset?: number }     — regenerate ALL blanket designs with anti-leaked-text prompt
//   { repairTravelMugs: true, offset?: number }   — regenerate ALL travel mug designs with tight 25% center constraint
//   { repairOnesies: true, offset?: number }      — regenerate ALL onesie designs with anti-leaked-text prompt
//   { repairJournals: true, offset?: number }     — regenerate ALL journal designs with front-cover-only constraint (no spine bleed)
//   { repairCoasters: true, offset?: number }     — regenerate ALL coaster designs with 70% inner-circle constraint (fixes die-cut clipping)
//   { repairOrnaments: true, offset?: number }    — regenerate ALL ornament designs to fill the circular disc (fixes tiny/blank designs)
//   { repairPetbandanas: true, offset?: number }  — regenerate ALL pet bandana designs within triangular safe zone
//   { repairPosters: true, offset?: number }      — regenerate ALL poster designs as full-bleed (fixes white border frame)
//   { repairPuzzles: true, offset?: number }      — regenerate ALL puzzle designs as full-bleed edge-to-edge (fixes white padding)
//   { repairCylindrical: true, offset?: number }  — regenerate cylindrical drinkware designs with tight decal scale
//   { repairProductIds: string[] }                — repair specific products by Printify ID (mug/apparel/cylindrical)
//   { listRecent: true, page?: number }           — list 20 most recent products (title, id, blueprint_id)
//   { listBlueprints: true }                      — return full Printify catalog (all blueprints, paginated)
//   { deleteIds: string[] }                       — delete specific products
//   { patchTitles: [{id, title}] }                — fix titles on specific products and re-publish

import { createClient } from "npm:@supabase/supabase-js@2";

const PRINTIFY_BASE = "https://api.printify.com/v1";
const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";

type ProductType = "tshirt" | "hoodie" | "mug" | "sock" | "hat" | "mousepad" | "onesie" | "tumbler" | "blanket" | "sweatshirt" | "longsleeve" | "travelmug" | "tumbler40" | "wineglass" | "pintglass" | "shotglass" | "candle" | "coaster" | "greetingcard" | "sticker" | "poster_v" | "poster_h" | "ornament" | "journal" | "truckercap" | "petbandana" | "canvas" | "leggings" | "pillow" | "tanktop" | "croptop" | "joggers" | "laptopsleeve" | "wall_decal" | "puzzle";

const PRODUCT_CONFIG: Record<ProductType, {
  blueprintId: number;
  blueprintEnv: string;
  providerEnv: string;
  variantEnv: string;
  scale: number;
  // ArtsAdd crew socks (blueprint 365) are full-sublimation: 4 print areas per leg.
  // All other types use a single placeholder position.
  placeholders: string[];
}> = {
  mug:        { blueprintId: 68,   blueprintEnv: "PRINTIFY_MUG_BLUEPRINT_ID",        providerEnv: "PRINTIFY_MUG_PRINT_PROVIDER_ID",        variantEnv: "PRINTIFY_MUG_VARIANT_IDS",        scale: 0.30, placeholders: ["front"] },
  tshirt:     { blueprintId: 12,   blueprintEnv: "PRINTIFY_SHIRT_BLUEPRINT_ID",      providerEnv: "PRINTIFY_SHIRT_PRINT_PROVIDER_ID",      variantEnv: "PRINTIFY_SHIRT_VARIANT_IDS",      scale: 1.0,  placeholders: ["front"] },
  hoodie:     { blueprintId: 77,   blueprintEnv: "PRINTIFY_HOODIE_BLUEPRINT_ID",     providerEnv: "PRINTIFY_HOODIE_PRINT_PROVIDER_ID",     variantEnv: "PRINTIFY_HOODIE_VARIANT_IDS",     scale: 0.75, placeholders: ["front"] },
  // bp365 ArtsAdd crew sock: print area is tall portrait (~1:3 ratio).
  // 1024×1536 at scale=2.5 fills full leg height (2.5×1.5×pw=3.75pw ≥ ph).
  // Old: 1024×1024 / scale=3.5 was correct math but caused center-strip-only visibility.
  sock:       { blueprintId: 365,  blueprintEnv: "PRINTIFY_SOCK_BLUEPRINT_ID",       providerEnv: "PRINTIFY_SOCK_PRINT_PROVIDER_ID",       variantEnv: "PRINTIFY_SOCK_VARIANT_IDS",       scale: 2.5,  placeholders: ["front_left_leg", "front_right_leg", "back_left_leg", "back_right_leg"] },
  hat:        { blueprintId: 1447, blueprintEnv: "PRINTIFY_HAT_BLUEPRINT_ID",        providerEnv: "PRINTIFY_HAT_PRINT_PROVIDER_ID",        variantEnv: "PRINTIFY_HAT_VARIANT_IDS",        scale: 0.5,  placeholders: ["front"] },
  mousepad:   { blueprintId: 608,  blueprintEnv: "PRINTIFY_MOUSEPAD_BLUEPRINT_ID",   providerEnv: "PRINTIFY_MOUSEPAD_PRINT_PROVIDER_ID",   variantEnv: "PRINTIFY_MOUSEPAD_VARIANT_IDS",   scale: 0.85, placeholders: ["front"] },
  onesie:     { blueprintId: 568,  blueprintEnv: "PRINTIFY_ONESIE_BLUEPRINT_ID",     providerEnv: "PRINTIFY_ONESIE_PRINT_PROVIDER_ID",     variantEnv: "PRINTIFY_ONESIE_VARIANT_IDS",     scale: 0.75, placeholders: ["front"] },
  tumbler:    { blueprintId: 353,  blueprintEnv: "PRINTIFY_TUMBLER_BLUEPRINT_ID",    providerEnv: "PRINTIFY_TUMBLER_PRINT_PROVIDER_ID",    variantEnv: "PRINTIFY_TUMBLER_VARIANT_IDS",    scale: 0.22, placeholders: ["front"] },
  blanket:    { blueprintId: 238,  blueprintEnv: "PRINTIFY_BLANKET_BLUEPRINT_ID",    providerEnv: "PRINTIFY_BLANKET_PRINT_PROVIDER_ID",    variantEnv: "PRINTIFY_BLANKET_VARIANT_IDS",    scale: 1.0,  placeholders: ["front"] },
  sweatshirt: { blueprintId: 49,   blueprintEnv: "PRINTIFY_SWEATSHIRT_BLUEPRINT_ID", providerEnv: "PRINTIFY_SWEATSHIRT_PRINT_PROVIDER_ID", variantEnv: "PRINTIFY_SWEATSHIRT_VARIANT_IDS", scale: 0.75, placeholders: ["front"] },
  longsleeve: { blueprintId: 41,   blueprintEnv: "PRINTIFY_LONGSLEEVE_BLUEPRINT_ID", providerEnv: "PRINTIFY_LONGSLEEVE_PRINT_PROVIDER_ID", variantEnv: "PRINTIFY_LONGSLEEVE_VARIANT_IDS", scale: 1.0,  placeholders: ["front"] },
  travelmug:    { blueprintId: 70,   blueprintEnv: "PRINTIFY_TRAVELMUG_BLUEPRINT_ID",    providerEnv: "PRINTIFY_TRAVELMUG_PRINT_PROVIDER_ID",    variantEnv: "PRINTIFY_TRAVELMUG_VARIANT_IDS",    scale: 0.22, placeholders: ["front"] },
  tumbler40:    { blueprintId: 1509, blueprintEnv: "PRINTIFY_TUMBLER40_BLUEPRINT_ID",    providerEnv: "PRINTIFY_TUMBLER40_PRINT_PROVIDER_ID",    variantEnv: "PRINTIFY_TUMBLER40_VARIANT_IDS",    scale: 0.22, placeholders: ["front"] },
  wineglass:    { blueprintId: 1250, blueprintEnv: "PRINTIFY_WINEGLASS_BLUEPRINT_ID",    providerEnv: "PRINTIFY_WINEGLASS_PRINT_PROVIDER_ID",    variantEnv: "PRINTIFY_WINEGLASS_VARIANT_IDS",    scale: 0.40, placeholders: ["front"] },
  pintglass:    { blueprintId: 633,  blueprintEnv: "PRINTIFY_PINTGLASS_BLUEPRINT_ID",    providerEnv: "PRINTIFY_PINTGLASS_PRINT_PROVIDER_ID",    variantEnv: "PRINTIFY_PINTGLASS_VARIANT_IDS",    scale: 0.35, placeholders: ["front"] },
  shotglass:    { blueprintId: 787,  blueprintEnv: "PRINTIFY_SHOTGLASS_BLUEPRINT_ID",    providerEnv: "PRINTIFY_SHOTGLASS_PRINT_PROVIDER_ID",    variantEnv: "PRINTIFY_SHOTGLASS_VARIANT_IDS",    scale: 0.25, placeholders: ["front"] },
  candle:       { blueprintId: 755,  blueprintEnv: "PRINTIFY_CANDLE_BLUEPRINT_ID",       providerEnv: "PRINTIFY_CANDLE_PRINT_PROVIDER_ID",       variantEnv: "PRINTIFY_CANDLE_VARIANT_IDS",       scale: 0.85, placeholders: ["front"] },
  coaster:      { blueprintId: 480,  blueprintEnv: "PRINTIFY_COASTER_BLUEPRINT_ID",      providerEnv: "PRINTIFY_COASTER_PRINT_PROVIDER_ID",      variantEnv: "PRINTIFY_COASTER_VARIANT_IDS",      scale: 0.85, placeholders: ["front"] },
  greetingcard: { blueprintId: 785,  blueprintEnv: "PRINTIFY_GREETINGCARD_BLUEPRINT_ID", providerEnv: "PRINTIFY_GREETINGCARD_PRINT_PROVIDER_ID", variantEnv: "PRINTIFY_GREETINGCARD_VARIANT_IDS", scale: 1.0,  placeholders: ["front"] },
  sticker:      { blueprintId: 400,  blueprintEnv: "PRINTIFY_STICKER_BLUEPRINT_ID",      providerEnv: "PRINTIFY_STICKER_PRINT_PROVIDER_ID",      variantEnv: "PRINTIFY_STICKER_VARIANT_IDS",      scale: 1.0,  placeholders: ["front"] },
  poster_v:     { blueprintId: 852,  blueprintEnv: "PRINTIFY_POSTER_V_BLUEPRINT_ID",     providerEnv: "PRINTIFY_POSTER_V_PRINT_PROVIDER_ID",     variantEnv: "PRINTIFY_POSTER_V_VARIANT_IDS",     scale: 1.0,  placeholders: ["front"] },
  poster_h:     { blueprintId: 852,  blueprintEnv: "PRINTIFY_POSTER_H_BLUEPRINT_ID",     providerEnv: "PRINTIFY_POSTER_H_PRINT_PROVIDER_ID",     variantEnv: "PRINTIFY_POSTER_H_VARIANT_IDS",     scale: 1.0,  placeholders: ["front"] },
  ornament:     { blueprintId: 530,  blueprintEnv: "PRINTIFY_ORNAMENT_BLUEPRINT_ID",     providerEnv: "PRINTIFY_ORNAMENT_PRINT_PROVIDER_ID",     variantEnv: "PRINTIFY_ORNAMENT_VARIANT_IDS",     scale: 0.85, placeholders: ["front"] },
  journal:      { blueprintId: 75,   blueprintEnv: "PRINTIFY_JOURNAL_BLUEPRINT_ID",      providerEnv: "PRINTIFY_JOURNAL_PRINT_PROVIDER_ID",      variantEnv: "PRINTIFY_JOURNAL_VARIANT_IDS",      scale: 1.0,  placeholders: ["front"] },
  truckercap:   { blueprintId: 1446, blueprintEnv: "PRINTIFY_TRUCKERCAP_BLUEPRINT_ID",   providerEnv: "PRINTIFY_TRUCKERCAP_PRINT_PROVIDER_ID",   variantEnv: "PRINTIFY_TRUCKERCAP_VARIANT_IDS",   scale: 0.5,  placeholders: ["front"] },
  petbandana:   { blueprintId: 562,  blueprintEnv: "PRINTIFY_PETBANDANA_BLUEPRINT_ID",   providerEnv: "PRINTIFY_PETBANDANA_PRINT_PROVIDER_ID",   variantEnv: "PRINTIFY_PETBANDANA_VARIANT_IDS",   scale: 0.85, placeholders: ["front"] },
  // New product types — confirmed blueprint IDs from printify.com/app/products/{id}/...
  canvas:       { blueprintId: 190,  blueprintEnv: "PRINTIFY_CANVAS_BLUEPRINT_ID",       providerEnv: "PRINTIFY_CANVAS_PRINT_PROVIDER_ID",       variantEnv: "PRINTIFY_CANVAS_VARIANT_IDS",       scale: 1.0,  placeholders: ["front"] },
  leggings:     { blueprintId: 516,  blueprintEnv: "PRINTIFY_LEGGINGS_BLUEPRINT_ID",     providerEnv: "PRINTIFY_LEGGINGS_PRINT_PROVIDER_ID",     variantEnv: "PRINTIFY_LEGGINGS_VARIANT_IDS",     scale: 1.0,  placeholders: ["left_leg", "right_leg"] },
  pillow:       { blueprintId: 1572, blueprintEnv: "PRINTIFY_PILLOW_BLUEPRINT_ID",       providerEnv: "PRINTIFY_PILLOW_PRINT_PROVIDER_ID",       variantEnv: "PRINTIFY_PILLOW_VARIANT_IDS",       scale: 0.85, placeholders: ["front"] },
  tanktop:      { blueprintId: 1062, blueprintEnv: "PRINTIFY_TANKTOP_BLUEPRINT_ID",      providerEnv: "PRINTIFY_TANKTOP_PRINT_PROVIDER_ID",      variantEnv: "PRINTIFY_TANKTOP_VARIANT_IDS",      scale: 1.0,  placeholders: ["front"] },
  croptop:      { blueprintId: 627,  blueprintEnv: "PRINTIFY_CROPTOP_BLUEPRINT_ID",      providerEnv: "PRINTIFY_CROPTOP_PRINT_PROVIDER_ID",      variantEnv: "PRINTIFY_CROPTOP_VARIANT_IDS",      scale: 1.0,  placeholders: ["front"] },
  joggers:      { blueprintId: 591,  blueprintEnv: "PRINTIFY_JOGGERS_BLUEPRINT_ID",      providerEnv: "PRINTIFY_JOGGERS_PRINT_PROVIDER_ID",      variantEnv: "PRINTIFY_JOGGERS_VARIANT_IDS",      scale: 1.0,  placeholders: ["left_leg", "right_leg"] },
  laptopsleeve: { blueprintId: 429,  blueprintEnv: "PRINTIFY_LAPTOPSLEEVE_BLUEPRINT_ID", providerEnv: "PRINTIFY_LAPTOPSLEEVE_PRINT_PROVIDER_ID", variantEnv: "PRINTIFY_LAPTOPSLEEVE_VARIANT_IDS", scale: 0.95, placeholders: ["front"] },
  wall_decal:   { blueprintId: 0,    blueprintEnv: "PRINTIFY_WALL_DECAL_BLUEPRINT_ID",   providerEnv: "PRINTIFY_WALL_DECAL_PRINT_PROVIDER_ID",   variantEnv: "PRINTIFY_WALL_DECAL_VARIANT_IDS",   scale: 0.85, placeholders: ["front"] },
  puzzle:       { blueprintId: 611,  blueprintEnv: "PRINTIFY_PUZZLE_BLUEPRINT_ID",       providerEnv: "PRINTIFY_PUZZLE_PRINT_PROVIDER_ID",       variantEnv: "PRINTIFY_PUZZLE_VARIANT_IDS",       scale: 1.0,  placeholders: ["front"] },
};

// Retail prices — kept competitive / cheaper side to drive first sales before reviews
// Raise toward market median once 5+ reviews are in
const FINAL_PRICES: Record<ProductType, number> = {
  mug:        1899,  // $18.99 — well under $22 median; base ~$5.56, margin ~65%
  tshirt:     2299,  // $22.99 — under $25 median; base ~$10-12, margin ~45%
  hoodie:     3899,  // $38.99 — under $45 median; base ~$22, margin ~38%
  sock:       1899,  // $18.99 — ArtsAdd socks cost $11+; cannot go lower
  hat:        2799,  // $27.99 — under $28 median; base ~$19, margin ~25%
  mousepad:   1999,  // $19.99 — base ~$7, margin ~60%
  onesie:     1899,  // $18.99 — base ~$13, margin ~27%
  tumbler:    3499,  // $34.99 — under $35 median; base ~$24, margin ~27%
  blanket:    5499,  // $54.99 — under $60 median; base ~$35, margin ~35%
  sweatshirt: 3999,  // $39.99 — under $42 median; base ~$28, margin ~25%
  longsleeve: 2999,  // $29.99 — base ~$24 (expensive type); margin ~18% — raise first after reviews
  travelmug:    2999,  // $29.99 — under $32 median; base ~$19, margin ~35%
  tumbler40:    4999,  // $49.99 — 40oz premium tumbler, ~$28 base
  wineglass:    2199,  // $21.99 — stemmed wine glass, ~$11 base
  pintglass:    1899,  // $18.99 — 16oz pint glass, ~$9 base
  shotglass:    1499,  // $14.99 — ceramic shot glass, ~$7 base
  candle:       2699,  // $26.99 — 9oz soy candle, ~$14 base
  coaster:      1999,  // $19.99 — cork back coaster; raised from $12.99 (actual fulfillment cost ~$8–$10)
  greetingcard: 1499,  // $14.99 — greeting card 1-10 pcs, ~$4 base
  sticker:       799,  // kiss-cut vinyl sticker (bp=400)
  poster_v:     2199,  // vertical matte poster print (bp=852)
  poster_h:     2199,  // horizontal matte poster print (bp=852)
  ornament:     1799,  // ceramic hanging ornament
  journal:      2399,  // ruled line journal
  truckercap:   2999,  // Yupoong snapback trucker cap (bp=1446)
  petbandana:   2499,  // $24.99 — raised from $14.99; Printify fulfillment cost is $14.25–$16.05; market $21.99–$23.99
  canvas:       4999,  // cotton gallery canvas wrap (bp=190)
  leggings:     4499,  // high-waist AOP yoga leggings (bp=516)
  pillow:       3299,  // throw pillow (bp=1572)
  tanktop:      2999,  // unisex AOP tank top (bp=1062)
  croptop:      3299,  // AOP crop tee (bp=627)
  joggers:      4499,  // AOP athletic joggers (bp=591)
  laptopsleeve: 3499,  // laptop sleeve (bp=429)
  wall_decal:   1999,  // wall decal / vinyl decal (bp=TBD — configure PRINTIFY_WALL_DECAL_BLUEPRINT_ID env var)
  puzzle:       3999,  // jigsaw puzzle, Imagine Your Photos (bp=611) — $39.99
};

function detectType(blueprintId: number): ProductType {
  if (blueprintId === 68)   return "mug";
  if (blueprintId === 77)   return "hoodie";
  if (blueprintId === 365)  return "sock";
  if (blueprintId === 1447) return "hat";
  if (blueprintId === 608)  return "mousepad";
  if (blueprintId === 568)  return "onesie";
  if (blueprintId === 353)  return "tumbler";
  if (blueprintId === 238)  return "blanket";
  if (blueprintId === 49)   return "sweatshirt";
  if (blueprintId === 41)   return "longsleeve";
  if (blueprintId === 70)   return "travelmug";
  if (blueprintId === 1509) return "tumbler40";
  if (blueprintId === 1250) return "wineglass";
  if (blueprintId === 633)  return "pintglass";
  if (blueprintId === 787)  return "shotglass";
  if (blueprintId === 755)  return "candle";
  if (blueprintId === 480)  return "coaster";
  if (blueprintId === 785)  return "greetingcard";
  if (blueprintId === 530)  return "ornament";
  if (blueprintId === 75)   return "journal";
  if (blueprintId === 562)  return "petbandana";
  if (blueprintId === 190)  return "canvas";
  if (blueprintId === 516)  return "leggings";
  if (blueprintId === 1572) return "pillow";
  if (blueprintId === 1062) return "tanktop";
  if (blueprintId === 627)  return "croptop";
  if (blueprintId === 591)  return "joggers";
  if (blueprintId === 429)  return "laptopsleeve";
  if (blueprintId === 400)  return "sticker";
  if (blueprintId === 852)  return "poster_v";
  if (blueprintId === 611)  return "puzzle";
  if (blueprintId === 1446) return "truckercap";
  // env-var overrides: check if blueprint ID matches any custom-set value
  for (const [type, cfg] of Object.entries(PRODUCT_CONFIG) as Array<[ProductType, typeof PRODUCT_CONFIG[ProductType]]>) {
    const envId = parseInt(Deno.env.get(cfg.blueprintEnv) ?? "", 10);
    if (envId && envId === blueprintId) return type;
  }
  return "tshirt";
}

interface TrendingProduct {
  name: string;
  type: ProductType;
  imagePrompt: string;
  description: string;
  tags: string[];
  retailPrice: number;
}

// PRODUCTS array removed — all 29 products already live in the shop.
// Use { product: TrendingProduct } body to create custom products instead.
const PRODUCTS: TrendingProduct[] = [
];


// ——— AI listing optimization for custom products ———
async function optimizeListing(name: string, type: ProductType, currentDesc: string): Promise<{
  title: string;
  description: string;
  tags: string[];
}> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not set");
  const typeLabel = {
    mug:        "ceramic coffee mug 11oz",
    tshirt:     "unisex t-shirt",
    hoodie:     "pullover hoodie",
    sock:       "novelty crew socks",
    hat:        "classic dad hat / baseball cap",
    mousepad:   "desk mouse pad",
    onesie:     "baby onesie bodysuit",
    tumbler:    "20oz stainless steel tumbler",
    blanket:    "sherpa throw blanket",
    sweatshirt: "unisex crewneck sweatshirt",
    longsleeve:   "unisex long sleeve t-shirt",
    travelmug:    "insulated travel mug",
    tumbler40:    "40oz insulated tumbler with lid",
    wineglass:    "stemmed wine glass 12oz",
    pintglass:    "pint glass 16oz",
    shotglass:    "ceramic shot glass",
    candle:       "scented soy candle 9oz",
    coaster:      "cork back coaster",
    greetingcard: "greeting card",
    sticker:      "die-cut vinyl sticker sheet",
    poster_v:     "vertical wall art poster print",
    poster_h:     "horizontal wall art poster print",
    ornament:     "ceramic hanging ornament",
    journal:      "ruled line journal / notebook",
    truckercap:   "mesh trucker snapback cap",
    petbandana:   "dog/cat bandana scarf accessory",
    canvas:       "cotton gallery canvas wrap wall art",
    leggings:     "high-waist all-over-print yoga leggings",
    pillow:       "throw pillow with insert",
    tanktop:      "unisex all-over-print tank top",
    croptop:      "women's all-over-print crop tee",
    joggers:      "all-over-print athletic joggers",
    laptopsleeve: "laptop sleeve / laptop case",
  }[type];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `You are an expert Etsy SEO specialist. Optimize this POD product for maximum Etsy search ranking.

Product: "${name}"
Type: ${typeLabel}
Description: "${currentDesc}"

RULES:
1. TITLE: Max 140 chars. Start with the MOST SPECIFIC long-tail phrase buyers type.
   FORMAT: "[Funny/Cute/Heartfelt] [Niche] [Product Type] Gift - [Occasion] [Recipient]"
   EXAMPLE: "Funny Golden Retriever Mom Hoodie Gift - Dog Mom Birthday Present for Women"
   Every word must be a real search term buyers type. No filler words.
2. TAGS: EXACTLY 13 tags. Each tag MAX 20 characters including spaces. Use real search phrases people type on Etsy. Mix gift occasion + product type + humor/niche. No single-word tags.
3. DESCRIPTION: 3 paragraphs, 150-250 words total.
   Para 1: naturally uses the top 6 search keywords.
   Para 2: emotional/why buy — mention it makes a perfect gift for: birthdays, Christmas, Mother's Day, Father's Day, graduation, retirement, Secret Santa, White Elephant, and any niche-specific occasion (e.g. Nurses Week for nurse products).
   Para 3: product specs. Final line: "Fast shipping — order today!"
   After Para 3, add: "Shop our full [niche] collection for more great gift ideas!"
   Very last line: "Makes the perfect gift — order today! [Personalization available — leave a note at checkout with any custom message]"

Return ONLY this JSON (no other text):
{"title":"...","description":"...","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"]}`,
      }],
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`optimizeListing failed: ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");

  const tags = ((parsed.tags ?? []) as string[])
    .map((t) => t.replace(/[^a-zA-Z0-9 \-]/g, "").trim().slice(0, 20).trim())
    .filter((t) => t.length > 0)
    .slice(0, 13);
  while (tags.length < 13) tags.push(tags[0] ?? "gift");

  const youtubeAppend = "\n\n📺 See more designs on YouTube: https://www.youtube.com/channel/UCLHMaP-AtjQIvbIyFrHmaXg";
  return {
    title: (parsed.title ?? name).slice(0, 140),
    description: (parsed.description ?? currentDesc) + youtubeAppend,
    tags,
  };
}

async function pFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${PRINTIFY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PRINTIFY_KEY}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
}

interface ResolvedConfig {
  blueprintId: number;
  scale: number;
  placeholders: string[];
  printProviderId: number;
  variantIds: number[];
}

const dynamicCache = new Map<ProductType, ResolvedConfig>();

async function resolveConfig(type: ProductType): Promise<ResolvedConfig> {
  if (dynamicCache.has(type)) return dynamicCache.get(type)!;

  const spec = PRODUCT_CONFIG[type];
  if (!spec) throw new Error(`Unknown product type "${type}" — add it to PRODUCT_CONFIG`);
  const blueprintId = parseInt(Deno.env.get(spec.blueprintEnv) ?? "", 10) || spec.blueprintId;
  const providerStr = Deno.env.get(spec.providerEnv) ?? Deno.env.get("PRINTIFY_PRINT_PROVIDER_ID");
  const variantStr  = Deno.env.get(spec.variantEnv)  ?? Deno.env.get("PRINTIFY_VARIANT_IDS");

  if (providerStr && variantStr) {
    const cfg: ResolvedConfig = {
      blueprintId,
      scale: spec.scale,
      placeholders: spec.placeholders,
      printProviderId: parseInt(providerStr, 10),
      variantIds: variantStr.split(",").map((v) => parseInt(v.trim(), 10)),
    };
    dynamicCache.set(type, cfg);
    return cfg;
  }

  console.log(`No env vars for ${type}, discovering from Printify API (blueprint ${blueprintId})...`);
  const provRes = await pFetch(`/catalog/blueprints/${blueprintId}/print_providers.json`);
  const provBody = await provRes.text();
  let providers: Array<{ id: number; title: string }> = [];
  try {
    const parsed = JSON.parse(provBody);
    providers = Array.isArray(parsed) ? parsed : [];
  } catch { /* ignore */ }

  // If catalog endpoint fails, fall back to discovering from an existing shop product with same blueprint
  if (!providers.length) {
    console.log(`Catalog endpoint returned no providers for blueprint ${spec.blueprintId}, falling back to shop product discovery...`);
    const shopId = SHOP_ID || (() => { throw new Error("PRINTIFY_SHOP_ID not set for fallback"); })();
    let sameBlueprint: Record<string, unknown> | undefined;
    for (let fp = 1; fp <= 10 && !sameBlueprint; fp++) {
      const fbRes = await pFetch(`/shops/${shopId}/products.json?page=${fp}&limit=50`);
      if (!fbRes.ok) break;
      const fbData = await fbRes.json() as Record<string, unknown>;
      const fbItems = Array.isArray(fbData.data) ? fbData.data as Array<Record<string, unknown>> : [];
      sameBlueprint = fbItems.find((p) => p.blueprint_id === blueprintId);
      if (fbItems.length < 50) break;
    }
    if (sameBlueprint) {
      const detailRes = await pFetch(`/shops/${shopId}/products/${sameBlueprint.id}.json`);
      if (detailRes.ok) {
        const detail = await detailRes.json() as Record<string, unknown>;
        const pid = detail.print_provider_id as number;
        const variants = (detail.variants as Array<Record<string, unknown>> ?? []).slice(0, 10);
        const cfg: ResolvedConfig = {
          blueprintId,
          scale: spec.scale,
          placeholders: spec.placeholders,
          printProviderId: pid,
          variantIds: variants.map((v) => v.id as number),
        };
        dynamicCache.set(type, cfg);
        console.log(`Discovered ${type} config from existing product: provider=${pid}, variants=${cfg.variantIds.length}`);
        return cfg;
      }
    }
    throw new Error(`No print providers for blueprint ${blueprintId}. API: ${provBody.slice(0, 150)}`);
  }

  let provider = providers.find((p) => /monster|printify|district/i.test(p.title)) ?? providers[0];

  // Try each provider in order until we get a valid variants array
  let allVariants: Array<{ id: number; title: string }> = [];
  let discoveredPlaceholders: string[] = [];
  for (const candidate of [provider, ...providers.filter((p) => p.id !== provider.id)]) {
    const varRes = await pFetch(`/catalog/blueprints/${blueprintId}/print_providers/${candidate.id}/variants.json`);
    const varData = await varRes.json();
    const parsed: Array<{ id: number; title: string }> = Array.isArray(varData.variants)
      ? varData.variants
      : Array.isArray(varData) ? varData : [];
    if (parsed.length > 0) {
      allVariants = parsed;
      provider = candidate;
      // Extract placeholder positions from catalog response (overrides hardcoded spec.placeholders).
      // Printify returns placeholders nested inside each variant object, not at top level.
      const topLevelPlaceholders = Array.isArray(varData.placeholders)
        ? (varData.placeholders as Array<{ id?: string; position?: string }>).map((p) => p.id ?? p.position).filter(Boolean) as string[]
        : [];
      const firstVariant = Array.isArray(varData.variants) ? varData.variants[0] : null;
      const variantPlaceholders = firstVariant && Array.isArray(firstVariant.placeholders)
        ? (firstVariant.placeholders as Array<{ position: string }>).map((p) => p.position).filter(Boolean)
        : [];
      const ids = topLevelPlaceholders.length > 0 ? topLevelPlaceholders : variantPlaceholders;
      if (ids.length > 0) discoveredPlaceholders = ids;
      break;
    }
    console.warn(`Provider ${candidate.id} (${candidate.title}) returned no variants for blueprint ${blueprintId}, trying next...`);
  }

  // All catalog variant endpoints failed — fall back to copying config from an existing shop product
  if (allVariants.length === 0) {
    console.warn(`All catalog variant endpoints failed for blueprint ${blueprintId}. Falling back to shop product discovery...`);
    const shopId = SHOP_ID || await getShopId();
    let sameBlueprint: Record<string, unknown> | undefined;
    for (let fp = 1; fp <= 10 && !sameBlueprint; fp++) {
      const fbRes = await pFetch(`/shops/${shopId}/products.json?page=${fp}&limit=50`);
      if (!fbRes.ok) break;
      const fbData = await fbRes.json() as Record<string, unknown>;
      const fbItems = Array.isArray(fbData.data) ? fbData.data as Array<Record<string, unknown>> : [];
      sameBlueprint = fbItems.find((p) => p.blueprint_id === blueprintId);
      if (fbItems.length < 50) break;
    }
    if (sameBlueprint) {
      const detailRes = await pFetch(`/shops/${shopId}/products/${sameBlueprint.id}.json`);
      if (detailRes.ok) {
        const detail = await detailRes.json() as Record<string, unknown>;
        const pid = detail.print_provider_id as number;
        const variants = (detail.variants as Array<Record<string, unknown>> ?? []).slice(0, 10);
        const cfg: ResolvedConfig = {
          blueprintId,
          scale: spec.scale,
          placeholders: spec.placeholders,
          printProviderId: pid,
          variantIds: variants.map((v) => v.id as number),
        };
        dynamicCache.set(type, cfg);
        console.log(`Resolved ${type} config from existing shop product: provider=${pid}, variants=${cfg.variantIds.length}`);
        return cfg;
      }
    }
    throw new Error(`No valid variants found for blueprint ${blueprintId} — all catalog providers failed and no existing shop product to copy from.`);
  }

  let selected: Array<{ id: number; title: string }>;
  if (type === "tshirt" || type === "hoodie") {
    const sizeRe  = /\b(s|m|l|xl|2xl)\b/i;
    const colorRe = /\b(white|black|navy)\b/i;
    const filtered = allVariants.filter((v) => sizeRe.test(v.title) && colorRe.test(v.title));
    selected = filtered.length > 0 ? filtered : allVariants.slice(0, 20);
  } else {
    selected = allVariants.slice(0, 10);
  }

  const cfg: ResolvedConfig = {
    blueprintId,
    scale: spec.scale,
    placeholders: discoveredPlaceholders.length > 0 ? discoveredPlaceholders : spec.placeholders,
    printProviderId: provider.id,
    variantIds: selected.map((v) => v.id),
  };
  dynamicCache.set(type, cfg);
  return cfg;
}

async function getShopId(): Promise<string> {
  if (SHOP_ID) return SHOP_ID;
  const res = await pFetch("/shops.json");
  const shops = await res.json();
  if (!shops?.length) throw new Error("No Printify shops found.");
  return String(shops[0].id);
}

// Brand style prefix applied to every image to create visual shop consistency
const BRAND_PREFIX = "Bold graphic design. High contrast with one accent color pop. Professional print-on-demand aesthetic. ";

// Thumbnail legibility rules injected into all non-cylindrical product prompts
const THUMBNAIL_RULES = "Design must read clearly at 200px thumbnail size — bold, high-contrast, no fine detail. " +
  "Use a 2-3 color palette maximum — colors must be vivid and distinct, not muted. " +
  "If text is used, use chunky/display font style, not thin script or hairline fonts. ";

// FLAT_ARTWORK_RULE: must be included in every buildPrompt case to prevent AI from generating product mockups.
// Without this, gpt-image-1 generates a PHOTO OF THE PHYSICAL PRODUCT (a hat photo, a glass photo, etc.)
// instead of the flat 2D print-ready design artwork. This is the #1 cause of defective products.
const FLAT_ARTWORK_RULE =
  `CRITICAL — THIS IS A PRINT FILE, NOT A PRODUCT PHOTO: ` +
  `Generate ONLY flat 2D print-ready artwork. ` +
  `DO NOT render the physical product. DO NOT draw a hat, mug, glass, onesie, shirt, or any 3D object. ` +
  `DO NOT show a model wearing or holding anything. DO NOT create a product mock-up or lifestyle photo. ` +
  `This image IS the design file that will be digitally applied to the product surface — ` +
  `treat it as artwork printed on a flat sheet of paper, nothing more. `;

// Mug/tumbler: scale=0.30 in Printify maps the FULL image canvas to the front face only (no wrap-around).
// Design must FILL the entire canvas — Printify handles placement. Do NOT constrain to a sub-region of the canvas.
function buildPrompt(prompt: string, type: ProductType): string {
  const branded = BRAND_PREFIX + prompt;
  if (type === "mug") {
    return `${branded}. ${FLAT_ARTWORK_RULE}` +
      `Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `FILL THE ENTIRE IMAGE CANVAS with bold, large artwork — the design must extend close to all four edges. ` +
      `Large, legible typography and graphics centered on the canvas that will print clearly on a ceramic coffee mug. ` +
      `All text must be centered, high contrast, minimum 15% of canvas height per line of text. ` +
      `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "hat") {
    return `${branded}. ${FLAT_ARTWORK_RULE}` +
      `TRANSPARENT BACKGROUND — no white fill, no background rectangle, no colored fill anywhere in the image. ` +
      `This artwork prints directly on colored fabric/mesh — the hat color shows wherever there is no ink. ` +
      `EMBROIDERY-STYLE HAT FRONT PANEL ARTWORK: compact, bold design that fits in a small rectangle (hat front patch area). ` +
      `Keep the entire design within the center 50% of the canvas with transparent margins on all sides. ` +
      `Simple icon + short text layout, no fine detail — must read clearly when printed small. ` +
      `CRITICAL: render ONLY the exact text described in the prompt — do NOT add any other words or phrases. ` +
      `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "tumbler" || type === "tumbler40") {
    return `${branded}. ${FLAT_ARTWORK_RULE}` +
      `Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `TUMBLER FRONT-FACE DESIGN — keep ALL text and design elements within the CENTER 75% of canvas width (12.5% pure white margin on each side) and CENTER 80% of canvas height (10% white margin top and bottom). ` +
      `The design must be CLEARLY READABLE on the visible front face of a tumbler — bold centered text, large enough to read in a thumbnail. ` +
      `Do NOT extend any element to the canvas edges. Do NOT use tiny text. ` +
      `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "travelmug") {
    return `${branded}. ${FLAT_ARTWORK_RULE}` +
      `Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `TRAVEL MUG FRONT-FACE DESIGN — keep ALL text and design elements within the CENTER 75% of canvas width (12.5% pure white margin on each side) and CENTER 80% of canvas height (10% white margin top and bottom). ` +
      `The design must be CLEARLY READABLE on the visible front face of a travel mug — bold centered text, large enough to read in a thumbnail. ` +
      `Do NOT extend any element to the canvas edges. Do NOT use tiny text. ` +
      `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "wineglass") {
    return `${branded}. ` +
      `IMPORTANT — THIS IS FLAT LABEL ARTWORK ONLY. DO NOT DRAW A WINE GLASS. DO NOT DRAW ANY 3D OBJECT. DO NOT CREATE A PRODUCT MOCKUP OR LIFESTYLE PHOTO. ` +
      `This image IS the flat label artwork that will be printed as a decal and applied to a wine glass. Treat it as a sticker/label design only. ` +
      `LABEL DESIGN RULES: ` +
      `(1) Use a BOLD DARK or VIBRANT COLORED rectangular background filling the center 70% width × 60% height of the canvas — navy, forest green, burgundy, deep purple, royal blue. ` +
      `(2) White margins on all 4 sides outside the colored rectangle (so Printify knows where the label boundary is). ` +
      `(3) Large bold white text as the main focal point — centered on the colored rectangle. ` +
      `(4) Simple icon above or below the text. ` +
      `NEVER use white for the label background — the label must have a clearly distinct colored background. ` +
      `High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "pintglass") {
    return `${branded}. ` +
      `IMPORTANT — THIS IS FLAT LABEL ARTWORK ONLY. DO NOT DRAW A PINT GLASS. DO NOT DRAW ANY 3D OBJECT. DO NOT CREATE A PRODUCT MOCKUP OR LIFESTYLE PHOTO. ` +
      `This image IS the flat label artwork that will be printed as a decal and applied to a pint glass. Treat it as a sticker/label design only. ` +
      `LABEL DESIGN RULES: ` +
      `(1) Use a BOLD DARK or VIBRANT COLORED rectangular background filling the center 70% width × 60% height of the canvas — navy, forest green, burgundy, deep purple, royal blue. ` +
      `(2) White margins on all 4 sides outside the colored rectangle. ` +
      `(3) Large bold white text as the main focal point — centered on the colored rectangle. ` +
      `(4) Simple icon above or below the text. ` +
      `NEVER use white for the label background. ` +
      `High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "shotglass") {
    return `${branded}. ` +
      `IMPORTANT — THIS IS FLAT LABEL ARTWORK ONLY. DO NOT DRAW A SHOT GLASS. DO NOT DRAW ANY 3D OBJECT. DO NOT CREATE A PRODUCT MOCKUP OR LIFESTYLE PHOTO. ` +
      `This image IS the flat label artwork that will be printed as a decal and applied to a ceramic shot glass. Treat it as a sticker/label design only. ` +
      `LABEL DESIGN RULES: ` +
      `(1) Use a BOLD DARK or VIBRANT COLORED circular or rectangular background filling the center 65% width × 55% height of the canvas — navy, deep red, forest green, burgundy, royal blue. ` +
      `(2) White space on all 4 sides outside the colored shape. ` +
      `(3) Large bold white text as the main focal point — 2–3 words maximum, very large font. ` +
      `(4) Simple icon. No fine detail (shot glasses are small). ` +
      `NEVER use white for the label background. ` +
      `High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "sock") {
    return `${branded}. ` +
      `SOCK ALL-OVER PRINT DESIGN — TALL PORTRAIT CANVAS (1024×1536, taller than wide). ` +
      `CRITICAL — FILL THE FULL HEIGHT: Spread all pattern elements uniformly from the TOP to the BOTTOM of the canvas. ` +
      `Do NOT concentrate elements in the middle. Do NOT leave blank space at the top or bottom. ` +
      `This is a FLAT 2D graphic that tiles across the full surface of a crew sock leg. ` +
      `CRITICAL — ONE UNIFIED PATTERN ONLY: This SAME image is applied identically to BOTH the left AND right sock legs. ` +
      `DO NOT put different designs on the left half vs. right half of the canvas. DO NOT create two separate sock designs side by side. ` +
      `Create ONE cohesive repeating pattern where the same themed elements are distributed uniformly across the ENTIRE tall portrait canvas — corner to corner. ` +
      `CRITICAL: Use a VIBRANT SATURATED COLORED background that fills the entire canvas — bold red, navy, forest green, hot pink, bright orange, etc. ` +
      `DO NOT use white or light backgrounds — they are invisible against the white sock body. ` +
      `DO NOT render any style-instruction words as visible text. ` +
      `Render the ACTUAL themed artwork: illustrated characters, icons, symbols scattered uniformly across the full canvas. ` +
      `Bold, high-contrast cartoon illustration style. No watermarks, print-on-demand ready.`;
  }
  if (type === "candle") {
    return `${branded}. ` +
      `PRINT FILE ARTWORK — THIS IS A FLAT RECTANGULAR LABEL DESIGN ONLY. ` +
      `ABSOLUTE PROHIBITION: DO NOT draw a candle. DO NOT draw a jar. DO NOT draw a flame. DO NOT draw any 3D object or product. ` +
      `DO NOT show the candle sitting on a surface. DO NOT depict a physical product of any kind. ` +
      `This image IS the label artwork itself — a flat 2D graphic that will be printed on a rectangular sticker and applied to a candle jar. ` +
      `Design it like a colorful product label that FILLS THE FULL CANVAS: ` +
      `(1) A rich, saturated COLORED background filling the ENTIRE canvas edge-to-edge — bold red, deep green, navy, warm gold, etc. ` +
      `(2) Large bold typography in a contrasting color as the main focal point (the funny/heartfelt message) — text should be LARGE, readable, centered. ` +
      `(3) Simple icons, stars, or borders framing the text. ` +
      `The label must be FULL CANVAS — fill the entire image from edge to edge with the colored background and large bold text. ` +
      `Bold, high-contrast, readable at 3-inch label size. No watermarks, print-on-demand label ready.`;
  }
  if (type === "coaster") {
    return `${branded}. Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `COASTER PRINT: circular or square flat design. Keep all design elements within 85% of the canvas with 7.5% white border on all sides. ` +
      `Bold graphic — must look great at coaster size (3.5"). ${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "greetingcard") {
    return `${branded}. Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `GREETING CARD FRONT: portrait-orientation card design. ` +
      `CRITICAL CHARACTER RULE: if the design includes a character or animal, render a FACE/BUST ONLY (head and shoulders) — DO NOT draw a full body from head to toe. A full-body character extending to the bottom of the card looks awkward. Keep the character as a large, centered close-up with generous white space below. ` +
      `Bold text below the character centered in the lower third. Bright, cheerful, emotionally resonant. ` +
      `Keep ALL content within 15% margins on all sides (nothing touching the card edge). ` +
      `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "sticker") {
    return `${BRAND_PREFIX}${prompt}. ` +
      `STICKER SHEET DESIGN — IMPORTANT RULES: ` +
      `Pure white #FFFFFF background. Bold, clean cartoon/graphic illustration style. ` +
      `DO NOT include any words, letters, or text anywhere in the image — illustration elements only. ` +
      `The design should be a single bold graphic that reads clearly at thumbnail size. ` +
      `Keep the entire illustration within the center 80% of the canvas with white padding on all edges. ` +
      `High contrast colors, thick clean outlines, no fine detail that would blur when scaled down. ` +
      `${THUMBNAIL_RULES}No watermarks, no gradients, print-on-demand ready.`;
  }
  if (type === "poster_v") {
    return `${BRAND_PREFIX}${prompt}. ` +
      `VERTICAL POSTER PRINT (portrait orientation, tall): ` +
      `Bold typographic or illustrated design that fills the vertical canvas. ` +
      `CRITICAL TEXT RULE: render ONLY the exact words described in the prompt — no extra phrases, no decorative sub-text, no filler words. ` +
      `If the prompt specifies text, make it the dominant visual element in a large, clean, legible font. ` +
      `Minimal decorative elements. Pure white #FFFFFF background. ` +
      `Keep all content within 10% inset margins on all four sides. ` +
      `${THUMBNAIL_RULES}High contrast, sharp edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "poster_h") {
    return `${BRAND_PREFIX}${prompt}. ` +
      `HORIZONTAL POSTER PRINT (landscape orientation, wide): ` +
      `Bold typographic or illustrated design that fills the horizontal canvas. ` +
      `CRITICAL TEXT RULE: render ONLY the exact words described in the prompt — no extra phrases, no decorative sub-text, no filler words. ` +
      `If the prompt specifies text, make it the dominant visual element in a large, clean, legible font. ` +
      `Minimal decorative elements. Pure white #FFFFFF background. ` +
      `Keep all content within 10% inset margins on all four sides. ` +
      `${THUMBNAIL_RULES}High contrast, sharp edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "ornament") {
    return `${BRAND_PREFIX}${prompt}. ` +
      `CERAMIC HANGING ORNAMENT — circular or simple shape design: ` +
      `The printable area is roughly circular. Keep the ENTIRE design within a centered circle ` +
      `that occupies no more than 75% of the canvas width, with white space outside. ` +
      `Bold cartoon/illustration style. Minimal or no text — if text is needed, use 3 words maximum, large and clear. ` +
      `DO NOT add any words not explicitly described in the prompt. ` +
      `Pure white #FFFFFF background outside the design. ${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "journal") {
    return `${BRAND_PREFIX}${prompt}. ` +
      `JOURNAL / NOTEBOOK COVER DESIGN — FRONT COVER ONLY: ` +
      `Bold, clean front cover design. ` +
      `CRITICAL — SPINE CLEARANCE: The LEFT 20% of the canvas (pixels 0–200 of a 1000px canvas) is the SPINE AREA — it MUST be pure white or solid background ONLY. Absolutely NO text, NO design elements, NO illustrations may appear in the left 20%. ` +
      `Keep ALL design content (text, illustrations, graphics) within pixels 200–950 horizontally (right 75% of canvas) and within the center 80% vertically. ` +
      `If the prompt includes text, render ONLY those exact words — no additional text, no subtitle, no decorative words not in the prompt. ` +
      `Text must be large, clean, fully legible, and positioned in the RIGHT 75% of the canvas only. ` +
      `Pure white #FFFFFF or solid color background. ${THUMBNAIL_RULES}High contrast, no watermarks, print-on-demand ready.`;
  }
  if (type === "truckercap") {
    return `${BRAND_PREFIX}${prompt}. ${FLAT_ARTWORK_RULE}` +
      `TRANSPARENT BACKGROUND — no white fill, no background rectangle, no colored fill anywhere in the image. ` +
      `This artwork prints directly on the cap fabric — the cap color shows wherever there is no ink. ` +
      `TRUCKER CAP FRONT PANEL ARTWORK — embroidery/sublimation patch area: ` +
      `Very compact design that fits within a small rectangular front panel area. ` +
      `Keep the ENTIRE design within the center 45% of the canvas width and center 50% of the canvas height — ` +
      `transparent margins on all four sides. ` +
      `Simple bold icon + short text (max 3 words). No fine detail — must be readable when embroidered small. ` +
      `CRITICAL: render ONLY the exact text described in the prompt — do NOT add any other words or phrases. ` +
      `Maximum 2–3 colors. ${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "tshirt") {
    return `${branded}. ${FLAT_ARTWORK_RULE}` +
      `TRANSPARENT BACKGROUND — absolutely no background fill, no white fill, no background rectangle anywhere. ` +
      `The design is printed directly on fabric — the shirt color shows through wherever there is no ink. ` +
      `CRITICAL TEXT RULE: render ONLY the exact words explicitly described in the prompt — DO NOT add any other words, labels, or text. ` +
      `DO NOT render any instruction words as visible text (do not write "bold", "graphic", "aesthetic", "accent color", "high contrast" — these are invisible instructions, NOT design content). ` +
      `Keep the ENTIRE design within the center 80% of the canvas width — 10% transparent margin on left AND right. ` +
      `CRITICAL VERTICAL MARGIN: Keep the ENTIRE design within pixels 100–924 of the 1024px canvas height — 10% transparent margin at top AND bottom. Nothing cropped at edges. ` +
      `Bold chunky illustration style, high contrast colors with thick outlines that read clearly on dark fabric. ` +
      `${THUMBNAIL_RULES}Clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "hoodie" || type === "sweatshirt" || type === "longsleeve") {
    return `${branded}. ${FLAT_ARTWORK_RULE}` +
      `TRANSPARENT BACKGROUND — absolutely no background fill, no white fill, no background rectangle anywhere. ` +
      `The design is printed directly on fabric — the garment color shows through wherever there is no ink. ` +
      `CRITICAL TEXT RULE: render ONLY the exact words explicitly described in the prompt — DO NOT add any other words, labels, or text. ` +
      `DO NOT render any instruction words as visible text (do not write "bold", "graphic", "aesthetic", "accent color", "high contrast" — these are invisible instructions, NOT design content). ` +
      `Keep the ENTIRE design within the center 80% of the canvas width — 10% transparent margin on left AND right. ` +
      `CRITICAL VERTICAL MARGIN: Keep the ENTIRE design within pixels 100–924 of the 1024px canvas height — 10% transparent margin at top AND bottom. Nothing cropped at edges. ` +
      `Bold chunky illustration style, high contrast colors with thick outlines that read clearly on dark fabric. ` +
      `${THUMBNAIL_RULES}Clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "mousepad") {
    return `${branded}. Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `MOUSEPAD PRINT DESIGN: Full-surface rectangular design. ` +
      `STRICT MARGIN RULE — NON-NEGOTIABLE: Keep ALL design elements within the center 75% of the canvas width and center 75% of the canvas height. ` +
      `That means at least 12.5% pure white margin on every edge (left, right, top, bottom). ` +
      `ALL text must be fully inside this 75% zone — absolutely no text may touch or cross the 12.5% margin boundary. ` +
      `CRITICAL TEXT RULE: render ONLY the exact words explicitly described in the prompt — DO NOT add any other words or phrases. ` +
      `DO NOT render any instruction words as visible text (do not write "bold", "graphic", "aesthetic" — these are invisible instructions). ` +
      `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "blanket") {
    return `${branded}. Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
      `BLANKET PRINT DESIGN: Full-surface large format design. ` +
      `CRITICAL TEXT RULE — ZERO TOLERANCE: render ONLY the exact words explicitly described in the prompt. ` +
      `DO NOT add any other words, labels, captions, or text to the design. ` +
      `DO NOT render any instruction words as visible text — do not write "bold", "graphic", "aesthetic", "high contrast", "accent color", "club", "home", "stay", "cozy", "warm" unless those exact words appear in the prompt. ` +
      `If any of those instruction words appear as printed text in the image, the design is REJECTED. ` +
      `Bold, clean illustration or typography design centered in the canvas. ` +
      `Keep all design elements within the center 80% of the canvas with 10% white margin on all edges. ` +
      `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "onesie") {
    return `${branded}. ${FLAT_ARTWORK_RULE}` +
      `TRANSPARENT BACKGROUND — no white fill, no background rectangle, no background color anywhere. ` +
      `This artwork is printed directly on colored fabric — the onesie color shows through wherever there is no ink. ` +
      `BABY ONESIE CHEST PRINT ARTWORK: Small centered chest design to be screen-printed on a baby bodysuit. ` +
      `CRITICAL TEXT RULE — ZERO TOLERANCE: render ONLY the exact words explicitly described in the prompt. ` +
      `DO NOT add any other words, labels, or text to the design. ` +
      `DO NOT render any instruction words as visible text — do not write "bold", "graphic", "aesthetic", "baby", "onesie", "bodysuit", "infant", "Mother's Day", "newborn" unless those exact words appear in the prompt. ` +
      `If any of those instruction words appear as printed text in the image, the design is REJECTED. ` +
      `Cute chest print — keep the entire design within the center 75% of the canvas width and center 70% of the canvas height. Transparent margin on all 4 sides. ` +
      `Bold cute illustration or cheerful typography style. ` +
      `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "canvas") {
    return `${branded}. ` +
      `GALLERY CANVAS WRAP WALL ART — full-bleed print: ` +
      `Rich, painterly or bold graphic art that fills the entire canvas edge-to-edge with no white borders. ` +
      `The design wraps slightly around the edges of the canvas stretcher bars — keep key content within the center 80% of the canvas. ` +
      `CRITICAL TEXT RULE: render ONLY the exact text or subject described in the prompt — no extra decorative text. ` +
      `Warm, high-quality art-print aesthetic. No watermarks, print-on-demand ready, suitable for home wall display.`;
  }
  if (type === "leggings" || type === "tanktop" || type === "croptop" || type === "joggers") {
    return `${branded}. ` +
      `ALL-OVER PRINT (AOP) GARMENT — full-canvas seamless design: ` +
      `The ENTIRE canvas must be filled with vibrant, bold, eye-catching artwork — no white or empty areas. ` +
      `This design wraps fully around the garment, so use a pattern, tiled motif, or seamless repeating illustration. ` +
      `CRITICAL: rich saturated colors, high contrast. DO NOT leave white or neutral backgrounds — ` +
      `ZERO white pixels anywhere in the canvas — fill every single corner and edge with color. ` +
      `Use a seamless tiling pattern so the edges connect when the fabric is seamed. ` +
      `the design must look intentional and cohesive from edge to edge. ` +
      `Bold cartoon illustration, tropical florals, geometric patterns, galaxy/tie-dye, or themed AOP artwork. ` +
      `No watermarks, print-on-demand ready.`;
  }
  if (type === "pillow") {
    return `${branded}. ` +
      `THROW PILLOW PRINT DESIGN — centered square format: ` +
      `Bold, clean design centered in the canvas with at least 10% white or colored padding on all edges. ` +
      `The design should look beautiful as a decorative home accent — bright colors, clear illustration or typography. ` +
      `CRITICAL TEXT RULE: render ONLY the exact text or subject described in the prompt — no extra phrases. ` +
      `Pure white #FFFFFF or solid colored background. ${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
  }
  if (type === "laptopsleeve") {
    return `${branded}. ` +
      `LAPTOP SLEEVE / LAPTOP CASE — full-surface print: ` +
      `Bold, modern design that fills the entire rectangular canvas. ` +
      `The design covers the full laptop sleeve surface — use edge-to-edge artwork with minimal or no white margins. ` +
      `CRITICAL TEXT RULE: render ONLY the exact text or subject described in the prompt — no extra phrases. ` +
      `Clean, tech-forward aesthetic appropriate for a work/student accessory. ` +
      `High contrast, vivid colors, no watermarks, print-on-demand ready.`;
  }
  if (type === "wall_decal") {
    return `${branded}. ` +
      `WALL DECAL / VINYL STICKER PRINT: Bold, clean design that fills the printable area. ` +
      `TRANSPARENT BACKGROUND — absolutely no solid white fill outside the design elements. ` +
      `The design will be cut to shape, so use clean crisp outlines with no background rectangle. ` +
      `Keep all key content within the center 85% of the canvas. Bold high-contrast colors. ` +
      `CRITICAL TEXT RULE: render ONLY the exact text described in the prompt — do NOT add extra words. ` +
      `${THUMBNAIL_RULES}No watermarks, print-on-demand ready.`;
  }
  if (type === "puzzle") {
    return `${branded}. ` +
      `JIGSAW PUZZLE FACE DESIGN — FULL-BLEED: the design MUST fill 100% of the canvas edge-to-edge. ` +
      `ZERO white borders. ZERO white padding. ZERO white margin anywhere — the design bleeds completely to every canvas edge (left, right, top, bottom). ` +
      `Bold, colorful illustration with large readable text centered in the canvas. ` +
      `The background of the design (whatever color) must fill the ENTIRE canvas — no white dead space visible anywhere. ` +
      `High contrast, vibrant, eye-catching — puzzle is a gift item and must look impressive at full size. ` +
      `CRITICAL TEXT RULE: render ONLY the exact words described in the prompt — no extra phrases. ` +
      `No watermarks, print-on-demand ready.`;
  }
  return `${branded}. ${FLAT_ARTWORK_RULE}` +
    `Pure white #FFFFFF background only — no cream, no off-white, no gradients. ` +
    `Entire subject fully visible, centered, with at least 15% white padding on every edge — ` +
    `nothing cropped or touching frame borders. ` +
    `CRITICAL: render ONLY the exact text described in the prompt — do NOT add extra words or phrases. ` +
    `${THUMBNAIL_RULES}High contrast, clean edges, no watermarks, print-on-demand ready.`;
}

// Checks the first 40 decoded bytes of a b64 PNG/JPEG for an alpha channel.
// PNG color type 4 (grayscale+alpha) or 6 (RGBA) = has transparency.
// JPEGs never have alpha. Returns true if transparency detected.
function hasAlphaChannel(b64: string): boolean {
  try {
    const raw = atob(b64.slice(0, 56)); // 56 chars → 42 bytes, enough for PNG IHDR
    const b0 = raw.charCodeAt(0), b1 = raw.charCodeAt(1);
    if (b0 === 0xFF && b1 === 0xD8) return false; // JPEG — no alpha possible
    if (b0 !== 0x89 || b1 !== 0x50) return false;  // not PNG — assume OK
    const colorType = raw.charCodeAt(25);            // PNG IHDR color type byte
    return colorType === 4 || colorType === 6;       // grayscale+alpha or RGBA
  } catch { return false; }
}

async function scoreImageQuality(b64: string, niche: string, type: ProductType): Promise<{ score: number; reason: string }> {
  if (!OPENAI_KEY) return { score: 5, reason: "no key" };
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${b64.slice(0, 500000)}` }, // cap at ~375KB decoded
            },
            {
              type: "text",
              text: `Score this print-on-demand ${type} design for the niche "${niche}" on a scale of 1-5.\n\nHARD FAIL RULES (score MUST be 1 if any of these are true):\n${(["croptop","tanktop","leggings","joggers","sock"] as string[]).includes(type) ? "- Background is transparent, white, or nearly empty (AOP garments and socks MUST have a full-color vibrant design covering the entire canvas — white or light backgrounds are invisible on the product)" : (["wineglass","pintglass","shotglass","candle"] as string[]).includes(type) ? "- The image shows a 3D product rendering/mockup instead of flat label artwork (score MUST be 1 if you see a 3D glass or candle jar in the image)" : "- Background is ANY color other than pure white (yellow, orange, amber, red, blue, tan, cream = automatic score 1)"}\n${type === "sock" ? "- Design is split into two separate halves (left half different from right half) — socks require ONE unified pattern\n- Any large blank or undecorated areas visible (elements must fill corner-to-corner, top-to-bottom)\n" : ""}- Any text is clipped, wrapped around edges, or unreadable\n- Design contains hallucinated/wrong text not matching the niche\n- Text uses thin script, cursive, or hairline fonts that would be illegible at 200px thumbnail size\n\nIf no hard fails, score 1-5 on: design fills the canvas corner-to-corner, niche match, overall print quality.\n\nReply ONLY with JSON: {"score":N,"reason":"one sentence"}${(["mug","tumbler","tumbler40","travelmug"] as string[]).includes(type) ? "\nALSO CHECK: Is the design tiny — occupying less than 40% of the canvas area (postage-stamp sized)? If yes, score MUST be 1. The design must fill most of the canvas boldly." : (["wineglass","pintglass","shotglass"] as string[]).includes(type) ? "\nALSO CHECK: Does the design show a 3D rendering of the glass product itself (a picture of a glass)? If yes, score MUST be 1. The design must be FLAT LABEL ARTWORK ONLY — a colored rectangle or shape with bold text, NOT a product photo." : (["hoodie","tshirt","sweatshirt","longsleeve"] as string[]).includes(type) ? "\nALSO CHECK: Is any text or graphic element touching or within 5% of any image edge? If yes, score MUST be 1." : (["candle"] as string[]).includes(type) ? "\nALSO CHECK: Does the image show a 3D candle or jar? If yes, score MUST be 1. The design must be flat label artwork only." : ""}`,
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { score: 5, reason: `vision API ${res.status}` };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content.match(/\{.*\}/s)?.[0] ?? "{}");
    return { score: Number(parsed.score) || 5, reason: parsed.reason ?? "" };
  } catch {
    return { score: 5, reason: "vision check failed" };
  }
}

async function generateImage(prompt: string, type: ProductType): Promise<string> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not set");

  let bestB64 = "";
  let bestScore = -1;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: buildPrompt(prompt, type),
        n: 1,
        // Socks need tall portrait (1024×1536) to fill the ~1:3 sock leg print area.
        // All other product types use square (1024×1024).
        size: type === "sock" ? "1024x1536" : "1024x1024",
        quality: "medium",
        background: "opaque",
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Image gen ${res.status}: ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 returned no image data");
    if (hasAlphaChannel(b64)) {
      console.warn(`Attempt ${attempt}: image has alpha channel (transparent bg) — retrying...`);
      continue;
    }
    const { score, reason } = await scoreImageQuality(b64, prompt, type);
    console.log(`Attempt ${attempt}: quality score ${score}/5 — ${reason}`);
    if (score > bestScore) {
      bestScore = score;
      bestB64 = b64;
    }
    if (score >= 4) {
      return b64;
    }
    console.warn(`Attempt ${attempt}: score ${score} < 4 — retrying for better quality...`);
  }

  if (!bestB64) throw new Error("Could not generate opaque image after 5 attempts");
  if (bestScore <= 2) throw new Error(`Image quality too low after 5 attempts (best ${bestScore}/5) for "${prompt}" — skipping`);
  if (bestScore === 3) console.warn(`LOW-QUALITY WARNING: publishing score=3/5 for "${prompt}" type=${type} — review manually`);
  return bestB64;
}

// Variant of generateImage that uses transparent background — for apparel on dark-colored fabric.
// The fabric color shows through wherever there is no ink, avoiding the white-box-on-dark-shirt bug.
async function generateImageTransparent(prompt: string, type: ProductType): Promise<string> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not set");

  let bestB64 = "";
  let bestScore = -1;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: buildPrompt(prompt, type),
        n: 1,
        size: "1024x1024",
        quality: "medium",
        background: "transparent",
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Image gen ${res.status}: ${err.slice(0, 300)}`);
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 returned no image data");
    // Transparent background is expected — do not reject alpha channel
    const { score, reason } = await scoreImageQuality(b64, prompt, type);
    console.log(`Attempt ${attempt}: quality score ${score}/5 — ${reason}`);
    if (score > bestScore) {
      bestScore = score;
      bestB64 = b64;
    }
    if (score >= 4) return b64;
    console.warn(`Attempt ${attempt}: score ${score} < 4 — retrying for better quality...`);
  }

  if (!bestB64) throw new Error("Could not generate transparent image after 5 attempts");
  if (bestScore <= 2) throw new Error(`Image quality too low after 5 attempts (best ${bestScore}/5) for "${prompt}" — skipping`);
  if (bestScore === 3) console.warn(`LOW-QUALITY WARNING: publishing score=3/5 for "${prompt}" type=${type} — review manually`);
  return bestB64;
}

async function sortMockupImages(shopId: string, productId: string): Promise<void> {
  try {
    const detail = await pFetch(`/shops/${shopId}/products/${productId}.json`);
    if (!detail.ok) return;
    const prod = await detail.json() as Record<string, unknown>;
    const images = Array.isArray(prod.images)
      ? prod.images as Array<{ id: string; position?: string; is_default?: boolean }>
      : [];
    if (images.length <= 1) return;
    const sorted = [
      ...images.filter(i => i.is_default),
      ...images.filter(i => !i.is_default && i.position === "front"),
      ...images.filter(i => !i.is_default && i.position !== "front"),
    ];
    const ids = [...new Set(sorted.map(i => i.id))];
    await pFetch(`/shops/${shopId}/products/${productId}/images/sort.json`, {
      method: "POST",
      body: JSON.stringify({ sort_order: ids }),
    });
  } catch (e) {
    console.warn("sortMockupImages skipped:", (e as Error).message.slice(0, 80));
  }
}

async function uploadImageToPrintify(b64Image: string, filename: string): Promise<string> {
  const res = await pFetch("/uploads/images.json", {
    method: "POST",
    body: JSON.stringify({ file_name: filename, contents: b64Image }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload error: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function deleteProduct(shopId: string, productId: string): Promise<void> {
  await pFetch(`/shops/${shopId}/products/${productId}.json`, { method: "DELETE" });
}

Deno.serve(async (req) => {
  if (!PRINTIFY_KEY) return Response.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });

  type PrintifyProduct = {
    id: string;
    title: string;
    description: string;
    blueprint_id: number;
    variants: Array<Record<string, unknown>>;
    external: { id?: string; handle?: string } | null;
  };

  async function fetchAllProducts(shopId: string): Promise<PrintifyProduct[]> {
    const all: PrintifyProduct[] = [];
    let page = 1;
    while (true) {
      const res = await pFetch(`/shops/${shopId}/products.json?page=${page}&limit=50`);
      const text = await res.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { break; }
      if (!res.ok) break;
      const items = Array.isArray(data.data) ? data.data as PrintifyProduct[] : [];
      all.push(...items);
      if (page >= (data.last_page as number) || items.length === 0) break;
      page++;
    }
    return all;
  }

  // GET — list all products with publish status
  if (req.method === "GET") {
    try {
      const shopId = await getShopId();
      const all = await fetchAllProducts(shopId);
      const products = all.map((p) => ({
        id: p.id,
        title: p.title,
        blueprint_id: p.blueprint_id,
        published: !!(p.external?.id),
        etsyId: p.external?.id ?? null,
      }));
      return Response.json({
        shopId,
        total: products.length,
        unpublishedCount: products.filter((p) => !p.published).length,
        products,
      });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  if (req.method !== "POST") return new Response("POST to trigger product creation.", { status: 405 });

  let startIndex = 0;
  let count = 0;
  let deleteIds: string[] = [];
  let patchTitlesInput: Array<{id: string; title: string}> = [];
  let patchPricesByBlueprint: { blueprintId: number; newPriceCents: number } | null = null;
  let publishIdsInput: string[] = [];
  let customProduct: TrendingProduct | null = null;
  let queueId: number | null = null;       // optional: pod_product_queue row to write etsy_listing_id back to
  let explicitCount = false;
  let publishAll = false;
  let updateAll = false;
  let updateOffset = 0;
  let imageRefresh = false;
  let imageRefreshOffset = 0;
  let repairMugs = false;
  let repairMugsOffset = 0;
  let repairProductIds: string[] = [];
  let repairApparel = false;
  let repairApparelOffset = 0;
  let repairCylindrical = false;
  let repairCylindricalOffset = 0;
  let repairMousepads = false;
  let repairMousepadsOffset = 0;
  let repairBlankets = false;
  let repairBlanketsOffset = 0;
  let repairTravelMugs = false;
  let repairTravelMugsOffset = 0;
  let repairOnesies = false;
  let repairOnesiesOffset = 0;
  let repairJournals = false;
  let repairJournalsOffset = 0;
  let repairCoasters = false;
  let repairCoastersOffset = 0;
  let repairOrnaments = false;
  let repairOrnamentsOffset = 0;
  let repairPetbandanas = false;
  let repairPetbandanasOffset = 0;
  let repairPosters = false;
  let repairPostersOffset = 0;
  let repairPuzzles = false;
  let repairPuzzlesOffset = 0;
  let listRecent = false;
  let listRecentPage = 1;
  let blueprintInfoId = 0;

  try {
    const body = await req.json().catch(() => ({}));
    if (body.blueprintInfo) blueprintInfoId = parseInt(String(body.blueprintInfo), 10);
    if (body.publishAll === true) publishAll = true;
    if (body.updateAll === true) { updateAll = true; updateOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.imageRefresh === true) { imageRefresh = true; imageRefreshOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairMugs === true) { repairMugs = true; repairMugsOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (Array.isArray(body.repairProductIds)) repairProductIds = body.repairProductIds;
    if (body.repairApparel === true) { repairApparel = true; repairApparelOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairCylindrical === true) { repairCylindrical = true; repairCylindricalOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairMousepads === true) { repairMousepads = true; repairMousepadsOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairBlankets === true) { repairBlankets = true; repairBlanketsOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairTravelMugs === true) { repairTravelMugs = true; repairTravelMugsOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairOnesies === true) { repairOnesies = true; repairOnesiesOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairJournals === true) { repairJournals = true; repairJournalsOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairCoasters === true) { repairCoasters = true; repairCoastersOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairOrnaments === true) { repairOrnaments = true; repairOrnamentsOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairPetbandanas === true) { repairPetbandanas = true; repairPetbandanasOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairPosters === true) { repairPosters = true; repairPostersOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.repairPuzzles === true) { repairPuzzles = true; repairPuzzlesOffset = typeof body.offset === "number" ? body.offset : 0; }
    if (body.listRecent === true) { listRecent = true; listRecentPage = typeof body.page === "number" ? body.page : 1; }
    if (body.getShippingInfo === true) {
      // Fetch the last published product's full detail to inspect shipping template structure
      const sid = await getShopId();
      const pageRes = await pFetch(`/shops/${sid}/products.json?page=1&limit=5`);
      const pageData = await pageRes.json() as Record<string, unknown>;
      const items = Array.isArray(pageData.data) ? pageData.data as Array<{id:string;title:string;external?:unknown}> : [];
      // Also try Printify shipping endpoint
      const shipRes = await pFetch(`/shops/${sid}/shipping.json`).catch(() => null);
      const shipData = shipRes ? await shipRes.json().catch(() => null) : null;
      // Get full detail of the first product that is published (has external id)
      const published = items.find((p) => (p.external as Record<string,unknown>|undefined)?.id);
      let fullProduct = null;
      if (published) {
        const detailRes = await pFetch(`/shops/${sid}/products/${published.id}.json`);
        fullProduct = await detailRes.json();
      }
      return Response.json({
        shippingEndpoint: { status: shipRes?.status, data: shipData },
        sampleProduct: fullProduct ? {
          id: (fullProduct as Record<string,unknown>).id,
          title: (fullProduct as Record<string,unknown>).title,
          external: (fullProduct as Record<string,unknown>).external,
          sales_channel_properties: (fullProduct as Record<string,unknown>).sales_channel_properties,
        } : null,
      });
    }
    if (body.listBlueprints === true) {
      // Fetch all pages from Printify catalog and return the full list
      const allBlueprints: Array<{ id: number; title: string; brand: string; model: string }> = [];
      let page = 1;
      while (true) {
        const bpRes = await pFetch(`/catalog/blueprints.json?page=${page}&limit=50`);
        if (!bpRes.ok) break;
        const bpData = await bpRes.json() as Record<string, unknown>;
        const items = Array.isArray(bpData.data) ? bpData.data as Array<{ id: number; title: string; brand: string; model: string }> : (Array.isArray(bpData) ? bpData as Array<{ id: number; title: string; brand: string; model: string }> : []);
        allBlueprints.push(...items);
        const lastPage = typeof bpData.last_page === "number" ? bpData.last_page : 1;
        if (page >= lastPage || items.length === 0) break;
        page++;
      }
      return Response.json({ total: allBlueprints.length, blueprints: allBlueprints });
    }
    if (typeof body.queueId === "number") queueId = body.queueId;
    if (body.product && typeof body.product === "object") {
      customProduct = body.product as TrendingProduct;
    } else {
      if (typeof body.startIndex === "number") startIndex = body.startIndex;
      if (typeof body.count === "number") { count = body.count; explicitCount = true; }
    }
    if (Array.isArray(body.deleteIds)) deleteIds = body.deleteIds;
    if (Array.isArray(body.patchTitles)) patchTitlesInput = body.patchTitles as Array<{id: string; title: string}>;
    if (Array.isArray(body.publishIds)) publishIdsInput = body.publishIds as string[];
    if (body.patchPricesByBlueprint && typeof body.patchPricesByBlueprint === "object") {
      const pp = body.patchPricesByBlueprint as Record<string, unknown>;
      if (typeof pp.blueprintId === "number" && typeof pp.newPriceCents === "number") patchPricesByBlueprint = { blueprintId: pp.blueprintId, newPriceCents: pp.newPriceCents };
    }
  } catch { /* no body */ }

  let shopId: string;
  try {
    shopId = await getShopId();
  } catch (e) {
    return Response.json({ error: `Shop fetch failed: ${(e as Error).message}` }, { status: 500 });
  }

  // ——— blueprintInfo: discover provider details + print area positions for a blueprint ———
  if (blueprintInfoId) {
    const bpRes = await pFetch(`/catalog/blueprints/${blueprintInfoId}.json`);
    const bpData = await bpRes.json();
    // Try to get the provider ID from env vars for this blueprint type
    const typeEntry = Object.entries(PRODUCT_CONFIG).find(([, cfg]) => {
      const envId = parseInt(Deno.env.get(cfg.blueprintEnv) ?? "", 10) || cfg.blueprintId;
      return envId === blueprintInfoId;
    });
    const spec = typeEntry ? PRODUCT_CONFIG[typeEntry[0] as ProductType] : null;
    const envProviderId = spec ? Deno.env.get(spec.providerEnv) : null;
    const provRes = await pFetch(`/catalog/blueprints/${blueprintInfoId}/print_providers.json`);
    const provData = await provRes.json();
    const catalogProviders = Array.isArray(provData) ? provData : [];
    // Query provider details for both env provider and first catalog provider
    const providerIdsToCheck = [...new Set([
      envProviderId ? parseInt(envProviderId, 10) : null,
      catalogProviders[0]?.id,
    ].filter(Boolean))] as number[];
    const providerDetails: Record<number, unknown> = {};
    for (const pid of providerIdsToCheck) {
      const pdRes = await pFetch(`/catalog/blueprints/${blueprintInfoId}/print_providers/${pid}.json`);
      providerDetails[pid] = await pdRes.json();
    }
    // Also fetch raw variants for first 2 providers to discover placeholder names
    const variantDetails: Record<number, unknown> = {};
    for (const pid of [...providerIdsToCheck, ...(catalogProviders.slice(0, 2).map((p: { id: number }) => p.id))].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3)) {
      const vdRes = await pFetch(`/catalog/blueprints/${blueprintInfoId}/print_providers/${pid}/variants.json`);
      variantDetails[pid] = await vdRes.json();
    }
    return Response.json({ blueprintId: blueprintInfoId, envProviderId, blueprint: { id: bpData.id, title: bpData.title }, catalogProviders: catalogProviders.slice(0, 3), providerDetails, variantDetails });
  }

  // ——— listRecent: lightweight page fetch — returns title, id, blueprint_id for 20 products ———
  if (listRecent) {
    const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${listRecentPage}&limit=20`);
    if (!pageRes.ok) return Response.json({ error: `Fetch failed: ${pageRes.status}` }, { status: 500 });
    const pageData = await pageRes.json() as Record<string, unknown>;
    const items = Array.isArray(pageData.data) ? pageData.data as PrintifyProduct[] : [];
    return Response.json({
      page: listRecentPage,
      total: pageData.total,
      products: items.map((p) => ({ id: p.id, title: p.title, blueprint_id: p.blueprint_id, published: !!p.external?.id })),
    });
  }

  // ——— publishAll: find every unpublished product, deduplicate, publish all ———
  if (publishAll) {
    const all = await fetchAllProducts(shopId);
    const unpublished = all.filter((p) => !p.external?.id);

    const seen = new Set<string>();
    const toPublish: PrintifyProduct[] = [];
    const skipped: string[] = [];
    for (const p of unpublished) {
      const key = p.title.toLowerCase().trim();
      if (!seen.has(key)) { seen.add(key); toPublish.push(p); }
      else skipped.push(p.id);
    }

    for (const id of skipped) {
      try { await deleteProduct(shopId, id); } catch { /* best effort */ }
    }

    if (toPublish.length > 0) {
      console.log(`Publishing ${toPublish.length} products (waiting 60s for mockups first)...`);
      await new Promise((r) => setTimeout(r, 60_000));
    }

    const pubResults: Array<{ id: string; title: string; status: string; error?: string }> = [];
    for (const p of toPublish) {
      try {
        const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
          method: "POST",
          body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: false }),
        });
        if (!pubRes.ok) throw new Error(await pubRes.text());
        pubResults.push({ id: p.id, title: p.title, status: "published" });
      } catch (e) {
        pubResults.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message.slice(0, 200) });
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }

    const succeeded = pubResults.filter((r) => r.status === "published").length;
    return Response.json({
      total: all.length,
      alreadyPublished: all.length - unpublished.length,
      duplicatesDeleted: skipped.length,
      attempted: toPublish.length,
      succeeded,
      failed: toPublish.length - succeeded,
      results: pubResults,
    });
  }

  // ——— publishIds: publish specific products by Printify ID (targeted, skips 60s wait) ———
  if (publishIdsInput.length > 0) {
    const pubResults: Array<{id: string; status: string; etsyId?: string; error?: string}> = [];
    for (const id of publishIdsInput) {
      try {
        // Enable free shipping first (worldwide, fall back to US-only if rejected)
        const freeShipResWW = await pFetch(`/shops/${shopId}/products/${id}.json`, {
          method: "PUT",
          body: JSON.stringify({ sales_channel_properties: { free_shipping: true, free_shipping_applies_to: "all" } }),
        });
        if (!freeShipResWW.ok) {
          const fallback = await pFetch(`/shops/${shopId}/products/${id}.json`, { method: "PUT", body: JSON.stringify({ sales_channel_properties: { free_shipping: true } }) });
          if (!fallback.ok) console.warn(`Free shipping failed ${id}: ${fallback.status}`);
          else console.warn(`free_shipping_applies_to:all rejected for ${id} — fell back to US-only`);
        }
        await new Promise((r) => setTimeout(r, 2_000));

        const pubRes = await pFetch(`/shops/${shopId}/products/${id}/publish.json`, {
          method: "POST",
          body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: false }),
        });
        if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 300)}`);
        await new Promise((r) => setTimeout(r, 5_000));

        // Read back the product to get the new Etsy ID
        const detailRes = await pFetch(`/shops/${shopId}/products/${id}.json`);
        const detail = detailRes.ok ? await detailRes.json() as {external?: {id?: string}} : null;
        const etsyId = detail?.external?.id ?? undefined;

        pubResults.push({ id, status: "published", etsyId });
        console.log(`Published ${id} → etsyId ${etsyId}`);
      } catch (e) {
        pubResults.push({ id, status: "error", error: (e as Error).message });
        console.error(`Publish failed ${id}: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 3_000));
    }
    return Response.json({
      attempted: publishIdsInput.length,
      succeeded: pubResults.filter((r) => r.status === "published").length,
      results: pubResults,
    });
  }

  // ——— updateAll: AI-optimize SEO + fix prices on all existing listings, 5 at a time ———
  if (updateAll) {
    // Fetch only the Printify page containing this offset (avoids loading all products into memory)
    const batchSize = 3;
    const printifyPage = Math.floor(updateOffset / 50) + 1;
    const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
    if (!pageRes.ok) return Response.json({ error: `Page fetch failed: ${pageRes.status}` }, { status: 500 });
    const pageData = await pageRes.json() as Record<string, unknown>;
    const pageItems = Array.isArray(pageData.data) ? pageData.data as PrintifyProduct[] : [];
    const totalProducts = typeof pageData.total === "number" ? pageData.total : pageItems.length;
    const pageOffset = updateOffset % 50;
    const batch = pageItems.slice(pageOffset, pageOffset + batchSize);
    const results: Array<{ id: string; title: string; newTitle?: string; status: string; error?: string }> = [];

    for (const p of batch) {
      try {
        // Fetch full product detail (list endpoint omits variants)
        const detailRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`);
        if (!detailRes.ok) throw new Error(`Detail fetch ${detailRes.status}`);
        const detail = await detailRes.json() as PrintifyProduct;

        const type = detectType(detail.blueprint_id);

        // AI-optimize listing
        const optimized = await optimizeListing(detail.title, type, detail.description ?? "");

        // Update all variant prices to the correct final price
        const updatedVariants = (detail.variants ?? []).map((v) => ({ ...v, price: FINAL_PRICES[type] }));

        // PATCH product
        const patchRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`, {
          method: "PUT",
          body: JSON.stringify({
            title: optimized.title,
            description: optimized.description,
            tags: optimized.tags,
            variants: updatedVariants,
          }),
        });
        if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);

        // Enable free worldwide shipping
        await pFetch(`/shops/${shopId}/products/${p.id}.json`, {
          method: "PUT",
          body: JSON.stringify({ sales_channel_properties: { free_shipping: true, free_shipping_applies_to: "all" } }),
        }).catch(() => null);

        // Re-publish to Etsy if already live (syncs changes to existing listing)
        if (p.external?.id) {
          const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
            method: "POST",
            body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
          });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 10_000)); // 10s between publishes to avoid Etsy rate limit
        }

        results.push({ id: p.id, title: p.title, newTitle: optimized.title, status: "updated" });
        console.log(`Updated: ${p.title} → ${optimized.title}`);
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
        console.error(`Failed update: ${p.title} — ${(e as Error).message}`);
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    const nextOffset = updateOffset + batch.length < totalProducts ? updateOffset + batch.length : null;

    return Response.json({
      total: totalProducts,
      processed: batch.length,
      offset: updateOffset,
      nextOffset,
      callNext: nextOffset !== null ? `POST {"updateAll":true,"offset":${nextOffset}}` : null,
      succeeded: results.filter((r) => r.status === "updated").length,
      failed: results.filter((r) => r.status === "error").length,
      results,
    });
  }

  // ——— imageRefresh: re-publish all live products to push full Printify mockup set to Etsy ———
  if (imageRefresh) {
    const batchSize = 7;
    const printifyPage = Math.floor(imageRefreshOffset / 50) + 1;
    const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
    if (!pageRes.ok) return Response.json({ error: `Page fetch failed: ${pageRes.status}` }, { status: 500 });
    const pageData = await pageRes.json() as Record<string, unknown>;
    const pageItems = Array.isArray(pageData.data) ? pageData.data as PrintifyProduct[] : [];
    const totalProducts = typeof pageData.total === "number" ? pageData.total : pageItems.length;
    const pageOffset = imageRefreshOffset % 50;
    const batch = pageItems.slice(pageOffset, pageOffset + batchSize).filter((p) => p.external?.id);
    const results: Array<{ id: string; title: string; status: string; error?: string }> = [];

    for (const p of batch) {
      try {
        const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
          method: "POST",
          body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
        });
        if (!pubRes.ok) throw new Error(`${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
        results.push({ id: p.id, title: p.title, status: "refreshed" });
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }

    const nextOffset = imageRefreshOffset + batchSize < totalProducts ? imageRefreshOffset + batchSize : null;
    return Response.json({
      total: totalProducts,
      processed: batch.length,
      offset: imageRefreshOffset,
      nextOffset,
      callNext: nextOffset !== null ? `POST {"imageRefresh":true,"offset":${nextOffset}}` : null,
      succeeded: results.filter((r) => r.status === "refreshed").length,
      results,
    });
  }

  // ——— repairMugs: regenerate ALL mug print images with correct scale (fixes Lovable's bad designs too) ———
  if (repairMugs) {
    const batchSize = 1; // 1 mug per call: ~40s process + 60s wait + ~5s publish = ~105s (safe under 150s limit)
    const printifyPage = Math.floor(repairMugsOffset / 50) + 1;
    const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
    if (!pageRes.ok) return Response.json({ error: `Page fetch failed: ${pageRes.status}` }, { status: 500 });
    const pageData = await pageRes.json() as Record<string, unknown>;
    const pageItems = Array.isArray(pageData.data) ? pageData.data as PrintifyProduct[] : [];
    const totalProducts = typeof pageData.total === "number" ? pageData.total : pageItems.length;
    const pageOffset = repairMugsOffset % 50;
    // Only target mugs (blueprint_id=68)
    const allInPage = pageItems.slice(pageOffset, pageOffset + batchSize);
    const mugBatch = allInPage.filter((p) => p.blueprint_id === 68);
    const skipped = allInPage.length - mugBatch.length;
    const results: Array<{ id: string; title: string; status: string; error?: string }> = [];

    // Phase 1: Generate + upload + PATCH all mugs
    const repaired: Array<PrintifyProduct> = [];
    for (const p of mugBatch) {
      try {
        // Generate a new image prompt from the product title using AI
        const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: `Create a concise image generation prompt for a print-on-demand mug design based on this product title: "${p.title}". The design should be simple, bold, and iconic — suitable for a coffee mug. Return ONLY the image prompt, no other text. Keep it under 100 words. Focus on the key humor/message. No photo-realistic elements — clean graphic/illustration style.` }],
            temperature: 0.7,
            max_tokens: 150,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!promptRes.ok) throw new Error(`Prompt gen failed: ${promptRes.status}`);
        const promptData = await promptRes.json();
        const imagePrompt = promptData.choices?.[0]?.message?.content?.trim() ?? p.title;

        // Generate new image with strict mug constraints
        const b64Image = await generateImage(imagePrompt, "mug");
        const imageId = await uploadImageToPrintify(b64Image, `mug-repair-${Date.now()}.png`);

        // Fetch full product detail to get variant IDs
        const detailRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`);
        if (!detailRes.ok) throw new Error(`Detail fetch ${detailRes.status}`);
        const detail = await detailRes.json() as PrintifyProduct;
        const variantIds = (detail.variants ?? []).map((v) => (v as Record<string, unknown>).id as number);

        // PATCH product with new image at scale=0.30
        const patchRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`, {
          method: "PUT",
          body: JSON.stringify({
            print_areas: [{
              variant_ids: variantIds,
              placeholders: [{ position: "front", images: [{ id: imageId, x: 0.5, y: 0.5, scale: 0.30, angle: 0 }] }],
            }],
          }),
        });
        if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);

        repaired.push(p);
        console.log(`Patched mug: ${p.title}`);
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
        console.error(`Repair failed: ${p.title} — ${(e as Error).message}`);
      }
    }

    // Phase 2: Wait once for all mockups to regenerate
    if (repaired.length > 0) {
      await new Promise((r) => setTimeout(r, 60_000));
    }

    // Phase 3: Re-publish repaired mugs to Etsy
    for (const p of repaired) {
      try {
        if (p.external?.id) {
          const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
            method: "POST",
            body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
          });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 3_000));
        }
        results.push({ id: p.id, title: p.title, status: "repaired" });
        console.log(`Repaired mug: ${p.title}`);
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
      }
    }

    const nextOffset = repairMugsOffset + batchSize < totalProducts ? repairMugsOffset + batchSize : null;
    return Response.json({
      total: totalProducts,
      processed: mugBatch.length,
      skipped,
      offset: repairMugsOffset,
      nextOffset,
      callNext: nextOffset !== null ? `POST {"repairMugs":true,"offset":${nextOffset}}` : null,
      succeeded: results.filter((r) => r.status === "repaired").length,
      results,
    });
  }

  // ——— repairProductIds: surgically repair specific products by Printify product ID ———
  if (repairProductIds.length > 0) {
    const MUG_BLUEPRINT_IDS = new Set([68]);
    const CYLINDRICAL_IDS = new Set([353, 70, 1509, 1250, 633, 787, 755]);
    const APPAREL_IDS = new Set([12, 77, 49, 41]);
    const ONESIE_JOURNAL_IDS = new Set([568, 75]);
    // All other supported blueprints — petbandana, coaster, ornament, poster, mousepad, puzzle, hat, etc.
    const SPECIALTY_IDS = new Set([562, 480, 530, 852, 608, 611, 1447, 1446, 238, 400, 1572, 627, 1062, 429, 365]);
    const results: Array<{ id: string; title: string; status: string; error?: string }> = [];
    const repaired: Array<{ id: string; title: string; bp: number }> = [];

    for (const productId of repairProductIds) {
      try {
        const detailRes = await pFetch(`/shops/${shopId}/products/${productId}.json`);
        if (!detailRes.ok) throw new Error(`Fetch failed: ${detailRes.status}`);
        const product = await detailRes.json() as PrintifyProduct;
        const bp = product.blueprint_id;
        const variantIds = (product.variants ?? []).map((v) => (v as Record<string, unknown>).id as number);

        const isMug = MUG_BLUEPRINT_IDS.has(bp);
        const isCylindrical = CYLINDRICAL_IDS.has(bp);
        const isApparel = APPAREL_IDS.has(bp);
        const isOnesieOrJournal = ONESIE_JOURNAL_IDS.has(bp);
        const isSpecialty = SPECIALTY_IDS.has(bp);

        if (!isMug && !isCylindrical && !isApparel && !isOnesieOrJournal && !isSpecialty) {
          results.push({ id: productId, title: product.title, status: "skipped", error: `blueprint ${bp} not repairable via this mode` });
          continue;
        }

        const productType = detectType(bp);
        const cfg = PRODUCT_CONFIG[productType];
        const scale = cfg?.scale ?? (isMug || isCylindrical ? 0.30 : 1.0);

        const repairPromptInstruction = bp === 568
          ? `Create a concise image generation prompt for FLAT GRAPHIC DESIGN artwork for a baby onesie/bodysuit chest print based on this product title: "${product.title}". Return ONLY the image prompt, no other text. Keep it under 80 words. Describe ONLY the cute illustration and typography — do NOT mention the onesie, baby, or product itself.`
          : bp === 75
          ? `Create a concise image generation prompt for a JOURNAL FRONT COVER design based on this product title: "${product.title}". Return ONLY the image prompt, no other text. Keep it under 80 words. Describe ONLY the front cover design elements (typography, illustration, colors). Do NOT mention the journal or product itself. The design is for the front cover only — NOT the spine.`
          : `Create a concise image generation prompt for a print-on-demand ${productType} design based on this product title: "${product.title}". The design should be simple, bold, and iconic. Return ONLY the image prompt, no other text. Keep it under 100 words. Focus on the key humor/message. No photo-realistic elements — clean graphic/illustration style.`;
        const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: repairPromptInstruction }],
            temperature: 0.7,
            max_tokens: 150,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!promptRes.ok) throw new Error(`Prompt gen failed: ${promptRes.status}`);
        const promptData = await promptRes.json();
        const imagePrompt = promptData.choices?.[0]?.message?.content?.trim() ?? product.title;

        const TRANSPARENT_REPAIR_TYPES = new Set(["tshirt","hoodie","sweatshirt","longsleeve","onesie","hat","truckercap"]);
        const b64Image = TRANSPARENT_REPAIR_TYPES.has(productType)
          ? await generateImageTransparent(imagePrompt, productType)
          : await generateImage(imagePrompt, productType);
        const imageId = await uploadImageToPrintify(b64Image, `${productType}-repair-${Date.now()}.png`);

        // Read existing print_area positions from the live product so we cover ALL slots,
        // not just the hardcoded config (which would leave old images in non-"front" positions).
        const existingPositions: string[] = [];
        for (const pa of ((product as Record<string, unknown>).print_areas as Array<Record<string, unknown>> ?? [])) {
          for (const ph of (pa.placeholders as Array<{ position: string }> ?? [])) {
            if (ph.position && !existingPositions.includes(ph.position)) existingPositions.push(ph.position);
          }
        }
        const placeholders = existingPositions.length > 0 ? existingPositions : (cfg?.placeholders ?? ["front"]);
        const patchRes = await pFetch(`/shops/${shopId}/products/${productId}.json`, {
          method: "PUT",
          body: JSON.stringify({
            print_areas: [{
              variant_ids: variantIds,
              placeholders: placeholders.map((pos) => ({ position: pos, images: [{ id: imageId, x: 0.5, y: 0.5, scale, angle: 0 }] })),
            }],
          }),
        });
        if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);

        repaired.push({ id: productId, title: product.title, bp });
        console.log(`Patched product: ${product.title} (bp=${bp}, scale=${scale})`);
      } catch (e) {
        results.push({ id: productId, title: "", status: "error", error: (e as Error).message });
        console.error(`repairProductIds failed ${productId}: ${(e as Error).message}`);
      }
    }

    // Wait for mockups to regenerate
    if (repaired.length > 0) await new Promise((r) => setTimeout(r, 60_000));

    // Re-publish each repaired product
    for (const p of repaired) {
      try {
        const detailRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`);
        const detail = await detailRes.json() as PrintifyProduct;
        if (detail.external?.id) {
          const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
            method: "POST",
            body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
          });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}`);
          await new Promise((r) => setTimeout(r, 3_000));
        }
        results.push({ id: p.id, title: p.title, status: "repaired" });
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
      }
    }

    return Response.json({
      repaired: results.filter((r) => r.status === "repaired").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
    });
  }

  // ——— repairApparel: regenerate ALL apparel images with opaque background + scale=0.85 ———
  // Covers tshirt (12), hoodie (77), sweatshirt (49), longsleeve (41)
  if (repairApparel) {
    const APPAREL_BLUEPRINT_IDS = new Set([12, 77, 49, 41]);
    const batchSize = 2; // 2 per call: ~40s generate each + 30s mockup wait ≈ 110s (safe under 150s)
    const printifyPage = Math.floor(repairApparelOffset / 50) + 1;
    const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
    if (!pageRes.ok) return Response.json({ error: `Page fetch failed: ${pageRes.status}` }, { status: 500 });
    const pageData = await pageRes.json() as Record<string, unknown>;
    const pageItems = Array.isArray(pageData.data) ? pageData.data as PrintifyProduct[] : [];
    const totalProducts = typeof pageData.total === "number" ? pageData.total : pageItems.length;
    const pageOffset = repairApparelOffset % 50;
    const allInPage = pageItems.slice(pageOffset, pageOffset + batchSize);
    const apparelBatch = allInPage.filter((p) => APPAREL_BLUEPRINT_IDS.has(p.blueprint_id));
    const results: Array<{ id: string; title: string; status: string; error?: string }> = [];
    const repaired: Array<PrintifyProduct> = [];

    // Phase 1: Regenerate image + PATCH each product
    for (const p of apparelBatch) {
      try {
        const type = detectType(p.blueprint_id);
        // Generate a fresh image prompt from the product title
        const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: `Create a concise image generation prompt for FLAT GRAPHIC DESIGN artwork based on this product title: "${p.title}". The design will be printed on a ${type} garment with a pure white opaque background. Return ONLY the image prompt, no other text. Keep it under 100 words. CRITICAL: describe ONLY the typography, colors, and illustration elements — do NOT mention or depict the physical garment, product shape. The artwork will have a solid white background with the design centered in the inner 85% of the canvas.` }],
            temperature: 0.7,
            max_tokens: 150,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!promptRes.ok) throw new Error(`Prompt gen failed: ${promptRes.status}`);
        const promptData = await promptRes.json();
        const imagePrompt = promptData.choices?.[0]?.message?.content?.trim() ?? p.title;

        // Use transparent background so fabric color shows through wherever there is no ink
        const b64Image = await generateImageTransparent(imagePrompt, type);
        const imageId = await uploadImageToPrintify(b64Image, `${type}-repair-${Date.now()}.png`);

        // Fetch full product for variant IDs
        const detailRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`);
        if (!detailRes.ok) throw new Error(`Detail fetch ${detailRes.status}`);
        const detail = await detailRes.json() as PrintifyProduct;
        const variantIds = (detail.variants ?? []).map((v) => v.id as number);
        const cfg = PRODUCT_CONFIG[type];

        const patchRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`, {
          method: "PUT",
          body: JSON.stringify({
            print_areas: [{
              variant_ids: variantIds,
              placeholders: cfg.placeholders.map((pos) => ({ position: pos, images: [{ id: imageId, x: 0.5, y: 0.5, scale: cfg.scale, angle: 0 }] })),
            }],
          }),
        });
        if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);
        repaired.push(p);
        console.log(`Patched apparel: ${p.title} (type=${type}, scale=${cfg.scale})`);
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
        console.error(`Repair failed: ${p.title} — ${(e as Error).message}`);
      }
    }

    // Phase 2: Wait for Printify to regenerate mockups
    if (repaired.length > 0) await new Promise((r) => setTimeout(r, 30_000));

    // Phase 3: Republish to Etsy
    for (const p of repaired) {
      try {
        if (p.external?.id) {
          const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
            method: "POST",
            body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
          });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 3_000));
        }
        results.push({ id: p.id, title: p.title, status: "repaired" });
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
      }
    }

    const nextOffset = repairApparelOffset + batchSize < totalProducts ? repairApparelOffset + batchSize : null;
    return Response.json({
      total: totalProducts,
      processed: apparelBatch.length,
      skipped: allInPage.length - apparelBatch.length,
      offset: repairApparelOffset,
      nextOffset,
      callNext: nextOffset !== null ? `POST {"repairApparel":true,"offset":${nextOffset}}` : null,
      succeeded: results.filter((r) => r.status === "repaired").length,
      results,
    });
  }

  // ——— repairCylindrical: regenerate cylindrical drinkware/candle designs with tight decal scale ———
  // Targets: tumbler40 (1509), wineglass (1250), pintglass (633), shotglass (787), candle (755)
  if (repairCylindrical) {
    const CYLINDRICAL_BLUEPRINTS = new Map<number, ProductType>([
      [1509, "tumbler40"],
      [1250, "wineglass"],
      [633,  "pintglass"],
      [787,  "shotglass"],
      [755,  "candle"],
    ]);
    const batchSize = 1; // 1 per call: image gen ~40s + 60s mockup wait + publish = ~105s (safe under 150s)
    const printifyPage = Math.floor(repairCylindricalOffset / 50) + 1;
    const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
    if (!pageRes.ok) return Response.json({ error: `Page fetch failed: ${pageRes.status}` }, { status: 500 });
    const pageData = await pageRes.json() as Record<string, unknown>;
    const pageItems = Array.isArray(pageData.data) ? pageData.data as PrintifyProduct[] : [];
    const totalProducts = typeof pageData.total === "number" ? pageData.total : pageItems.length;
    const pageOffset = repairCylindricalOffset % 50;
    const allInPage = pageItems.slice(pageOffset, pageOffset + batchSize);
    const cylindricalBatch = allInPage.filter((p) => CYLINDRICAL_BLUEPRINTS.has(p.blueprint_id));
    const skipped = allInPage.length - cylindricalBatch.length;
    const results: Array<{ id: string; title: string; status: string; error?: string }> = [];
    const repaired: Array<PrintifyProduct> = [];

    for (const p of cylindricalBatch) {
      const type = CYLINDRICAL_BLUEPRINTS.get(p.blueprint_id)!;
      const scale = PRODUCT_CONFIG[type].scale;
      try {
        const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: `Create a concise image generation prompt for FLAT 2D PRINT ARTWORK based on this product title: "${p.title}". The artwork will be printed on a ${type === "candle" ? "rectangular label sticker (candle label)" : `${type} surface`}. Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: describe ONLY the typography, colors, and graphic art elements — do NOT mention or depict the physical product shape (no ${type}, no jar, no flame, no product photo). Flat vector illustration style, bold and colorful.` }],
            temperature: 0.7,
            max_tokens: 120,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!promptRes.ok) throw new Error(`Prompt gen failed: ${promptRes.status}`);
        const promptData = await promptRes.json();
        const imagePrompt = promptData.choices?.[0]?.message?.content?.trim() ?? p.title;

        const b64Image = await generateImage(imagePrompt, type);
        const imageId = await uploadImageToPrintify(b64Image, `${type}-repair-${Date.now()}.png`);

        const detailRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`);
        if (!detailRes.ok) throw new Error(`Detail fetch ${detailRes.status}`);
        const detail = await detailRes.json() as PrintifyProduct;
        const variantIds = (detail.variants ?? []).map((v) => (v as Record<string, unknown>).id as number);

        const patchRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`, {
          method: "PUT",
          body: JSON.stringify({
            print_areas: [{
              variant_ids: variantIds,
              placeholders: [{ position: "front", images: [{ id: imageId, x: 0.5, y: 0.5, scale, angle: 0 }] }],
            }],
          }),
        });
        if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);

        repaired.push(p);
        console.log(`Patched ${type}: ${p.title} (scale=${scale})`);
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
        console.error(`Repair failed: ${p.title} — ${(e as Error).message}`);
      }
    }

    if (repaired.length > 0) await new Promise((r) => setTimeout(r, 60_000));

    for (const p of repaired) {
      try {
        if (p.external?.id) {
          const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
            method: "POST",
            body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
          });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 3_000));
        }
        results.push({ id: p.id, title: p.title, status: "repaired" });
        console.log(`Repaired ${p.title}`);
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
      }
    }

    const nextOffset = repairCylindricalOffset + batchSize < totalProducts ? repairCylindricalOffset + batchSize : null;
    return Response.json({
      total: totalProducts,
      processed: cylindricalBatch.length,
      skipped,
      offset: repairCylindricalOffset,
      nextOffset,
      callNext: nextOffset !== null ? `POST {"repairCylindrical":true,"offset":${nextOffset}}` : null,
      succeeded: results.filter((r) => r.status === "repaired").length,
      results,
    });
  }

  // Helper: generic repair mode for a single blueprint type with opaque background
  async function repairSingleType(
    blueprintId: number,
    productType: ProductType,
    offset: number,
    promptInstruction: string,
  ) {
    const batchSize = 1;
    const printifyPage = Math.floor(offset / 50) + 1;
    const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${printifyPage}&limit=50`);
    if (!pageRes.ok) return Response.json({ error: `Page fetch failed: ${pageRes.status}` }, { status: 500 });
    const pageData = await pageRes.json() as Record<string, unknown>;
    const pageItems = Array.isArray(pageData.data) ? pageData.data as PrintifyProduct[] : [];
    const totalProducts = typeof pageData.total === "number" ? pageData.total : pageItems.length;
    const pageOffset = offset % 50;
    const allInPage = pageItems.slice(pageOffset, pageOffset + batchSize);
    const targetBatch = allInPage.filter((p) => p.blueprint_id === blueprintId);
    const skipped = allInPage.length - targetBatch.length;
    const results: Array<{ id: string; title: string; status: string; error?: string }> = [];
    const repaired: PrintifyProduct[] = [];

    for (const p of targetBatch) {
      try {
        const promptRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: promptInstruction.replace("{title}", p.title) }],
            temperature: 0.7,
            max_tokens: 120,
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!promptRes.ok) throw new Error(`Prompt gen failed: ${promptRes.status}`);
        const promptData = await promptRes.json();
        const imagePrompt = promptData.choices?.[0]?.message?.content?.trim() ?? p.title;

        const cfg = PRODUCT_CONFIG[productType];
        const b64Image = (productType === "hat" || productType === "truckercap")
          ? await generateImageTransparent(imagePrompt, productType)
          : await generateImage(imagePrompt, productType);
        const imageId = await uploadImageToPrintify(b64Image, `${productType}-repair-${Date.now()}.png`);

        const detailRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`);
        if (!detailRes.ok) throw new Error(`Detail fetch ${detailRes.status}`);
        const detail = await detailRes.json() as PrintifyProduct;
        const variantIds = (detail.variants ?? []).map((v) => (v as Record<string, unknown>).id as number);

        const patchRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`, {
          method: "PUT",
          body: JSON.stringify({
            print_areas: [{
              variant_ids: variantIds,
              placeholders: cfg.placeholders.map((pos) => ({ position: pos, images: [{ id: imageId, x: 0.5, y: 0.5, scale: cfg.scale, angle: 0 }] })),
            }],
          }),
        });
        if (!patchRes.ok) throw new Error(`PATCH ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);
        repaired.push(p);
        console.log(`Patched ${productType}: ${p.title} (scale=${cfg.scale})`);
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
        console.error(`Repair failed: ${p.title} — ${(e as Error).message}`);
      }
    }

    if (repaired.length > 0) await new Promise((r) => setTimeout(r, 60_000));

    for (const p of repaired) {
      try {
        if (p.external?.id) {
          const pubRes = await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
            method: "POST",
            body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
          });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 3_000));
        }
        results.push({ id: p.id, title: p.title, status: "repaired" });
      } catch (e) {
        results.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
      }
    }

    const nextOffset = offset + batchSize < totalProducts ? offset + batchSize : null;
    return { totalProducts, processed: targetBatch.length, skipped, offset, nextOffset, results };
  }

  // ——— repairMousepads: regenerate mousepad designs with strict 75% margins (fixes text clipping) ———
  if (repairMousepads) {
    const r = await repairSingleType(
      608, "mousepad", repairMousepadsOffset,
      `Create a concise image generation prompt for FLAT GRAPHIC DESIGN artwork based on this product title: "{title}". The design will be printed on a rectangular desk mousepad. Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: describe ONLY the typography, colors, and graphic elements — NOT the mousepad shape. All text must fit within a generous safe zone with large margins on all sides. No text near the edges.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairMousepads":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairBlankets: regenerate blanket designs with anti-leaked-text prompt ———
  if (repairBlankets) {
    const r = await repairSingleType(
      238, "blanket", repairBlanketsOffset,
      `Create a concise image generation prompt for FLAT GRAPHIC DESIGN artwork based on this product title: "{title}". The design will be printed on a large sherpa throw blanket. Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: describe ONLY the visual illustration and typography elements — do NOT mention the blanket itself. Do NOT include instruction words as design content. The prompt should only describe what graphic/text elements to draw, not style instructions.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairBlankets":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairTravelMugs: regenerate travel mug designs with tight 25% center constraint ———
  if (repairTravelMugs) {
    const r = await repairSingleType(
      70, "travelmug", repairTravelMugsOffset,
      `Create a concise image generation prompt for FLAT GRAPHIC DESIGN artwork based on this product title: "{title}". The design will be printed as a decal on a cylindrical travel mug. Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: describe ONLY the typography and graphic elements — NOT the mug shape. The design must be compact, narrow, and vertically oriented to fit the narrow visible front face of a travel mug. All text must be very compact to avoid wrapping.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairTravelMugs":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairOnesies: regenerate onesie designs with anti-leaked-text prompt ———
  if (repairOnesies) {
    const r = await repairSingleType(
      568, "onesie", repairOnesiesOffset,
      `Create a concise image generation prompt for FLAT GRAPHIC DESIGN artwork based on this product title: "{title}". The design will be printed on the front chest of a baby onesie/bodysuit. Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: describe ONLY the cute illustration and typography elements — do NOT mention the onesie, baby, or product. Do NOT include instruction words as visible design content. The prompt should only describe what graphic/text elements to draw.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairOnesies":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairJournals: regenerate journal covers with front-cover-only constraint (no spine bleed) ———
  if (repairJournals) {
    const r = await repairSingleType(
      75, "journal", repairJournalsOffset,
      `Create a concise image generation prompt for BOOK COVER / JOURNAL FRONT COVER artwork based on this product title: "{title}". Return ONLY the image prompt, no other text. Keep it under 80 words. Describe ONLY the front cover design elements — bold typography, illustration style, colors. Do NOT mention the journal, notebook, or product itself. The design will sit on the front cover only — do NOT extend to the spine.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairJournals":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairCoasters: regenerate coaster designs with 70% inner-circle constraint ———
  if (repairCoasters) {
    const r = await repairSingleType(
      480, "coaster", repairCoastersOffset,
      `Create a concise image generation prompt for FLAT CIRCULAR GRAPHIC DESIGN artwork based on this product title: "{title}". The design will be printed on a round cork coaster that is die-cut into a circle. Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: ALL text and design elements must be well within the center circle — describe a circular composition with large margins from every edge. Nothing near the edges (they get cut off by the die). Pure white background outside the design.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairCoasters":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairOrnaments: regenerate ornament designs to fill the circular disc ———
  if (repairOrnaments) {
    const r = await repairSingleType(
      530, "ornament", repairOrnamentsOffset,
      `Create a concise image generation prompt for CIRCULAR ORNAMENT DISC artwork based on this product title: "{title}". The design will be printed on a ceramic circular hanging ornament. Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: the design must fill 90% of the circular disc area — bold, large, vibrant artwork. Do NOT describe a tiny design in the center. The design should dominate the disc with large bold text and/or a large illustration. Pure white background outside the disc.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairOrnaments":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairPetbandanas: regenerate pet bandana designs within triangular safe zone ———
  if (repairPetbandanas) {
    const r = await repairSingleType(
      562, "petbandana", repairPetbandanasOffset,
      `Create a concise image generation prompt for PET BANDANA artwork based on this product title: "{title}". The design will be printed on a square pet bandana worn folded as a triangle around a dog or cat's neck. Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: the bandana is worn as a triangle — only the center diamond zone is visible. ALL text and design must be in the center 50% of the canvas. Keep design very simple: 1-2 bold words maximum + 1 simple icon. Nothing within 25% of any canvas edge.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairPetbandanas":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairPosters: regenerate poster designs as full-bleed with no white border ———
  if (repairPosters) {
    const r = await repairSingleType(
      852, "poster_v", repairPostersOffset,
      `Create a concise image generation prompt for FULL-BLEED POSTER artwork based on this product title: "{title}". Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: describe a design whose background fills the ENTIRE canvas edge-to-edge — absolutely NO white border, NO white frame, NO white margin. The background color (dark, vibrant, or colored) must bleed to every canvas edge. Bold typography or illustration style. No white background.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairPosters":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— repairPuzzles: regenerate puzzle designs as full-bleed edge-to-edge ———
  if (repairPuzzles) {
    const r = await repairSingleType(
      611, "puzzle", repairPuzzlesOffset,
      `Create a concise image generation prompt for FULL-BLEED JIGSAW PUZZLE artwork based on this product title: "{title}". Return ONLY the image prompt, no other text. Keep it under 80 words. CRITICAL: the design must fill the ENTIRE canvas 100% edge-to-edge — ZERO white borders, ZERO padding anywhere. The background color fills every pixel to every canvas edge. Bold, colorful, vibrant. A gift item — must be eye-catching at full size.`,
    );
    if (r instanceof Response) return r;
    return Response.json({
      total: r.totalProducts, processed: r.processed, skipped: r.skipped,
      offset: r.offset, nextOffset: r.nextOffset,
      callNext: r.nextOffset !== null ? `POST {"repairPuzzles":true,"offset":${r.nextOffset}}` : null,
      succeeded: r.results.filter((x) => x.status === "repaired").length,
      results: r.results,
    });
  }

  // ——— patchPricesByBlueprint: bulk update retail price for all products of a given blueprint ———
  if (patchPricesByBlueprint) {
    const { blueprintId, newPriceCents } = patchPricesByBlueprint;
    const patchPriceResults: Array<{ id: string; title: string; status: string; error?: string }> = [];
    // Fetch all products, paginate
    let page = 1;
    let totalPatched = 0;
    while (true) {
      const pageRes = await pFetch(`/shops/${shopId}/products.json?page=${page}&limit=50`);
      if (!pageRes.ok) break;
      const pageData = await pageRes.json() as Record<string, unknown>;
      const items = Array.isArray(pageData.data) ? pageData.data as PrintifyProduct[] : [];
      if (items.length === 0) break;
      const targets = items.filter((p) => p.blueprint_id === blueprintId);
      for (const p of targets) {
        try {
          const detailRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`);
          if (!detailRes.ok) throw new Error(`Detail ${detailRes.status}`);
          const detail = await detailRes.json() as PrintifyProduct;
          const updatedVariants = (detail.variants ?? []).map((v) => ({ ...(v as Record<string, unknown>), price: newPriceCents }));
          const putRes = await pFetch(`/shops/${shopId}/products/${p.id}.json`, {
            method: "PUT",
            body: JSON.stringify({ variants: updatedVariants }),
          });
          if (!putRes.ok) throw new Error(`PUT ${putRes.status}: ${(await putRes.text()).slice(0, 100)}`);
          if (detail.external?.id) {
            await new Promise((r) => setTimeout(r, 2_000));
            await pFetch(`/shops/${shopId}/products/${p.id}/publish.json`, {
              method: "POST",
              body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
            });
          }
          totalPatched++;
          patchPriceResults.push({ id: p.id, title: p.title, status: "updated" });
          console.log(`Price patched: ${p.title} (bp=${blueprintId}) → $${(newPriceCents / 100).toFixed(2)}`);
          await new Promise((r) => setTimeout(r, 3_000));
        } catch (e) {
          patchPriceResults.push({ id: p.id, title: p.title, status: "error", error: (e as Error).message });
        }
      }
      if (items.length < 50) break;
      page++;
    }
    return Response.json({ blueprintId, newPriceCents, totalPatched, results: patchPriceResults });
  }

  // ——— patchTitles: fix titles on specific products and re-publish to Etsy ———
  if (patchTitlesInput.length > 0) {
    const patchResults: Array<{id: string; oldTitle?: string; newTitle: string; status: string; error?: string}> = [];
    for (const item of patchTitlesInput) {
      try {
        const detailRes = await pFetch(`/shops/${shopId}/products/${item.id}.json`);
        if (!detailRes.ok) throw new Error(`Detail fetch ${detailRes.status}`);
        const detail = await detailRes.json() as PrintifyProduct;

        const patchRes = await pFetch(`/shops/${shopId}/products/${item.id}.json`, {
          method: "PUT",
          body: JSON.stringify({ title: item.title }),
        });
        if (!patchRes.ok) throw new Error(`PUT ${patchRes.status}: ${(await patchRes.text()).slice(0, 200)}`);

        if (detail.external?.id) {
          await new Promise((r) => setTimeout(r, 2_000));
          const pubRes = await pFetch(`/shops/${shopId}/products/${item.id}/publish.json`, {
            method: "POST",
            body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
          });
          if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 5_000));
        }

        patchResults.push({ id: item.id, oldTitle: detail.title, newTitle: item.title, status: "updated" });
        console.log(`Title patched: ${detail.title} → ${item.title}`);
      } catch (e) {
        patchResults.push({ id: item.id, newTitle: item.title, status: "error", error: (e as Error).message });
        console.error(`Patch failed ${item.id}: ${(e as Error).message}`);
      }
    }
    return Response.json({ patchResults, count: patchResults.filter(r => r.status === "updated").length });
  }

  // ——— deleteIds ———
  const deleted: string[] = [];
  for (const id of deleteIds) {
    try { await deleteProduct(shopId, id); deleted.push(id); console.log(`Deleted: ${id}`); }
    catch (e) { console.error(`Delete failed ${id}: ${(e as Error).message}`); }
  }

  if (deleteIds.length > 0 && !customProduct && !explicitCount) {
    return Response.json({ deleted, count: deleted.length });
  }

  // ——— Batch creation ———
  // For custom products, auto-optimize SEO before creation
  let productBatch: TrendingProduct[];
  if (customProduct) {
    try {
      const optimized = await optimizeListing(customProduct.name, customProduct.type, customProduct.description);
      productBatch = [{
        ...customProduct,
        name: optimized.title,
        description: optimized.description,
        tags: optimized.tags,
        retailPrice: customProduct.retailPrice || FINAL_PRICES[customProduct.type],
      }];
    } catch (e1) {
      console.warn(`optimizeListing failed (${(e1 as Error).message}) — retrying once`);
      try {
        const retry = await optimizeListing(customProduct.name, customProduct.type, customProduct.description);
        productBatch = [{
          ...customProduct,
          name: retry.title,
          description: retry.description,
          tags: retry.tags,
          retailPrice: customProduct.retailPrice || FINAL_PRICES[customProduct.type],
        }];
      } catch {
        // Emergency fallback: generate 13 basic tags from product name — better than 0 tags
        const words = customProduct.name.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").filter((w) => w.length > 2).slice(0, 8);
        const tags = [...new Set([...words, "funny gift", "birthday gift", "unique gift", "gift for her"])].slice(0, 13) as string[];
        while (tags.length < 13) tags.push("gift");
        console.warn(`optimizeListing retry also failed — using emergency tags for: ${customProduct.name}`);
        productBatch = [{ ...customProduct, tags, retailPrice: customProduct.retailPrice || FINAL_PRICES[customProduct.type] }];
      }
    }
  } else {
    productBatch = [];
  }

  const results: Array<{ product: string; status: "success" | "error"; printifyId?: string; etsyListingId?: string; error?: string }> = [];

  // Phase 1: Create all products
  const created: Array<{ product: TrendingProduct; printifyId: string }> = [];
  for (const product of productBatch) {
    try {
      const cfg = await resolveConfig(product.type);
      const TRANSPARENT_APPAREL = new Set(["tshirt","hoodie","sweatshirt","longsleeve","onesie","hat","truckercap"]);
      const b64Image = TRANSPARENT_APPAREL.has(product.type)
        ? await generateImageTransparent(product.imagePrompt, product.type)
        : await generateImage(product.imagePrompt, product.type);
      const imageId = await uploadImageToPrintify(b64Image, `${product.type}-${Date.now()}.png`);
      const variants = cfg.variantIds.map((id) => ({ id, price: product.retailPrice, is_enabled: true }));

      const createRes = await pFetch(`/shops/${shopId}/products.json`, {
        method: "POST",
        body: JSON.stringify({
          title: product.name,
          description: product.description,
          tags: product.tags,
          blueprint_id: cfg.blueprintId,
          print_provider_id: cfg.printProviderId,
          variants,
          print_areas: [{
            variant_ids: cfg.variantIds,
            placeholders: cfg.placeholders.map((pos) => ({ position: pos, images: [{ id: imageId, x: 0.5, y: 0.5, scale: cfg.scale, angle: 0 }] })),
          }],
        }),
      });
      const createdData = await createRes.json();
      if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(createdData)}`);

      created.push({ product, printifyId: createdData.id as string });
      console.log(`Created: ${product.name} (${createdData.id})`);
    } catch (e) {
      results.push({ product: product.name, status: "error", error: (e as Error).message });
      console.error(`Failed create: ${product.name} — ${(e as Error).message}`);
    }
  }

  // Phase 2: Wait 60s for Printify to render all mockup images (more time = more angles generated)
  if (created.length > 0) {
    console.log(`Waiting 60s for Printify mockup generation (${created.length} products)...`);
    await new Promise((r) => setTimeout(r, 60_000));
  }

  // Phase 2.5: Visual mockup check — verify each product looks correct before publishing
  const failedMockupCheck: string[] = [];
  for (const { product, printifyId } of created) {
    try {
      const detailRes = await pFetch(`/shops/${shopId}/products/${printifyId}.json`);
      if (detailRes.ok) {
        const detail = await detailRes.json() as Record<string, unknown>;
        const images = Array.isArray(detail.images) ? detail.images as Array<{ src?: string }> : [];
        const mockupUrl = images[0]?.src;
        if (mockupUrl && OPENAI_KEY) {
          const imgRes = await fetch(mockupUrl, { signal: AbortSignal.timeout(15_000) });
          if (imgRes.ok) {
            const imgBuf = await imgRes.arrayBuffer();
            const b64Mockup = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
            const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                max_tokens: 100,
                messages: [{ role: "user", content: [
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64Mockup.slice(0, 500000)}` } },
                  { type: "text", text: `Score this POD product mockup 1–5. Be strict.\nScore MUST be ≤2 if ANY of these are true:\n- White rectangle/box floating on colored fabric (transparent-bg failure)\n- Design is cut off at any edge\n- Design occupies less than 20% of the visible print area (too tiny)\n- Design is in the wrong location (e.g., stomach area on a shirt instead of chest)\n- No design visible at all\n- Two completely different designs on opposite sides/halves\nScore 3 if design is visible but too small or slightly off-center.\nScore 5 if design fills the intended print area, is centered, and looks polished.\nReply ONLY with JSON: {"score":N,"reason":"one sentence"}` },
                ] }],
              }),
              signal: AbortSignal.timeout(20_000),
            });
            if (visionRes.ok) {
              const vData = await visionRes.json();
              const parsed = JSON.parse((vData.choices?.[0]?.message?.content ?? "{}").match(/\{.*\}/s)?.[0] ?? "{}");
              const mockupScore = Number(parsed.score) || 5;
              console.log(`Mockup check: ${product.name} — ${mockupScore}/5 (${parsed.reason})`);
              if (mockupScore <= 3) {
                console.warn(`MOCKUP_FAIL: ${product.name} (${printifyId}) score=${mockupScore}/5 — ${parsed.reason}. Use repairProductIds to fix.`);
                failedMockupCheck.push(printifyId);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Mockup check error for ${printifyId}: ${(e as Error).message.slice(0, 80)}`);
    }
  }

  // Phase 2.6: Sort mockups + enable free shipping on all created products
  for (const { product, printifyId } of created) {
    await sortMockupImages(shopId, printifyId);
    try {
      const freeShipResWW = await pFetch(`/shops/${shopId}/products/${printifyId}.json`, {
        method: "PUT",
        body: JSON.stringify({ sales_channel_properties: { free_shipping: true, free_shipping_applies_to: "all" } }),
      });
      if (freeShipResWW.ok) {
        console.log(`Free shipping (worldwide) enabled: ${product.name} (${printifyId})`);
      } else {
        const fallback = await pFetch(`/shops/${shopId}/products/${printifyId}.json`, { method: "PUT", body: JSON.stringify({ sales_channel_properties: { free_shipping: true } }) });
        if (fallback.ok) console.warn(`free_shipping_applies_to:all rejected for ${printifyId} — fell back to US-only`);
        else { const err = await fallback.json().catch(() => ({})); console.warn(`Free shipping update failed for ${printifyId}: ${JSON.stringify(err).slice(0, 200)}`); }
      }
    } catch (e) {
      console.warn(`Free shipping update error: ${(e as Error).message}`);
    }
    // Enable Etsy personalization — shows "Personalized" badge in search, ~40-60% higher conversion
    try {
      await pFetch(`/shops/${shopId}/products/${printifyId}.json`, {
        method: "PUT",
        body: JSON.stringify({
          sales_channel_properties: {
            is_personalizable: true,
            personalization_instructions: "Enter your custom text (name, date, or short message) in the personalization box at checkout.",
            is_personalization_required: false,
            personalization_char_count_max: 40,
          },
        }),
      });
    } catch (e) {
      console.warn(`Personalization update skipped for ${printifyId}: ${(e as Error).message.slice(0, 60)}`);
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }

  // Phase 3: Publish to Etsy with 3s delay between each (rate limit)
  // shipping_template: false — avoids "shipping profile no longer exists" notification;
  // Etsy listing uses the shop's default shipping profile instead.
  for (const { product, printifyId } of created) {
    try {
      const pubRes = await pFetch(`/shops/${shopId}/products/${printifyId}/publish.json`, {
        method: "POST",
        body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: false }),
      });
      if (!pubRes.ok) throw new Error(`Publish failed: ${JSON.stringify(await pubRes.json())}`);
      // Read back external Etsy listing ID so callers can track it
      let etsyListingId: string | undefined;
      try {
        await new Promise((r) => setTimeout(r, 2_000)); // give Etsy sync a moment
        const detailRes = await pFetch(`/shops/${shopId}/products/${printifyId}.json`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          etsyListingId = detail?.external?.id ?? undefined;
        }
      } catch { /* best effort — don't fail publish over missing listing ID */ }

      // ── Atomic write-back: if caller supplied queueId, update pod_product_queue ──
      if (queueId !== null) {
        try {
          const sb = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { auth: { persistSession: false } },
          );
          const now = new Date().toISOString();
          await sb.from("pod_product_queue").update({
            status: "published",
            printify_id: printifyId,
            ...(etsyListingId ? {
              etsy_listing_id: etsyListingId,
              etsy_listing_id_confirmed_at: now,
            } : {}),
          }).eq("id", queueId);

          // Append-only publish event log
          await sb.from("pod_publish_events").insert({
            queue_id: queueId,
            printify_id: printifyId,
            etsy_listing_id: etsyListingId ?? null,
            event_type: etsyListingId ? "etsy_id_confirmed" : "publish_success",
            payload: { product_name: product.name, product_type: product.type },
          });
          console.log(`Write-back: queue ${queueId} → printify ${printifyId}, etsy ${etsyListingId ?? "pending"}`);
        } catch (wbErr) {
          // Never fail the publish over a write-back error — log and continue
          console.warn(`Write-back failed for queue ${queueId}: ${(wbErr as Error).message}`);
        }
      }

      results.push({ product: product.name, status: "success", printifyId, etsyListingId });
      console.log(`Published: ${product.name} (printifyId=${printifyId}, etsyId=${etsyListingId ?? "pending"})`);
    } catch (e) {
      results.push({ product: product.name, status: "error", error: (e as Error).message });
      console.error(`Failed publish: ${product.name} — ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  return Response.json({
    summary: `${succeeded}/${productBatch.length} products created (batch ${startIndex}–${startIndex + productBatch.length - 1})`,
    shopId,
    results,
    ...(failedMockupCheck.length > 0 ? { mockupFailures: failedMockupCheck, mockupFailureNote: `${failedMockupCheck.length} products failed visual mockup check — repair with: POST {"repairProductIds":${JSON.stringify(failedMockupCheck)}}` } : {}),
  });
});

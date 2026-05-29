/**
 * printify-full-audit — v1
 *
 * Fetches every product from Printify and returns a structured audit report.
 * Flags: not published to Etsy, below-minimum pricing, no images, bad titles, no description.
 *
 * POST {}                          → full audit, all pages
 * POST { "page": 3 }              → single page (100 products), for manual pagination
 * POST { "flag_only": true }      → only return products with at least one flag
 * POST { "product_id": "abc123" } → deep audit one specific product (full variant + image detail)
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const PRINTIFY_KEY  = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const PRINTIFY_SHOP = Deno.env.get("PRINTIFY_SHOP_ID")   ?? "";
const SB_URL        = Deno.env.get("SUPABASE_URL")        ?? "";
const SB_KEY        = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BASE = "https://api.printify.com/v1";

const log = (...args: unknown[]) => console.log("[PRINTIFY-AUDIT]", ...args);

// ─── Minimum retail prices in cents (Printify "price" field on variants) ──────
// These are the RETAIL prices we charge — not Printify cost.
// We use these to detect variants priced below our minimums.
const MIN_PRICE_CENTS: Record<string, number> = {
  mug:         1899,
  tumbler:     2999,
  travelmug:   2999,
  tumbler40:   3499,
  tshirt:      2299,
  hoodie:      3899,
  sweatshirt:  3999,
  longsleeve:  2699,
  hat:         2499,
  truckercap:  2499,
  sock:        1899,
  onesie:      2499,
  candle:      2699,
  coaster:     1999,
  petbandana:  2499,
  ornament:    1999,
  poster_v:    2499,
  poster_h:    2499,
  wineglass:   1999,
  pintglass:   1999,
  shotglass:   999,
  puzzle:      2999,
  pillow:      2999,
  journal:     1999,
  sticker:     499,
  greetingcard: 799,
};

// Blueprint → product type mapping (common ones)
const BLUEPRINT_TYPE: Record<number, string> = {
  384: "mug",        // White mug 11oz
  493: "mug",        // White mug 15oz
  145: "tshirt",     // Bella Canvas 3001
  77:  "hoodie",     // Gildan 18500
  278: "sock",       // Printify socks
  517: "tumbler",    // 20oz tumbler
  358: "tumbler",    // 40oz tumbler
  366: "hat",        // 5-panel cap
  619: "candle",
  457: "coaster",
  587: "onesie",
  488: "longsleeve",
  172: "sweatshirt",
};

interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  tags: string[];
  images: Array<{ src: string; is_default: boolean }>;
  variants: Array<{
    id: number;
    title: string;
    price: number;        // cents
    is_enabled: boolean;
    is_default: boolean;
  }>;
  blueprint_id: number;
  print_provider_id: number;
  external: { id: string; handle: string } | null;
  options: unknown[];
  print_areas: unknown[];
  created_at: string;
  updated_at: string;
}

interface AuditFlag {
  code: string;
  detail: string;
}

interface ProductAudit {
  printify_id: string;
  title: string;
  blueprint_id: number;
  product_type: string;
  published_to_etsy: boolean;
  etsy_listing_id: string | null;
  image_count: number;
  enabled_variant_count: number;
  min_variant_price_cents: number;
  max_variant_price_cents: number;
  tag_count: number;
  has_description: boolean;
  flags: AuditFlag[];
  in_queue_db: boolean;
  created_at: string;
  updated_at: string;
}

function detectProductType(blueprintId: number, title: string): string {
  if (BLUEPRINT_TYPE[blueprintId]) return BLUEPRINT_TYPE[blueprintId];
  const t = title.toLowerCase();
  if (t.includes("mug")) return "mug";
  if (t.includes("hoodie")) return "hoodie";
  if (t.includes("sweatshirt") || t.includes("crewneck")) return "sweatshirt";
  if (t.includes("tumbler") || t.includes("travel mug")) return "tumbler";
  if (t.includes("tee") || t.includes("t-shirt") || t.includes("shirt")) return "tshirt";
  if (t.includes("sock")) return "sock";
  if (t.includes("hat") || t.includes("cap")) return "hat";
  if (t.includes("candle")) return "candle";
  if (t.includes("coaster")) return "coaster";
  if (t.includes("onesie")) return "onesie";
  if (t.includes("ornament")) return "ornament";
  if (t.includes("poster") || t.includes("print")) return "poster_v";
  if (t.includes("pillow")) return "pillow";
  if (t.includes("puzzle")) return "puzzle";
  if (t.includes("journal") || t.includes("notebook")) return "journal";
  return "unknown";
}

function auditProduct(p: PrintifyProduct, queueIds: Set<string>): ProductAudit {
  const flags: AuditFlag[] = [];
  const productType = detectProductType(p.blueprint_id, p.title);

  // Published to Etsy?
  const publishedToEtsy = !!(p.external?.id);
  if (!publishedToEtsy) {
    flags.push({ code: "NOT_PUBLISHED", detail: "No Etsy listing linked — not visible to buyers" });
  }

  // Images
  const imageCount = p.images?.length ?? 0;
  if (imageCount === 0) {
    flags.push({ code: "NO_IMAGES", detail: "Product has zero images" });
  } else if (imageCount < 3) {
    flags.push({ code: "FEW_IMAGES", detail: `Only ${imageCount} image(s) — Etsy recommends 5–10` });
  }

  // Variants
  const enabledVariants = (p.variants ?? []).filter(v => v.is_enabled);
  if (enabledVariants.length === 0) {
    flags.push({ code: "NO_ENABLED_VARIANTS", detail: "All variants are disabled — product is unsellable" });
  }

  const prices = enabledVariants.map(v => v.price).filter(x => x > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  // Price below minimum
  const minAllowed = MIN_PRICE_CENTS[productType] ?? 1500;
  if (prices.length && minPrice < minAllowed) {
    flags.push({
      code: "PRICE_TOO_LOW",
      detail: `Lowest variant $${(minPrice/100).toFixed(2)} — minimum for ${productType} is $${(minAllowed/100).toFixed(2)}`
    });
  }

  // Tags
  const tagCount = p.tags?.length ?? 0;
  if (tagCount === 0) {
    flags.push({ code: "NO_TAGS", detail: "Printify product has zero tags" });
  } else if (tagCount < 5) {
    flags.push({ code: "FEW_TAGS", detail: `Only ${tagCount} tag(s) — Etsy needs 13` });
  }

  // Description
  const hasDescription = !!(p.description && p.description.trim().length > 20);
  if (!hasDescription) {
    flags.push({ code: "NO_DESCRIPTION", detail: "Missing or empty product description" });
  }

  // Title
  if (!p.title || p.title.trim().length < 10) {
    flags.push({ code: "BAD_TITLE", detail: `Title too short: "${p.title}"` });
  }

  return {
    printify_id:          p.id,
    title:                p.title,
    blueprint_id:         p.blueprint_id,
    product_type:         productType,
    published_to_etsy:    publishedToEtsy,
    etsy_listing_id:      p.external?.id ?? null,
    image_count:          imageCount,
    enabled_variant_count: enabledVariants.length,
    min_variant_price_cents: minPrice,
    max_variant_price_cents: maxPrice,
    tag_count:            tagCount,
    has_description:      hasDescription,
    flags,
    in_queue_db:          queueIds.has(p.id),
    created_at:           p.created_at,
    updated_at:           p.updated_at,
  };
}

async function getShopId(): Promise<string> {
  if (PRINTIFY_SHOP) return PRINTIFY_SHOP;
  const r = await fetch(`${BASE}/shops.json`, {
    headers: { Authorization: `Bearer ${PRINTIFY_KEY}` },
  });
  const shops = await r.json() as Array<{ id: number }>;
  return String(shops[0]?.id ?? "");
}

async function fetchPage(shopId: string, page: number): Promise<{ data: PrintifyProduct[]; total: number; last_page: number }> {
  const r = await fetch(`${BASE}/shops/${shopId}/products.json?page=${page}&limit=50`, {
    headers: { Authorization: `Bearer ${PRINTIFY_KEY}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Printify API ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json() as Promise<{ data: PrintifyProduct[]; last_page: number; total: number }>;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const body = await req.json().catch(() => ({})) as {
    page?: number;
    flag_only?: boolean;
    product_id?: string;
  };

  if (!PRINTIFY_KEY) return Response.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });

  const sb = createClient(SB_URL, SB_KEY);

  // Load queue DB printify_ids for cross-reference
  const { data: queueRows } = await sb
    .from("pod_product_queue")
    .select("printify_id")
    .not("printify_id", "is", null);
  const queueIds = new Set<string>((queueRows ?? []).map((r: { printify_id: string }) => r.printify_id));

  // ── Single product deep audit ────────────────────────────────────────────────
  if (body.product_id) {
    const shopId = await getShopId();
    const r = await fetch(`${BASE}/shops/${shopId}/products/${body.product_id}.json`, {
      headers: { Authorization: `Bearer ${PRINTIFY_KEY}` },
    });
    if (!r.ok) return Response.json({ error: `Printify ${r.status}` }, { status: r.status });
    const p = await r.json() as PrintifyProduct;
    return Response.json({ product: auditProduct(p, queueIds), raw_variants: p.variants, raw_images: p.images });
  }

  // ── Full audit (all pages or single page) ────────────────────────────────────
  const shopId = await getShopId();
  log(`Shop ID: ${shopId}`);

  const results: ProductAudit[] = [];
  let page = body.page ?? 1;
  let lastPage = 1;
  let totalProducts = 0;

  // If specific page requested, just fetch that one
  const singlePage = typeof body.page === "number";

  do {
    log(`Fetching page ${page}…`);
    let resp: { data: PrintifyProduct[]; total: number; last_page: number };
    try {
      resp = await fetchPage(shopId, page);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`fetchPage error on page ${page}: ${msg}`);
      return Response.json({ error: msg, page, partial_results: results.length }, { status: 502 });
    }
    totalProducts = resp.total;
    lastPage = resp.last_page ?? Math.ceil(resp.total / 50);

    for (const p of resp.data) {
      results.push(auditProduct(p, queueIds));
    }

    page++;
    if (!singlePage && page <= lastPage) {
      await new Promise(r => setTimeout(r, 500));
    }
  } while (!singlePage && page <= lastPage);

  const flagged = results.filter(r => r.flags.length > 0);
  const output = body.flag_only ? flagged : results;

  // Summary stats
  const summary = {
    total_printify_products: totalProducts,
    audited: results.length,
    published_to_etsy: results.filter(r => r.published_to_etsy).length,
    not_published: results.filter(r => !r.published_to_etsy).length,
    in_queue_db: results.filter(r => r.in_queue_db).length,
    flagged_count: flagged.length,
    flag_breakdown: {
      NOT_PUBLISHED:         flagged.filter(r => r.flags.some(f => f.code === "NOT_PUBLISHED")).length,
      NO_IMAGES:             flagged.filter(r => r.flags.some(f => f.code === "NO_IMAGES")).length,
      FEW_IMAGES:            flagged.filter(r => r.flags.some(f => f.code === "FEW_IMAGES")).length,
      PRICE_TOO_LOW:         flagged.filter(r => r.flags.some(f => f.code === "PRICE_TOO_LOW")).length,
      NO_TAGS:               flagged.filter(r => r.flags.some(f => f.code === "NO_TAGS")).length,
      FEW_TAGS:              flagged.filter(r => r.flags.some(f => f.code === "FEW_TAGS")).length,
      NO_DESCRIPTION:        flagged.filter(r => r.flags.some(f => f.code === "NO_DESCRIPTION")).length,
      NO_ENABLED_VARIANTS:   flagged.filter(r => r.flags.some(f => f.code === "NO_ENABLED_VARIANTS")).length,
    },
  };

  log("Audit complete", summary);
  return Response.json({ summary, products: output });
});

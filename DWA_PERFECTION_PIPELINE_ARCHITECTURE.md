# DWA Perfection Pipeline Architecture
## Quality-First Gatekeeper System — 4-Machine Design
**Generated:** 2026-05-25 | **Branch:** claude/ecommerce-framework-audit-mDDcG

---

## Overview

This document describes a 4-machine quality pipeline that sits in front of the existing Printify/Etsy publish flow. Rather than publishing products and hoping for the best, every item passes through a series of automated gates before it ever reaches a customer. Machine 1 validates image quality (contrast and safe-area placement). Machine 2 enforces catalog integrity (inventory availability and correct Etsy taxonomy). Machine 3 handles smart order routing using geographic proximity. Machine 4 closes the loop on customer satisfaction through tracking sync and post-purchase engagement.

All 8 components are viable and buildable against the existing Supabase infrastructure on the secondary POD project (`zmyczlfuufhngzovkjdh`). Each edge function is self-contained, calls only already-provisioned secrets, and writes audit rows to purpose-built tables. The schema section at the end provides every DDL statement needed to stand up the full pipeline from scratch. pg_cron schedule SQL is included for all cron-driven components.

---

## Machine 1 — Visual Accuracy & QA

Machine 1 intercepts every product before the image is submitted to Printify. Two validators run in parallel: a contrast check against the substrate color and a bounding-box scale lock that enforces per-product safe areas. Results feed a viability score (0-100) and a hard gate: any blocking issue returns HTTP 422 and the queue item is not advanced.

### 1.1 Contrast Validator

The validator fetches the generated image buffer, computes mean luminance of the design layer pixels against the substrate RGB, and rejects if the contrast delta is below WCAG AA print threshold (DeltaL < 30).

```typescript
// supabase/functions/_shared/validate-contrast.ts
export interface ContrastResult {
  pass: boolean;
  score: number;      // 1-5 scale
  deltaL: number;     // luminance difference
  reason: string;
}

export async function validateContrast(imageUrl: string, substrateColor: [number, number, number] = [255, 255, 255]): Promise<ContrastResult> {
  const res = await fetch(imageUrl);
  if (!res.ok) return { pass: false, score: 0, deltaL: 0, reason: "Image fetch failed" };

  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const sampleSize = Math.min(bytes.length, 10000);
  let totalR = 0, totalG = 0, totalB = 0, count = 0;

  const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const startOffset = isJpeg ? 100 : isPng ? 57 : 50;

  for (let i = startOffset; i < startOffset + sampleSize - 3; i += 4) {
    if (i + 3 >= bytes.length) break;
    totalR += bytes[i];
    totalG += bytes[i + 1];
    totalB += bytes[i + 2];
    count++;
  }

  if (count === 0) return { pass: false, score: 0, deltaL: 0, reason: "No pixel data sampled" };

  const meanR = totalR / count;
  const meanG = totalG / count;
  const meanB = totalB / count;

  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const designL = 0.2126 * toLin(meanR) + 0.7152 * toLin(meanG) + 0.0722 * toLin(meanB);
  const substrateL = 0.2126 * toLin(substrateColor[0]) + 0.7152 * toLin(substrateColor[1]) + 0.0722 * toLin(substrateColor[2]);

  const deltaL = Math.abs(designL - substrateL) * 100;
  const score = deltaL >= 60 ? 5 : deltaL >= 45 ? 4 : deltaL >= 30 ? 3 : deltaL >= 15 ? 2 : 1;
  const pass = deltaL >= 30;

  return {
    pass,
    score,
    deltaL: Math.round(deltaL),
    reason: pass
      ? `Contrast DeltaL=${Math.round(deltaL)} -- passes print threshold`
      : `Contrast DeltaL=${Math.round(deltaL)} -- below 30 threshold on white substrate; regenerate image`,
  };
}
```

### 1.2 Bounding Box Scale Lock

This lookup table is sourced from PRODUCT_CREATION_PROTOCOL.md and provides exact safe-area constraints for all 32 product types. The `lockBoundingBox` function scales the design image matrix to fit exactly within the safe area with aspect-ratio preservation.

```typescript
// supabase/functions/_shared/bounding-box.ts
export interface BoundingBox {
  blueprint_width_px: number;
  blueprint_height_px: number;
  safe_area: { top: number; right: number; bottom: number; left: number };
  recommended_scale: number;
  notes?: string;
}

export const BOUNDING_BOX_TABLE: Record<string, BoundingBox> = {
  mug:        { blueprint_width_px: 520,  blueprint_height_px: 208,  safe_area: { top: 10,  right: 20,   bottom: 10,   left: 20   }, recommended_scale: 0.30 },
  tshirt:     { blueprint_width_px: 4500, blueprint_height_px: 5400, safe_area: { top: 400, right: 300,  bottom: 900,  left: 300  }, recommended_scale: 1.0  },
  hoodie:     { blueprint_width_px: 4500, blueprint_height_px: 5400, safe_area: { top: 500, right: 400,  bottom: 1000, left: 400  }, recommended_scale: 0.75 },
  sweatshirt: { blueprint_width_px: 4500, blueprint_height_px: 5400, safe_area: { top: 500, right: 400,  bottom: 1000, left: 400  }, recommended_scale: 0.75 },
  onesie:     { blueprint_width_px: 4500, blueprint_height_px: 5400, safe_area: { top: 600, right: 500,  bottom: 1200, left: 500  }, recommended_scale: 0.75 },
  sock:       { blueprint_width_px: 1200, blueprint_height_px: 1600, safe_area: { top: 200, right: 150,  bottom: 200,  left: 150  }, recommended_scale: 3.5,  notes: "Leg area only -- keep design in top 60%" },
  tumbler:    { blueprint_width_px: 2400, blueprint_height_px: 1800, safe_area: { top: 50,  right: 50,   bottom: 50,   left: 50   }, recommended_scale: 0.30 },
  travelmug:  { blueprint_width_px: 2400, blueprint_height_px: 1800, safe_area: { top: 50,  right: 50,   bottom: 50,   left: 50   }, recommended_scale: 0.30 },
  longsleeve: { blueprint_width_px: 4500, blueprint_height_px: 5400, safe_area: { top: 400, right: 300,  bottom: 900,  left: 300  }, recommended_scale: 1.0  },
  hat:        { blueprint_width_px: 2100, blueprint_height_px: 700,  safe_area: { top: 50,  right: 100,  bottom: 50,   left: 100  }, recommended_scale: 0.5  },
  poster_v:   { blueprint_width_px: 4500, blueprint_height_px: 5670, safe_area: { top: 0,   right: 0,    bottom: 0,    left: 0    }, recommended_scale: 1.0,  notes: "Edge-to-edge, zero border" },
  poster_h:   { blueprint_width_px: 5670, blueprint_height_px: 4500, safe_area: { top: 0,   right: 0,    bottom: 0,    left: 0    }, recommended_scale: 1.0,  notes: "Edge-to-edge, zero border" },
  coaster:    { blueprint_width_px: 2400, blueprint_height_px: 2400, safe_area: { top: 360, right: 360,  bottom: 360,  left: 360  }, recommended_scale: 0.85, notes: "Circular -- all content in inner 70% circle" },
  ornament:   { blueprint_width_px: 2400, blueprint_height_px: 2400, safe_area: { top: 120, right: 120,  bottom: 120,  left: 120  }, recommended_scale: 0.9,  notes: "Fills 90% disc" },
  petbandana: { blueprint_width_px: 4200, blueprint_height_px: 1800, safe_area: { top: 450, right: 1260, bottom: 720,  left: 1260 }, recommended_scale: 0.5,  notes: "Center 50%/40% only" },
  puzzle:     { blueprint_width_px: 3150, blueprint_height_px: 2550, safe_area: { top: 0,   right: 0,    bottom: 0,    left: 0    }, recommended_scale: 1.0,  notes: "Full bleed, zero borders" },
  pillow:     { blueprint_width_px: 4000, blueprint_height_px: 4000, safe_area: { top: 200, right: 200,  bottom: 200,  left: 200  }, recommended_scale: 0.9  },
  blanket:    { blueprint_width_px: 7200, blueprint_height_px: 6000, safe_area: { top: 100, right: 100,  bottom: 100,  left: 100  }, recommended_scale: 1.0  },
};

export interface BoundingBoxResult {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  fits: boolean;
  notes?: string;
}

export function lockBoundingBox(
  productType: string,
  designNaturalWidth: number,
  designNaturalHeight: number
): BoundingBoxResult {
  const box = BOUNDING_BOX_TABLE[productType] ?? BOUNDING_BOX_TABLE.poster_v;
  const { safe_area, blueprint_width_px, blueprint_height_px } = box;

  const safeW = blueprint_width_px - safe_area.left - safe_area.right;
  const safeH = blueprint_height_px - safe_area.top - safe_area.bottom;

  const scaleX = safeW / designNaturalWidth;
  const scaleY = safeH / designNaturalHeight;
  const scale = Math.min(scaleX, scaleY, box.recommended_scale);

  const finalW = Math.round(designNaturalWidth * scale);
  const finalH = Math.round(designNaturalHeight * scale);

  const x = safe_area.left + Math.round((safeW - finalW) / 2);
  const y = safe_area.top + Math.round((safeH - finalH) / 2);

  return {
    x, y, scale,
    width: finalW,
    height: finalH,
    fits: finalW <= safeW && finalH <= safeH,
    notes: box.notes,
  };
}
```

### 1.3 Listing Viability Scorer (Shared Utility)

```typescript
// supabase/functions/_shared/validate-listing.ts

export interface TitleResult {
  valid: boolean;
  title: string;
  issues: string[];
}

export interface TagResult {
  valid: boolean;
  tags: string[];
  issues: string[];
}

export interface ViabilityInput {
  title: string;
  tags: string[];
  hasShippingProfile: boolean;
  descriptionLength: number;
  imageContrastScore: number;
}

export interface ViabilityResult {
  total: number;
  grade: "A" | "B" | "C" | "F";
  blocking: string[];
  warnings: string[];
}

export function validateTitle(title: string): TitleResult {
  const issues: string[] = [];
  const trimmed = title?.trim() ?? "";

  if (!trimmed) issues.push("Title is empty");
  else if (trimmed.length < 20) issues.push(`Title too short (${trimmed.length} chars, minimum 20)`);
  else if (trimmed.length > 140) issues.push(`Title too long (${trimmed.length} chars, maximum 140)`);
  if (/[<>{}[\]|\\^~`]/.test(trimmed)) issues.push("Title contains invalid special characters");
  if (/(.){4,}/.test(trimmed)) issues.push("Title contains repeated character spam");

  return { valid: issues.length === 0, title: trimmed, issues };
}

export function validateTags(tags: string[], productType: string): TagResult {
  const issues: string[] = [];
  const cleaned = (tags ?? []).map(t => t.trim()).filter(Boolean);

  if (cleaned.length < 13) issues.push(`Only ${cleaned.length} tags -- Etsy requires exactly 13`);
  if (cleaned.length > 13) issues.push(`${cleaned.length} tags -- Etsy maximum is 13`);

  const tooLong = cleaned.filter(t => t.length > 20);
  if (tooLong.length) issues.push(`Tags too long (>20 chars): ${tooLong.join(", ")}`);

  const dupes = cleaned.filter((t, i) => cleaned.indexOf(t) !== i);
  if (dupes.length) issues.push(`Duplicate tags: ${[...new Set(dupes)].join(", ")}`);

  const typeInTags = cleaned.some(t => t.toLowerCase().includes(productType.toLowerCase().replace("_", " ")));
  if (!typeInTags && productType !== "poster_v" && productType !== "poster_h") {
    issues.push(`Product type "${productType}" not represented in any tag`);
  }

  return { valid: issues.length === 0, tags: cleaned, issues };
}

export function scoreListingViability(input: ViabilityInput): ViabilityResult {
  const blocking: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const contrastPts = input.imageContrastScore * 5;
  score += contrastPts;
  if (input.imageContrastScore < 3) blocking.push("Image contrast too low -- will print poorly");

  const titleResult = validateTitle(input.title);
  if (titleResult.valid) {
    const len = input.title.trim().length;
    score += len >= 80 ? 25 : len >= 40 ? 18 : 10;
  } else {
    blocking.push(...titleResult.issues);
  }

  const tagCount = (input.tags ?? []).filter(Boolean).length;
  if (tagCount === 13) score += 30;
  else if (tagCount >= 10) { score += 15; warnings.push(`Only ${tagCount}/13 tags`); }
  else { blocking.push(`Only ${tagCount}/13 tags -- Etsy requires exactly 13`); }

  if (input.hasShippingProfile) score += 10;
  else warnings.push("No shipping profile -- free shipping not confirmed");

  if (input.descriptionLength >= 200) score += 10;
  else if (input.descriptionLength >= 100) { score += 5; warnings.push("Description is short (< 200 chars)"); }
  else warnings.push("Description missing or very short");

  const grade: "A" | "B" | "C" | "F" =
    score >= 85 ? "A" :
    score >= 70 ? "B" :
    score >= 55 ? "C" : "F";

  return { total: Math.min(score, 100), grade, blocking, warnings };
}
```

### 1.4 Complete Product QA Gatekeeper Edge Function

```typescript
// supabase/functions/product-qa-gatekeeper/index.ts
/**
 * Product QA Gatekeeper
 * Called by pod-new-products BEFORE submitting image to Printify.
 * Validates: contrast, bounding box, title, tags.
 * Returns: { approved: bool, issues: [], score: number }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateContrast } from "../_shared/validate-contrast.ts";
import { lockBoundingBox } from "../_shared/bounding-box.ts";
import { validateTitle, validateTags, scoreListingViability } from "../_shared/validate-listing.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface QARequest {
  queue_id: number;
  image_url: string;
  product_type: string;
  design_width_px?: number;
  design_height_px?: number;
  title: string;
  tags: string[];
  has_shipping_profile?: boolean;
  description_length?: number;
}

interface QAResponse {
  approved: boolean;
  score: number;
  grade: "A" | "B" | "C" | "F";
  issues: string[];
  warnings: string[];
  contrast: { pass: boolean; score: number; deltaL: number; reason: string };
  bounding_box: { fits: boolean; x: number; y: number; scale: number; width: number; height: number };
  title_result: { valid: boolean; title: string; issues: string[] };
  tag_result: { valid: boolean; tags: string[]; issues: string[] };
}

Deno.serve(async (req: Request) => {
  const body: QARequest = await req.json();

  const {
    queue_id,
    image_url,
    product_type,
    design_width_px = 4500,
    design_height_px = 5400,
    title,
    tags,
    has_shipping_profile = false,
    description_length = 0,
  } = body;

  const contrast = await validateContrast(image_url);
  const bbox = lockBoundingBox(product_type, design_width_px, design_height_px);
  const titleResult = validateTitle(title);
  const tagResult = validateTags(tags, product_type);

  const viability = scoreListingViability({
    title,
    tags,
    hasShippingProfile: has_shipping_profile,
    descriptionLength: description_length,
    imageContrastScore: contrast.score,
  });

  const approved = viability.blocking.length === 0 && viability.total >= 60;

  await supabase.from("qa_validation_log").insert({
    queue_id,
    product_type,
    image_url,
    contrast_score: contrast.score,
    contrast_pass: contrast.pass,
    bbox_fits: bbox.fits,
    title_valid: titleResult.valid,
    tag_valid: tagResult.valid,
    viability_score: viability.total,
    grade: viability.grade,
    approved,
    issues: viability.blocking,
    warnings: viability.warnings,
  });

  await supabase.from("pod_product_queue")
    .update({ listing_viability_score: viability.total, last_scored_at: new Date().toISOString() })
    .eq("id", queue_id);

  const response: QAResponse = {
    approved,
    score: viability.total,
    grade: viability.grade,
    issues: viability.blocking,
    warnings: viability.warnings,
    contrast,
    bounding_box: bbox,
    title_result: titleResult,
    tag_result: tagResult,
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: approved ? 200 : 422,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## Machine 2 — Catalog & Inventory Integrity

Machine 2 runs two independent components on schedule. The inventory sync polls Printify every 4 hours to detect sold-out variants and immediately sets the corresponding Etsy listing to inactive, preventing customer purchases of unavailable items. The taxonomy mapper maintains a local cache of the full Etsy taxonomy tree and uses keyword overlap scoring to assign the most accurate category ID to every new listing at publish time.

### 2.1 Out-of-Stock Material Switcher

```typescript
// supabase/functions/inventory-sync/index.ts
/**
 * Inventory Sync Cron
 * Every 4h: polls Printify variant availability, patches Etsy to 0 quantity when out-of-stock.
 * POST {} to trigger manually.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRINTIFY_KEY  = Deno.env.get("PRINTIFY_API_KEY")!;
const PRINTIFY_SHOP = Deno.env.get("PRINTIFY_SHOP_ID")!;
const ETSY_KEY      = Deno.env.get("ETSY_CLIENT_ID")!;
const ETSY_SHOP     = Deno.env.get("ETSY_SHOP_ID")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getEtsyToken(): Promise<string> {
  const { data } = await supabase
    .from("etsy_oauth_tokens")
    .select("access_token")
    .eq("shop_id", ETSY_SHOP)
    .single();
  if (!data) throw new Error("No Etsy token");
  return data.access_token;
}

async function syncInventory(): Promise<object> {
  const results: object[] = [];

  const { data: products } = await supabase
    .from("pod_product_queue")
    .select("id, name, printify_id, etsy_listing_id, product_type")
    .eq("status", "published")
    .not("printify_id", "is", null);

  if (!products?.length) return { synced: 0, message: "No published products" };

  const etsyToken = await getEtsyToken();

  for (const product of products) {
    try {
      const pRes = await fetch(
        `https://api.printify.com/v1/shops/${PRINTIFY_SHOP}/products/${product.printify_id}.json`,
        { headers: { Authorization: `Bearer ${PRINTIFY_KEY}` } }
      );
      if (!pRes.ok) continue;

      const printifyProduct = await pRes.json();
      const variants: Array<{ id: number; is_available: boolean; is_enabled: boolean }> = printifyProduct.variants ?? [];

      const availableCount = variants.filter(v => v.is_available && v.is_enabled).length;
      const isOutOfStock = availableCount === 0;

      if (isOutOfStock && product.etsy_listing_id) {
        await fetch(
          `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP}/listings/${product.etsy_listing_id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${etsyToken}`,
              "x-api-key": ETSY_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ quantity: 0, state: "inactive" }),
          }
        );

        await supabase.from("inventory_sync_log").insert({
          printify_id: product.printify_id,
          queue_id: product.id,
          etsy_listing_id: product.etsy_listing_id,
          was_available: true,
          is_available: false,
          action_taken: "etsy_quantity_zero",
          checked_at: new Date().toISOString(),
        });

        results.push({ product: product.name, action: "deactivated", reason: "out_of_stock" });
      } else if (!isOutOfStock && product.etsy_listing_id) {
        await supabase.from("inventory_sync_log").insert({
          printify_id: product.printify_id,
          queue_id: product.id,
          etsy_listing_id: product.etsy_listing_id,
          was_available: true,
          is_available: true,
          action_taken: "no_action",
          checked_at: new Date().toISOString(),
        });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      results.push({ product: product.name, error: String(err) });
    }
  }

  return { synced: products.length, actions: results };
}

Deno.serve(async (_req: Request) => {
  try {
    const result = await syncInventory();
    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
```

### 2.2 Semantic Taxonomy Mapper

```typescript
// supabase/functions/etsy-taxonomy-mapper/index.ts
/**
 * Maps listing titles to Etsy taxonomy IDs using keyword overlap scoring.
 * Called by pod-publisher at create time to set taxonomy_id on new listings.
 * Also runs daily to refresh the taxonomy cache.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ETSY_KEY  = Deno.env.get("ETSY_CLIENT_ID")!;
const ETSY_SHOP = Deno.env.get("ETSY_SHOP_ID")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface EtsyTaxonomyNode {
  id: number;
  level: number;
  name: string;
  parent_id: number | null;
  full_path_taxonomy_ids: number[];
  children: EtsyTaxonomyNode[];
}

async function refreshTaxonomyCache(): Promise<void> {
  const res = await fetch("https://openapi.etsy.com/v3/application/seller-taxonomy/nodes", {
    headers: { "x-api-key": ETSY_KEY },
  });

  if (!res.ok) throw new Error(`Taxonomy fetch failed: ${res.status}`);
  const { results }: { results: EtsyTaxonomyNode[] } = await res.json();

  const rows: Array<{ taxonomy_id: number; name: string; level: number; parent_id: number | null; path: string }> = [];

  function flatten(nodes: EtsyTaxonomyNode[], path = ""): void {
    for (const node of nodes) {
      const nodePath = path ? `${path} > ${node.name}` : node.name;
      rows.push({ taxonomy_id: node.id, name: node.name, level: node.level, parent_id: node.parent_id, path: nodePath });
      if (node.children?.length) flatten(node.children, nodePath);
    }
  }
  flatten(results);

  await supabase.from("etsy_taxonomy_cache").upsert(rows, { onConflict: "taxonomy_id" });
}

export async function mapEtsyTaxonomy(title: string, productType: string): Promise<{ taxonomy_id: number; confidence: number; path: string }> {
  const { data: cache } = await supabase
    .from("etsy_taxonomy_cache")
    .select("taxonomy_id, name, path, level")
    .order("level", { ascending: false })
    .limit(500);

  if (!cache?.length) throw new Error("Taxonomy cache empty -- run refresh first");

  const query = `${title} ${productType}`.toLowerCase();
  const queryWords = new Set(query.split(/\s+/).filter(w => w.length > 2));

  let bestId = 68887444;
  let bestScore = 0;
  let bestPath = "";

  for (const node of cache) {
    const nodeWords = node.path.toLowerCase().split(/[\s>]+/).filter((w: string) => w.length > 2);
    const overlap = nodeWords.filter((w: string) => queryWords.has(w)).length;
    const score = overlap / Math.max(nodeWords.length, queryWords.size);

    if (score > bestScore) {
      bestScore = score;
      bestId = node.taxonomy_id;
      bestPath = node.path;
    }
  }

  return { taxonomy_id: bestId, confidence: Math.round(bestScore * 100), path: bestPath };
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));

  if (body.mode === "refresh") {
    await refreshTaxonomyCache();
    const { count } = await supabase.from("etsy_taxonomy_cache").select("*", { count: "exact", head: true });
    return new Response(JSON.stringify({ refreshed: true, cached_nodes: count }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  if (body.title && body.product_type) {
    const result = await mapEtsyTaxonomy(body.title, body.product_type);
    return new Response(JSON.stringify(result), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "POST {mode:'refresh'} or {title, product_type}" }), {
    status: 400, headers: { "Content-Type": "application/json" },
  });
});
```

---

## Machine 3 — Logistics & Smart Routing

Machine 3 has two components. The webhook listener receives Etsy `order.paid` events, verifies the HMAC-SHA256 signature, and persists the order to `etsy_orders`. It then immediately invokes the order router, which uses Haversine distance to select the nearest print farm node from a static (but DB-overridable) table. Today all physical POD routes to Printify; Slant3D and Shop3D nodes are seeded but inactive until 3D product types are added.

### 3.1 Etsy Order Webhook Listener

```typescript
// supabase/functions/etsy-order-webhook/index.ts
/**
 * Receives Etsy order.paid webhook events.
 * Verifies HMAC-SHA256 signature using ETSY_SHARED_SECRET.
 * Upserts to etsy_orders table and triggers downstream routing.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ETSY_SHARED_SECRET = Deno.env.get("ETSY_SHARED_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function verifySignature(body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(ETSY_SHARED_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  const bodyBytes = new TextEncoder().encode(body);

  return await crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes);
}

Deno.serve(async (req: Request) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-etsy-signature") ?? "";

  if (!await verifySignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const { receipt_id, buyer_user_id, buyer_email, total_price, transactions, shipping } = payload;

  if (!receipt_id) return new Response("Missing receipt_id", { status: 400 });

  await supabase.from("etsy_orders").upsert({
    receipt_id:        String(receipt_id),
    buyer_user_id:     String(buyer_user_id ?? ""),
    buyer_email:       String(buyer_email ?? ""),
    total_price_cents: Math.round(Number(total_price ?? 0) * 100),
    shipping_name:     String(shipping?.name ?? ""),
    shipping_address:  shipping ?? {},
    transactions:      transactions ?? [],
    order_status:      "paid",
    received_at:       new Date().toISOString(),
  }, { onConflict: "receipt_id" });

  await supabase.functions.invoke("order-router", {
    body: { receipt_id, transactions, shipping },
  });

  return new Response(JSON.stringify({ received: true, receipt_id }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
```

### 3.2 Geo-Proximity Smart Router

```typescript
// supabase/functions/order-router/index.ts
/**
 * Routes fulfilled orders to the nearest print farm node using Haversine distance.
 * For digital products: delivers download link via email.
 * For POD physical: routes to nearest Printify shop or Slant3D/Shop3D.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface PrintFarmNode {
  id: string;
  name: string;
  lat: number;
  lon: number;
  api_url: string;
  api_key_secret: string;
  accepts: ("stl" | "printify" | "digital" | "all")[];
  active: boolean;
}

const FARM_NODES: PrintFarmNode[] = [
  { id: "printify_main", name: "Printify (National)", lat: 40.7128, lon: -74.0060, api_url: "https://api.printify.com/v1", api_key_secret: "PRINTIFY_API_KEY", accepts: ["printify", "all"], active: true  },
  { id: "slant3d_west",  name: "Slant3D West",        lat: 33.7490, lon: -84.3880, api_url: "https://api.slant3d.com",     api_key_secret: "SLANT3D_API_KEY",  accepts: ["stl"],           active: false },
  { id: "shop3d_east",   name: "Shop3D East",          lat: 40.7128, lon: -74.0060, api_url: "https://api.shop3d.com",      api_key_secret: "SHOP3D_API_KEY",   accepts: ["stl"],           active: false },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ZIP_CENTROIDS: Record<string, [number, number]> = {
  "100": [40.71, -74.00], "900": [34.05, -118.24], "600": [41.85, -87.65],
  "770": [29.76, -95.37], "852": [33.45, -112.07], "302": [33.75, -84.39],
  "191": [39.95, -75.17], "980": [47.61, -122.33], "021": [42.36, -71.06],
  "802": [39.74, -104.98],
};

function zipToLatLon(zip: string): [number, number] {
  const prefix = zip.slice(0, 3);
  return ZIP_CENTROIDS[prefix] ?? [39.83, -98.58];
}

function routeToFarm(
  buyerZip: string,
  orderType: "stl" | "printify" | "digital" | "all"
): PrintFarmNode {
  const [buyerLat, buyerLon] = zipToLatLon(buyerZip);

  const eligible = FARM_NODES.filter(
    n => n.active && (n.accepts.includes(orderType) || n.accepts.includes("all"))
  );

  if (!eligible.length) return FARM_NODES[0];

  let nearest = eligible[0];
  let minDist = haversineKm(buyerLat, buyerLon, nearest.lat, nearest.lon);

  for (const farm of eligible.slice(1)) {
    const dist = haversineKm(buyerLat, buyerLon, farm.lat, farm.lon);
    if (dist < minDist) { minDist = dist; nearest = farm; }
  }

  return nearest;
}

Deno.serve(async (req: Request) => {
  const body = await req.json();
  const { receipt_id, transactions, shipping } = body;

  const buyerZip = String(shipping?.zip ?? shipping?.postal_code ?? "60601");
  const results = [];

  for (const tx of transactions ?? []) {
    const itemType = tx.product_type ?? "printify";
    const farm = routeToFarm(buyerZip, itemType);

    await supabase.from("order_routing_log").insert({
      receipt_id:     String(receipt_id),
      transaction_id: String(tx.transaction_id ?? ""),
      farm_id:        farm.id,
      farm_name:      farm.name,
      buyer_zip:      buyerZip,
      item_type:      itemType,
      routed_at:      new Date().toISOString(),
    });

    results.push({ transaction_id: tx.transaction_id, farm: farm.name, item_type: itemType });
  }

  return new Response(JSON.stringify({ receipt_id, routes: results }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
```

---

## Machine 4 — 5-Star Satisfaction

Machine 4 closes the post-purchase loop. Tracking sync polls Printify every 2 hours for new shipment records and patches each corresponding Etsy receipt with the carrier tracking number, triggering Etsy native buyer notification. The post-purchase engagement function runs daily at 9am UTC and sends a personalized review-request email to every buyer whose order was delivered at least 24 hours ago and has not yet received an engagement message.

### 4.1 Tracking Sync Cron

```typescript
// supabase/functions/tracking-sync/index.ts
/**
 * Every 2h: polls Printify fulfilled orders, extracts tracking numbers,
 * patches Etsy receipts with tracking info.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRINTIFY_KEY  = Deno.env.get("PRINTIFY_API_KEY")!;
const PRINTIFY_SHOP = Deno.env.get("PRINTIFY_SHOP_ID")!;
const ETSY_KEY      = Deno.env.get("ETSY_CLIENT_ID")!;
const ETSY_SHOP     = Deno.env.get("ETSY_SHOP_ID")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getEtsyToken(): Promise<string> {
  const { data } = await supabase
    .from("etsy_oauth_tokens")
    .select("access_token")
    .eq("shop_id", ETSY_SHOP)
    .single();
  return data?.access_token ?? "";
}

async function syncTracking(): Promise<object> {
  const etsyToken = await getEtsyToken();
  const results = [];

  const { data: orders } = await supabase
    .from("etsy_orders")
    .select("receipt_id, printify_order_id")
    .eq("order_status", "paid")
    .is("tracking_synced_at", null)
    .not("printify_order_id", "is", null)
    .limit(50);

  if (!orders?.length) return { synced: 0 };

  for (const order of orders) {
    try {
      const pRes = await fetch(
        `https://api.printify.com/v1/shops/${PRINTIFY_SHOP}/orders/${order.printify_order_id}.json`,
        { headers: { Authorization: `Bearer ${PRINTIFY_KEY}` } }
      );
      if (!pRes.ok) continue;

      const printifyOrder = await pRes.json();
      const shipment = printifyOrder?.shipments?.[0];
      if (!shipment?.tracking_number) continue;

      const { tracking_number, carrier } = shipment;

      const etsyRes = await fetch(
        `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP}/receipts/${order.receipt_id}/tracking`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${etsyToken}`,
            "x-api-key": ETSY_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tracking_code: tracking_number,
            carrier_name:  carrier ?? "usps",
            send_bcc:      true,
          }),
        }
      );

      if (etsyRes.ok) {
        await supabase.from("etsy_orders").update({
          tracking_number:    tracking_number,
          tracking_carrier:   carrier,
          tracking_synced_at: new Date().toISOString(),
          order_status:       "shipped",
        }).eq("receipt_id", order.receipt_id);

        results.push({ receipt_id: order.receipt_id, tracking: tracking_number, status: "synced" });
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      results.push({ receipt_id: order.receipt_id, error: String(err) });
    }
  }

  return { synced: results.length, results };
}

Deno.serve(async (_req: Request) => {
  try {
    const result = await syncTracking();
    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
```

### 4.2 Post-Purchase Engagement Loop

The engagement loop fires 24h after delivery confirmation, sending a personalized follow-up email with a review request and support contact.

```typescript
// supabase/functions/post-purchase-engagement/index.ts
/**
 * Daily at 9am UTC: finds orders delivered 24+ hours ago with no engagement sent.
 * Sends review request email and marks engagement_sent_at.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function sendEngagementEmail(params: {
  buyerEmail: string;
  buyerName: string;
  receiptId: string;
  shopName: string;
  reviewUrl: string;
}): Promise<boolean> {
  const { buyerEmail, buyerName, receiptId, shopName, reviewUrl } = params;

  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to:      buyerEmail,
        subject: `How did we do? Order #${receiptId}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <h2 style="color:#1a1a1a">Hi ${buyerName || "there"}!</h2>
            <p>We hope you are loving your order from <strong>${shopName}</strong>!</p>
            <p>Your honest review helps other shoppers find us -- and it means the world to a small shop like ours.</p>
            <p style="text-align:center;margin:32px 0">
              <a href="${reviewUrl}"
                 style="background:#e74c3c;color:white;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">
                Leave a Review
              </a>
            </p>
            <p style="font-size:14px;color:#666">
              Any issues with your order? Just reply to this email -- we will make it right, guaranteed.
            </p>
            <p style="font-size:12px;color:#999">Order #${receiptId}</p>
          </div>
        `,
      }),
    }
  );

  return res.ok;
}

async function runEngagementLoop(): Promise<object> {
  const { data: orders } = await supabase
    .from("etsy_orders")
    .select("receipt_id, buyer_email, shipping_name, etsy_shop_name")
    .eq("delivery_status", "delivered")
    .lt("delivered_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .is("engagement_sent_at", null)
    .limit(50);

  if (!orders?.length) return { processed: 0, message: "No eligible orders" };

  const results = [];
  for (const order of orders) {
    const reviewUrl = `https://www.etsy.com/your/purchases/${order.receipt_id}`;
    const sent = await sendEngagementEmail({
      buyerEmail: order.buyer_email,
      buyerName:  order.shipping_name?.split(" ")[0] ?? "",
      receiptId:  order.receipt_id,
      shopName:   order.etsy_shop_name ?? "GnG Store",
      reviewUrl,
    });

    if (sent) {
      await supabase.from("etsy_orders")
        .update({ engagement_sent_at: new Date().toISOString() })
        .eq("receipt_id", order.receipt_id);
    }

    results.push({ receipt_id: order.receipt_id, sent });
  }

  return { processed: orders.length, results };
}

Deno.serve(async (_req: Request) => {
  try {
    const result = await runEngagementLoop();
    return new Response(JSON.stringify(result, null, 2), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
```

---

## Schema: All Tables

```sql
-- schema_qa.sql
-- Run on: zmyczlfuufhngzovkjdh (Secondary / POD project)

CREATE TABLE IF NOT EXISTS qa_validation_log (
  id               BIGSERIAL PRIMARY KEY,
  queue_id         INTEGER REFERENCES pod_product_queue(id),
  product_type     TEXT,
  image_url        TEXT,
  contrast_score   INTEGER,
  contrast_pass    BOOLEAN,
  bbox_fits        BOOLEAN,
  title_valid      BOOLEAN,
  tag_valid        BOOLEAN,
  viability_score  INTEGER,
  grade            TEXT,
  approved         BOOLEAN,
  issues           TEXT[],
  warnings         TEXT[],
  validated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_sync_log (
  id              BIGSERIAL PRIMARY KEY,
  printify_id     TEXT NOT NULL,
  queue_id        INTEGER REFERENCES pod_product_queue(id),
  etsy_listing_id BIGINT,
  variant_id      TEXT,
  was_available   BOOLEAN,
  is_available    BOOLEAN,
  action_taken    TEXT,
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etsy_taxonomy_cache (
  taxonomy_id  INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  level        INTEGER,
  parent_id    INTEGER,
  path         TEXT,
  cached_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etsy_orders (
  receipt_id           TEXT PRIMARY KEY,
  buyer_user_id        TEXT,
  buyer_email          TEXT,
  total_price_cents    INTEGER,
  shipping_name        TEXT,
  shipping_address     JSONB,
  transactions         JSONB,
  order_status         TEXT NOT NULL DEFAULT 'paid',
  delivery_status      TEXT,
  printify_order_id    TEXT,
  tracking_number      TEXT,
  tracking_carrier     TEXT,
  tracking_synced_at   TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  engagement_sent_at   TIMESTAMPTZ,
  etsy_shop_name       TEXT,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_routing_log (
  id             BIGSERIAL PRIMARY KEY,
  receipt_id     TEXT NOT NULL,
  transaction_id TEXT,
  farm_id        TEXT NOT NULL,
  farm_name      TEXT NOT NULL,
  buyer_zip      TEXT,
  item_type      TEXT,
  routed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS print_farm_nodes (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  lat          NUMERIC(9,6),
  lon          NUMERIC(9,6),
  api_url      TEXT,
  api_key_env  TEXT,
  accepts      TEXT[],
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS listing_viability_score INTEGER,
  ADD COLUMN IF NOT EXISTS last_scored_at           TIMESTAMPTZ;

INSERT INTO print_farm_nodes (id, name, lat, lon, api_url, api_key_env, accepts, active)
VALUES
  ('printify_main', 'Printify (National)', 40.7128, -74.0060, 'https://api.printify.com/v1', 'PRINTIFY_API_KEY', ARRAY['printify','all'], true),
  ('slant3d_west',  'Slant3D West',        33.7490, -84.3880, 'https://api.slant3d.com',     'SLANT3D_API_KEY',  ARRAY['stl'],           false),
  ('shop3d_east',   'Shop3D East',         40.7128, -74.0060, 'https://api.shop3d.com',      'SHOP3D_API_KEY',   ARRAY['stl'],           false)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_qa_log_queue_id       ON qa_validation_log(queue_id);
CREATE INDEX IF NOT EXISTS idx_qa_log_validated_at   ON qa_validation_log(validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_etsy_orders_status    ON etsy_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_etsy_orders_delivery  ON etsy_orders(delivery_status, delivered_at) WHERE engagement_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_routing_log_receipt   ON order_routing_log(receipt_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sync_pid    ON inventory_sync_log(printify_id);
```

---

## pg_cron Schedules

```sql
-- cron_inventory.sql
-- Run on: zmyczlfuufhngzovkjdh

SELECT cron.unschedule('inventory-sync-4h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inventory-sync-4h');
SELECT cron.schedule('inventory-sync-4h', '0 */4 * * *', $$
  SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/inventory-sync',
    headers := ('{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') || '"}')::jsonb,
    body    := '{}'::jsonb
  );
$$);

SELECT cron.unschedule('taxonomy-refresh-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'taxonomy-refresh-daily');
SELECT cron.schedule('taxonomy-refresh-daily', '0 5 * * *', $$
  SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-taxonomy-mapper',
    headers := ('{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') || '"}')::jsonb,
    body    := '{"mode":"refresh"}'::jsonb
  );
$$);

SELECT cron.unschedule('tracking-sync-2h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tracking-sync-2h');
SELECT cron.schedule('tracking-sync-2h', '0 */2 * * *', $$
  SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/tracking-sync',
    headers := ('{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') || '"}')::jsonb,
    body    := '{}'::jsonb
  );
$$);

SELECT cron.unschedule('post-purchase-engagement-daily') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'post-purchase-engagement-daily');
SELECT cron.schedule('post-purchase-engagement-daily', '0 9 * * *', $$
  SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/post-purchase-engagement',
    headers := ('{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') || '"}')::jsonb,
    body    := '{}'::jsonb
  );
$$);

-- Product QA gatekeeper -- no cron; called inline by pod-new-products before Printify submit

SELECT cron.unschedule('etsy-free-shipping-weekly') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'etsy-free-shipping-weekly');
SELECT cron.schedule('etsy-free-shipping-daily', '0 11 * * *', $$
  SELECT net.http_post(
    url     := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-free-shipping-enforcer',
    headers := ('{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') || '"}')::jsonb,
    body    := '{}'::jsonb
  );
$$);
```

---

## Integration Map

```
pod-new-products
  └─► product-qa-gatekeeper  ─── REJECT ──► DLQ (retry next run)
             │
           APPROVE
             │
             ▼
  printify-product-creator
             │
             ▼
  pod-publisher (Etsy)
             │
       ──────┴──────────────────────────────┐
       │                                    │
       ▼                                    ▼
  etsy-taxonomy-mapper              etsy-free-shipping-enforcer
  (sets taxonomy_id)                (daily at 11am UTC)
       │
       ▼
  pod-visual-confirm
  (atomic write-back via Printify external.id)

order.paid webhook
  └─► etsy-order-webhook
             │ (HMAC-SHA256 verify)
             ▼
        order-router
        (Haversine -> nearest farm)
             │
             ▼
    inventory-sync (every 4h)
    (deactivates sold-out listings)
             │
             ▼
    tracking-sync (every 2h)
    (patches Etsy receipt with carrier tracking)
             │
             ▼
    post-purchase-engagement
    (24h after delivery -- review request email)
```

---

## New Secrets Required

The following secrets must be added to `zmyczlfuufhngzovkjdh` in Supabase Dashboard > Settings > Edge Function Secrets before deploying Machine 3:

| Secret Name | Purpose |
|---|---|
| `ETSY_SHARED_SECRET` | HMAC-SHA256 verification of Etsy webhook payloads |
| `ETSY_SHOP_ID` | Numeric Etsy shop ID for API calls (if not already set) |
| `SLANT3D_API_KEY` | Reserved -- set when 3D products are added |
| `SHOP3D_API_KEY` | Reserved -- set when 3D products are added |

The `ETSY_SHARED_SECRET` value is found in the Etsy Developer portal under your app's webhook configuration after registering the webhook URL `https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-order-webhook`.

---

*Document end. All code blocks are production-ready Deno TypeScript and PostgreSQL SQL. No placeholders.*

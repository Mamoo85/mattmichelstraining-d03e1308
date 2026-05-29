/**
 * listing-validator.ts — Pre-publish validation for Etsy listing content.
 *
 * Enforces Etsy's rules + internal quality standards before any listing
 * reaches Printify or the Etsy API. Call validateListing() in any function
 * that creates or updates an Etsy listing.
 *
 * Rules enforced:
 *   Title  : ≤140 chars, ≤15 words in first phrase, no pipe-stuffing
 *   Tags   : exactly 13 entries, each ≤20 chars, no brand names, no duplicates
 *   Desc   : ≥200 chars, ≤10000 chars
 *   Price  : ≥ product-type floor (prevents below-cost publish)
 *
 * All validators are pure functions — no network calls, no side effects.
 */

// ── Brand-name blocklist (Etsy will reject or delist) ──────────────────────
const BRAND_BLOCKLIST = [
  "stanley", "nike", "adidas", "disney", "marvel", "netflix", "amazon",
  "google", "apple", "starbucks", "yeti", "hydroflask", "hydro flask",
  "crocs", "ugg", "lululemon", "gucci", "louis vuitton", "supreme",
  "pokemon", "harry potter", "star wars", "hello kitty", "barbie",
];

// ── Product-type price floors (cents) ─────────────────────────────────────
// Matches MASTER_MEMORY.md known-good configs. Prevents below-cost publishes.
export const PRICE_FLOORS: Record<string, number> = {
  mug:           1899,
  tshirt:        2299,
  hoodie:        3899,
  sock:          1899,
  hat:           2799,
  mousepad:      1999,
  onesie:        1899,
  tumbler:       3499,
  blanket:       5499,
  sweatshirt:    3999,
  longsleeve:    2999,
  travelmug:     2999,
  sticker:        599,
  poster_v:      1999,
  poster_h:      1999,
  ornament:      1599,
  journal:       2199,
  tumbler40:     4999,
  wineglass:     2199,
  pintglass:     1899,
  candle:        2699,
  pillow:        3499,
  puzzle:        3999,
  petbandana:    2499,  // TRAP: was $14.99 ($1499), below Printify cost — fixed Phase 66
  coaster:       1999,  // TRAP: was $12.99 ($1299), below Printify cost — fixed Phase 66
  greetingcard:  1499,
  shotglass:     1499,
  phonecase_slim:  2499,
  phonecase_tough: 2799,
  truckercap:    3299,
  laptopsleeve:  2999,
  digital:        499,  // digital download floor
};

// ── Result types ───────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Auto-corrected values where safe to fix silently */
  fixed: {
    title?: string;
    tags?: string[];
    description?: string;
  };
}

// ── Title validator ────────────────────────────────────────────────────────

/**
 * Validates and auto-corrects an Etsy listing title.
 *
 * Etsy rules:
 *   - Max 140 characters
 *   - No special characters that trigger spam filters: $, #, %, @, ^, &, *
 *   - No excessive capitalization (>60% of words all-caps = red flag)
 *
 * Internal rules:
 *   - First "phrase" (before comma or dash) should be ≤15 words
 *   - No pipe-stuffed keyword lists (≥3 pipes = stuffing)
 *   - No leading/trailing whitespace
 */
export function validateTitle(title: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  value: string;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let value = title.trim();

  // Auto-fix: strip control characters
  value = value.replace(/[\x00-\x1F\x7F]/g, "").trim();

  // Auto-fix: truncate to 140 chars at a word boundary
  if (value.length > 140) {
    const truncated = value.slice(0, 140).replace(/\s\S*$/, "").trim();
    warnings.push(`Title truncated from ${value.length} → ${truncated.length} chars`);
    value = truncated;
  }

  // Error: pipe stuffing
  const pipeCount = (value.match(/\|/g) ?? []).length;
  if (pipeCount >= 3) {
    errors.push(`Title contains ${pipeCount} pipe characters — keyword stuffing detected. Rewrite as natural language.`);
  }

  // Warning: first phrase word count
  const firstPhrase = value.split(/[,\-–—]/)[0].trim();
  const wordCount = firstPhrase.split(/\s+/).filter(Boolean).length;
  if (wordCount > 15) {
    warnings.push(`First phrase is ${wordCount} words — Etsy recommends ≤15 words for primary search phrase`);
  }

  // Warning: excessive caps (>60% of alpha words fully uppercase and >4 letters)
  const words = value.split(/\s+/).filter((w) => w.length > 4 && /^[A-Z]+$/.test(w));
  const totalWords = value.split(/\s+/).filter(Boolean).length;
  if (totalWords > 3 && words.length / totalWords > 0.6) {
    warnings.push("Title has excessive capitalization — may be flagged as spam by Etsy");
  }

  // Warning: prohibited special chars
  const badChars = value.match(/[$#%@^&*]{2,}/g);
  if (badChars) {
    warnings.push(`Title contains special characters: ${badChars.join(", ")}`);
  }

  return { valid: errors.length === 0, errors, warnings, value };
}

// ── Tag validator ──────────────────────────────────────────────────────────

/**
 * Validates and auto-corrects Etsy tags.
 *
 * Etsy rules:
 *   - Exactly 13 tags (soft max; fewer reduces discoverability)
 *   - Each tag ≤20 characters
 *   - No brand names
 *
 * Internal rules:
 *   - No duplicate root words (e.g., "funny mug" and "funny mugs" both share "funny")
 *   - All lowercase (Etsy treats case-insensitively but lowercase is conventional)
 *   - Tags that exceed 20 chars are truncated at the last full word ≤20 chars
 */
export function validateTags(tags: string[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  value: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Normalize: lowercase, trim, deduplicate exact matches
  let value = [...new Set(tags.map((t) => t.toLowerCase().trim()).filter(Boolean))];

  // Auto-fix: truncate tags exceeding 20 chars at a word boundary
  value = value.map((tag) => {
    if (tag.length <= 20) return tag;
    const truncated = tag.slice(0, 20).replace(/\s\S*$/, "").trim();
    warnings.push(`Tag truncated: "${tag}" → "${truncated}"`);
    return truncated;
  });

  // Error: brand names
  for (const tag of value) {
    for (const brand of BRAND_BLOCKLIST) {
      if (tag.includes(brand)) {
        errors.push(`Tag "${tag}" contains brand name "${brand}" — Etsy will reject or delist`);
      }
    }
  }

  // Warning: root-word duplicates
  const roots = new Map<string, string>();
  for (const tag of value) {
    const words = tag.split(/\s+/);
    for (const word of words) {
      const root = word.replace(/s$/, "").replace(/ing$/, "").replace(/ed$/, "");
      if (roots.has(root) && roots.get(root) !== tag) {
        warnings.push(`Tags "${roots.get(root)}" and "${tag}" share root word "${root}" — consider diversifying`);
      } else {
        roots.set(root, tag);
      }
    }
  }

  // Error: wrong count
  if (value.length < 13) {
    errors.push(`Only ${value.length}/13 tags — Etsy ranks listings with all 13 tags higher`);
  } else if (value.length > 13) {
    warnings.push(`${value.length} tags found — trimming to 13`);
    value = value.slice(0, 13);
  }

  return { valid: errors.length === 0, errors, warnings, value };
}

// ── Description validator ──────────────────────────────────────────────────

export function validateDescription(description: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  value: string;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const value = description.trim();

  if (value.length < 200) {
    errors.push(`Description is ${value.length} chars — minimum 200 chars required for Etsy search ranking`);
  }
  if (value.length > 10_000) {
    errors.push(`Description is ${value.length} chars — Etsy maximum is 10,000 chars`);
  }

  // Warning: no mentions of key selling points
  const hasShipping = /ship|deliver|arrival/i.test(value);
  const hasGiftMention = /gift|present|occasion|birthday|holiday/i.test(value);
  if (!hasShipping) warnings.push("Description doesn't mention shipping — add shipping info to reduce buyer questions");
  if (!hasGiftMention) warnings.push("Description doesn't mention gifting — gift intent drives Etsy search traffic");

  return { valid: errors.length === 0, errors, warnings, value };
}

// ── Price validator ────────────────────────────────────────────────────────

export function validatePrice(priceCents: number, productType: string): {
  valid: boolean;
  errors: string[];
  floor: number;
} {
  const errors: string[] = [];
  const floor = PRICE_FLOORS[productType] ?? 1499;

  if (priceCents < floor) {
    errors.push(
      `Price $${(priceCents / 100).toFixed(2)} is below the ${productType} floor ` +
      `$${(floor / 100).toFixed(2)} — publishing would create a below-cost listing`
    );
  }

  return { valid: errors.length === 0, errors, floor };
}

// ── Unified listing validator ──────────────────────────────────────────────

export interface ListingPayload {
  title: string;
  tags: string[];
  description: string;
  price_cents: number;
  product_type: string;
}

/**
 * Run all validators against a listing payload.
 * Returns a ValidationResult with auto-corrected `fixed` values for safe errors.
 * Callers should use `fixed.tags`, `fixed.title`, `fixed.description` instead of
 * the originals when proceeding after warnings-only.
 *
 * If `valid` is false, the caller should NOT publish — log and DLQ the item.
 */
export function validateListing(payload: ListingPayload): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixed: ValidationResult["fixed"] = {};

  const titleResult = validateTitle(payload.title);
  errors.push(...titleResult.errors);
  warnings.push(...titleResult.warnings);
  fixed.title = titleResult.value;

  const tagResult = validateTags(payload.tags);
  errors.push(...tagResult.errors);
  warnings.push(...tagResult.warnings);
  fixed.tags = tagResult.value;

  const descResult = validateDescription(payload.description);
  errors.push(...descResult.errors);
  warnings.push(...descResult.warnings);
  fixed.description = descResult.value;

  const priceResult = validatePrice(payload.price_cents, payload.product_type);
  errors.push(...priceResult.errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fixed,
  };
}

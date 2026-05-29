// _shared/validate-listing.ts
// Verbatim from SYSTEM_VIABILITY_AND_REMEDIATION_REPORT.md Part 3
// Used by pod-seo-agent scoreAll mode and any function that needs to gate listing quality.

export interface TitleValidationResult {
  valid: boolean;
  title: string;
  issues: string[];
  score: number; // 0–100
}

export function validateTitle(title: string): TitleValidationResult {
  const issues: string[] = [];
  let t = title.trim();
  let score = 100;

  // 1. Length check — Etsy allows 140 chars max
  if (t.length > 140) {
    t = t.slice(0, 140).trimEnd();
    issues.push(`Title truncated from ${title.length} to 140 chars`);
    score -= 10;
  }

  // 2. Pipe-delimited keyword stuffing check
  const pipeCount = (t.match(/\|/g) ?? []).length;
  if (pipeCount >= 3) {
    issues.push(`Pipe-delimited stuffing detected (${pipeCount} pipes) — rewrite as natural language`);
    score -= 30;
  }

  // 3. Word count check — primary phrase should be ≤15 words
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 15) {
    issues.push(`Title is ${words.length} words — recommend ≤15 for primary phrase clarity`);
    score -= 5;
  }

  // 4. ALL_CAPS check
  const allCapsWords = words.filter(w => w.length > 3 && w === w.toUpperCase());
  if (allCapsWords.length >= 3) {
    issues.push(`${allCapsWords.length} ALL-CAPS words detected — convert to title case`);
    score -= 15;
  }

  // 5. Gift-intent phrase check (positive signal)
  const giftPhrases = ["gift for", "gift idea", "perfect gift", "birthday gift", "christmas gift"];
  const hasGiftIntent = giftPhrases.some(p => t.toLowerCase().includes(p));
  if (!hasGiftIntent) score -= 5; // minor penalty; not blocking

  // 6. Brand name check — eBay/Etsy prohibit brand names in title
  const forbiddenBrands = ["nike", "apple", "disney", "gucci", "supreme", "starbucks"];
  const foundBrand = forbiddenBrands.find(b => t.toLowerCase().includes(b));
  if (foundBrand) {
    issues.push(`Brand name "${foundBrand}" detected — remove to avoid takedown`);
    score -= 50;
  }

  return { valid: issues.filter(i => !i.includes("recommend")).length === 0, title: t, issues, score };
}

export interface TagValidationResult {
  valid: boolean;
  tags: string[];
  issues: string[];
}

const EMERGENCY_FALLBACK_TAGS: Record<string, string[]> = {
  mug: ["coffee mug", "funny mug", "gift for her", "gift for him", "novelty mug", "ceramic mug", "11oz mug", "office gift", "birthday gift", "coworker gift", "unique gift", "humor gift", "tea mug"],
  tshirt: ["funny shirt", "graphic tee", "unisex shirt", "gift shirt", "novelty tshirt", "humor tee", "casual shirt", "birthday shirt", "cool tshirt", "statement shirt", "gift for him", "gift for her", "fun tee"],
  hoodie: ["funny hoodie", "graphic hoodie", "unisex hoodie", "gift hoodie", "pullover hoodie", "novelty hoodie", "casual hoodie", "birthday gift", "cool hoodie", "statement hoodie", "gift for him", "cozy hoodie", "fun hoodie"],
  default: ["funny gift", "novelty gift", "unique gift", "birthday gift", "gift for her", "gift for him", "coworker gift", "office gift", "holiday gift", "funny present", "cool gift", "humor gift", "special gift"],
};

export function validateTags(tags: string[], productType?: string): TagValidationResult {
  const issues: string[] = [];
  let t = [...tags];

  // Must have exactly 13
  if (t.length !== 13) {
    issues.push(`Tag count is ${t.length}, must be exactly 13`);
    if (t.length > 13) t = t.slice(0, 13);
    if (t.length < 13) {
      const fallback = EMERGENCY_FALLBACK_TAGS[productType ?? "default"] ?? EMERGENCY_FALLBACK_TAGS.default;
      while (t.length < 13) {
        const candidate = fallback[t.length % fallback.length];
        if (!t.includes(candidate)) t.push(candidate);
        else t.push(`${candidate} gift`);
      }
      issues.push(`Padded with emergency fallback tags`);
    }
  }

  // Each tag ≤20 chars
  t = t.map((tag, i) => {
    if (tag.length > 20) {
      issues.push(`Tag[${i}] "${tag}" is ${tag.length} chars — truncating to 20`);
      return tag.slice(0, 20).trimEnd();
    }
    return tag;
  });

  // No duplicate root words
  const roots = new Set<string>();
  t = t.filter((tag) => {
    const root = tag.toLowerCase().split(/\s+/)[0];
    if (roots.has(root)) {
      issues.push(`Duplicate root word "${root}" — removed duplicate tag "${tag}"`);
      return false;
    }
    roots.add(root);
    return true;
  });
  // Pad back to 13 if dedup removed tags
  while (t.length < 13) {
    const fallback = EMERGENCY_FALLBACK_TAGS[productType ?? "default"] ?? EMERGENCY_FALLBACK_TAGS.default;
    const candidate = fallback.find(f => !t.includes(f) && !roots.has(f.split(" ")[0]));
    if (candidate) { t.push(candidate); roots.add(candidate.split(" ")[0]); }
    else break;
  }

  // No brand names
  const forbiddenBrands = ["nike", "disney", "apple", "gucci", "starbucks", "amazon"];
  t.forEach((tag, i) => {
    if (forbiddenBrands.some(b => tag.toLowerCase().includes(b))) {
      issues.push(`Tag[${i}] "${tag}" contains brand name — must remove`);
    }
  });

  return { valid: t.length === 13 && issues.filter(i => i.includes("must")).length === 0, tags: t, issues };
}

export interface ListingViabilityScore {
  total: number;   // 0–100
  grade: "A" | "B" | "C" | "F";
  breakdown: {
    title:       number;
    tags:        number;
    shipping:    number;
    description: number;
    image:       number;
  };
  blocking: string[];  // issues that prevent publishing
  warnings: string[];  // issues that reduce score but don't block
}

export function scoreListingViability(params: {
  title: string;
  tags: string[];
  hasShippingProfile: boolean;
  descriptionLength: number;
  imageContrastScore: number; // 1–5 from Vision API
}): ListingViabilityScore {
  const blocking: string[] = [];
  const warnings: string[] = [];

  // Title (25 pts)
  const titleResult = validateTitle(params.title);
  const titleScore = Math.round((titleResult.score / 100) * 25);
  if (!titleResult.valid) blocking.push(...titleResult.issues.filter(i => !i.includes("recommend")));

  // Tags (25 pts)
  const tagResult = validateTags(params.tags);
  const tagScore = tagResult.valid ? 25 : Math.round((params.tags.length / 13) * 25);
  if (!tagResult.valid) blocking.push(`Tags invalid: ${tagResult.issues[0]}`);

  // Shipping (15 pts)
  const shippingScore = params.hasShippingProfile ? 15 : 0;
  if (!params.hasShippingProfile) warnings.push("No free shipping profile — apply within 24h of publish");

  // Description (15 pts)
  const descScore = params.descriptionLength >= 200 ? 15
    : params.descriptionLength >= 100 ? 10
    : params.descriptionLength >= 50  ? 5 : 0;
  if (params.descriptionLength < 200) warnings.push(`Description is ${params.descriptionLength} chars — target ≥200`);

  // Image (20 pts)
  const imgScore = Math.round((params.imageContrastScore / 5) * 20);
  if (params.imageContrastScore < 3) blocking.push(`Image contrast score ${params.imageContrastScore}/5 — below WCAG threshold; regenerate`);

  const total = titleScore + tagScore + shippingScore + descScore + imgScore;
  const grade = total >= 90 ? "A" : total >= 75 ? "B" : total >= 60 ? "C" : "F";

  return { total, grade, breakdown: { title: titleScore, tags: tagScore, shipping: shippingScore, description: descScore, image: imgScore }, blocking, warnings };
}

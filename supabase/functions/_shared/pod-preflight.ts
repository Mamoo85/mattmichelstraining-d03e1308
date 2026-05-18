// Pre-publish quality gate for POD products.
// Returns { ok: true } or { ok: false, reasons: string[] } so the orchestrator
// can refuse to send junk to Printify/Etsy.

export interface PreflightProduct {
  name: string;
  type: string;
  imagePrompt?: string;
  title?: string;
  description?: string;
  tags?: string[];
  retailPrice?: number;
}

// Trademark / IP / banned content keywords (Etsy will suppress or delete)
const BANNED_PHRASES = [
  // Pop culture / IP
  "disney", "marvel", "star wars", "harry potter", "hogwarts", "stranger things",
  "taylor swift", "swiftie", "olivia rodrigo", "beyonce", "kardashian",
  "nfl", "nba", "mlb", "nhl", "olympic", "super bowl",
  "pokemon", "nintendo", "mario", "zelda", "minecraft",
  "barbie", "bluey", "peppa pig", "paw patrol",
  "nike", "adidas", "supreme", "louis vuitton", "gucci", "chanel",
  // Sensitive / risky
  "suicide", "kill yourself", "depression cure", "anxiety cure",
  "anti-vax", "trump 2024", "biden 2024", "maga", "antifa",
  "covid cure", "miracle cure",
  // Spammy generic that get suppressed
  "best ever", "world's best",
];

// Holiday/topic the user explicitly excluded
const EXCLUDED_HOLIDAYS = [
  "father's day", "fathers day", "graduation", "grad 2026",
];

const FORBIDDEN_IN_TITLE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u; // emoji

export interface PreflightResult {
  ok: boolean;
  reasons: string[];
  warnings: string[];
}

export function preflightProduct(p: PreflightProduct, opts?: { allowExcludedHoliday?: boolean }): PreflightResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const title = (p.title || p.name || "").trim();
  const desc = (p.description || "").trim();
  const tags = (p.tags || []).map((t) => String(t).toLowerCase());
  const allText = `${title} ${desc} ${tags.join(" ")} ${p.imagePrompt || ""}`.toLowerCase();

  // ---- Title ----
  if (!title) reasons.push("missing_title");
  if (title.length > 140) reasons.push(`title_too_long_${title.length}`); // Etsy hard cap = 140
  if (title.length < 30) reasons.push(`title_too_short_${title.length}`);
  if (FORBIDDEN_IN_TITLE.test(title)) reasons.push("title_contains_emoji");
  if (/[A-Z]{6,}/.test(title)) warnings.push("title_has_long_uppercase_run");
  if (title.endsWith("...") || /\b[A-Za-z]{1,3}$/.test(title.split(",").pop()?.trim() || "")) {
    warnings.push("title_may_be_truncated");
  }

  // ---- Description ----
  if (!desc) reasons.push("missing_description");
  if (desc.length < 200) reasons.push(`description_too_short_${desc.length}`);
  if (desc.length > 1800) reasons.push(`description_too_long_${desc.length}`);

  // Product-type / description match
  const lower = desc.toLowerCase();
  const type = (p.type || "").toLowerCase();
  if (type === "mug" && !/(mug|cup|ceramic)/.test(lower)) reasons.push("desc_missing_mug_mention");
  if (type === "tshirt" && !/(shirt|tee|t-shirt)/.test(lower)) reasons.push("desc_missing_shirt_mention");
  if (type === "hoodie" && !/(hoodie|sweatshirt|pullover)/.test(lower)) reasons.push("desc_missing_hoodie_mention");
  if (type === "tote" && !/(tote|bag|canvas)/.test(lower)) reasons.push("desc_missing_tote_mention");

  // ---- Tags ----
  if (tags.length !== 13) reasons.push(`tag_count_${tags.length}_expected_13`);
  for (const t of tags) {
    if (t.length > 20) reasons.push(`tag_too_long:${t.slice(0, 25)}`);
    if (!/^[a-z0-9 \-]+$/.test(t)) reasons.push(`tag_bad_chars:${t.slice(0, 25)}`);
    if (t.length < 3) reasons.push(`tag_too_short:${t}`);
  }
  if (new Set(tags).size !== tags.length) reasons.push("duplicate_tags");

  // ---- Banned content (anywhere in copy) ----
  for (const ph of BANNED_PHRASES) {
    if (allText.includes(ph)) reasons.push(`banned_phrase:${ph}`);
  }
  if (!opts?.allowExcludedHoliday) {
    for (const ph of EXCLUDED_HOLIDAYS) {
      if (allText.includes(ph)) reasons.push(`excluded_holiday:${ph}`);
    }
  }

  // ---- Image prompt sanity ----
  const prompt = (p.imagePrompt || "").toLowerCase();
  if (!prompt) reasons.push("missing_image_prompt");
  if (type !== "mug" && prompt && !/transparent|alpha/.test(prompt)) {
    reasons.push("apparel_prompt_missing_transparent_bg");
  }
  if (type === "mug" && prompt && !/white|#fff|#ffffff/.test(prompt)) {
    warnings.push("mug_prompt_missing_white_bg");
  }

  return { ok: reasons.length === 0, reasons, warnings };
}

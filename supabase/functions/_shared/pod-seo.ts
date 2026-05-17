// Shared SEO copy helpers for POD listings.
// Etsy hard limits: title ≤140 chars, exactly 13 tags ≤20 chars each, no special chars in tags.

export interface SeoCopy {
  title: string;
  tags: string[];
  description: string;
}

const TAG_RE = /[^a-zA-Z0-9 -]/g;

export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    if (!t) continue;
    const cleaned = t.replace(TAG_RE, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (!cleaned || cleaned.length > 20) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length === 13) break;
  }
  return out;
}

export function padTagsTo13(tags: string[], niche: string, type: string): string[] {
  const filler = normalizeTags([
    `${niche} gift`,
    `${niche} ${type}`,
    `${type} gift`,
    `funny ${type}`,
    "gift for her",
    "gift for him",
    "birthday gift",
    "unique gift",
    "trending gift",
    "small batch",
    "made to order",
    "print on demand",
    `${niche} lover`,
  ]);
  const merged = normalizeTags([...tags, ...filler]);
  return merged.slice(0, 13);
}

export function clampTitle(title: string): string {
  if (title.length <= 140) return title;
  return title.slice(0, 137).trim() + "...";
}

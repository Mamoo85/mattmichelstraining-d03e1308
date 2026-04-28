// Shared Firecrawl helpers for deterministic public-page scraping.
// Used by Mortgage Radar Phase B scanners (FSBO, estate sales, etc).
// Replaces LLM "discovery" — every address comes from a real, fetched page.

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

export interface ScrapedPage {
  url: string;
  markdown: string;
  html?: string;
  status: number;
}

/** Single-page scrape via Firecrawl /scrape. Returns null on failure (non-fatal). */
export async function firecrawlScrape(
  url: string,
  opts: { timeoutMs?: number; onlyMainContent?: boolean } = {},
): Promise<ScrapedPage | null> {
  if (!FIRECRAWL_API_KEY) {
    console.warn("[firecrawl] FIRECRAWL_API_KEY not set — scrape skipped");
    return null;
  }
  try {
    const r = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: opts.onlyMainContent ?? true,
        timeout: 25_000,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
    if (!r.ok) {
      console.warn(`[firecrawl] scrape ${url} -> HTTP ${r.status}`);
      return null;
    }
    const j = await r.json();
    const data = j?.data || {};
    return {
      url,
      markdown: String(data.markdown || ""),
      html: data.html ? String(data.html) : undefined,
      status: 200,
    };
  } catch (e) {
    console.warn(`[firecrawl] scrape error ${url}:`, e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Verify a candidate URL actually contains the expected address text.
 * Beats the "200 OK on a search page" false positive class flagged by Gemini's review.
 */
export async function verifyUrlContainsAddress(
  url: string,
  addressFragment: string,
): Promise<boolean> {
  if (!url || !addressFragment) return false;
  const page = await firecrawlScrape(url, { onlyMainContent: true });
  if (!page || !page.markdown) return false;
  const haystack = page.markdown.toLowerCase();
  const needle = addressFragment.toLowerCase();
  // Require the street number + at least the first word of the street name to appear together
  const streetTokens = needle.split(/\s+/).slice(0, 2).join(" ");
  return haystack.includes(streetTokens);
}

/** US street-address regex — matches "1234 Main St" / "1234 Willow Way" / "1234 N Main Ave" */
const ADDR_RE = /\b(\d{1,6})\s+([A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4})\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Ter|Terrace|Cir|Circle|Hwy|Highway)\b\.?/g;
const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;

export interface ExtractedAddress {
  address: string;
  zip?: string;
  context: string; // ~120 chars surrounding the match — used by contradiction-check
}

/** Pull every plausible US street address out of a markdown blob. Deterministic, no AI. */
export function extractAddressesFromMarkdown(md: string, opts: { max?: number } = {}): ExtractedAddress[] {
  const out: ExtractedAddress[] = [];
  const seen = new Set<string>();
  const max = opts.max ?? 50;
  // Reset regex state
  ADDR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ADDR_RE.exec(md)) !== null && out.length < max) {
    const address = `${m[1]} ${m[2]} ${m[3]}`.replace(/\s+/g, " ").trim();
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const start = Math.max(0, m.index - 40);
    const end = Math.min(md.length, m.index + address.length + 80);
    const context = md.slice(start, end).replace(/\s+/g, " ").trim();
    const zipMatch = context.match(ZIP_RE);
    out.push({
      address,
      zip: zipMatch ? zipMatch[1] : undefined,
      context,
    });
  }
  return out;
}

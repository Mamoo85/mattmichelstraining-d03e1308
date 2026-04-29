// _shared/firecrawl.ts — centralized Firecrawl scraping helper.
// Used for fax number extraction, contact page scraping, and structured data extraction.
// Always falls back gracefully — never throws.

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

export interface FirecrawlResult {
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    ogDescription?: string;
    sourceURL?: string;
  };
  linksOnPage?: string[];
}

/** Scrape a single URL and return markdown + metadata. Returns null on failure. */
export async function firecrawlScrape(url: string, options?: {
  onlyMainContent?: boolean;
  includeHtml?: boolean;
  timeout?: number;
}): Promise<FirecrawlResult | null> {
  if (!FIRECRAWL_API_KEY || !url) return null;
  try {
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: options?.includeHtml ? ["markdown", "html"] : ["markdown"],
        onlyMainContent: options?.onlyMainContent ?? true,
      }),
      signal: AbortSignal.timeout(options?.timeout ?? 12_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data || null;
  } catch {
    return null;
  }
}

/** Extract a fax number from a website using Firecrawl.
 *  Waterfall: Firecrawl structured scrape → regex on markdown → null.
 */
export async function extractFaxNumber(websiteUrl: string): Promise<string | null> {
  if (!websiteUrl) return null;

  // Try contact page first, then homepage
  const urlsToTry = [
    websiteUrl.replace(/\/$/, "") + "/contact",
    websiteUrl.replace(/\/$/, "") + "/contact-us",
    websiteUrl,
  ];

  for (const url of urlsToTry) {
    const result = await firecrawlScrape(url, { onlyMainContent: false, includeHtml: true });
    const text = (result?.markdown || "") + " " + (result?.html || "");
    if (!text.trim()) continue;

    // Fax-specific patterns (prioritize labeled fax numbers)
    const faxPatterns = [
      /fax[:\s#]*\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})/i,
      /f[:\s]*\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})/i,
      /facsimile[:\s]*\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})/i,
    ];

    for (const pattern of faxPatterns) {
      const match = text.match(pattern);
      if (match) return `+1${match[1]}${match[2]}${match[3]}`;
    }
  }
  return null;
}

/** Extract all phone numbers from a website. Returns E.164 format array. */
export async function extractPhoneNumbers(websiteUrl: string): Promise<string[]> {
  if (!websiteUrl) return [];
  const result = await firecrawlScrape(websiteUrl, { onlyMainContent: false });
  const text = result?.markdown || "";
  const matches = [...text.matchAll(/\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})/g)];
  const phones = new Set<string>();
  for (const m of matches) {
    phones.add(`+1${m[1]}${m[2]}${m[3]}`);
  }
  return [...phones].slice(0, 5);
}

/** Extract owner/contact name and email from a website's about/contact page. */
export async function extractContactInfo(websiteUrl: string): Promise<{ name?: string; email?: string } | null> {
  if (!websiteUrl) return null;
  const urlsToTry = [
    websiteUrl.replace(/\/$/, "") + "/about",
    websiteUrl.replace(/\/$/, "") + "/contact",
    websiteUrl,
  ];
  for (const url of urlsToTry) {
    const result = await firecrawlScrape(url);
    const text = result?.markdown || "";
    if (!text) continue;

    const emailMatch = text.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch?.[1] || undefined;

    // Look for "Owner:", "President:", "Founder:", etc.
    const nameMatch = text.match(/(?:owner|president|founder|principal|proprietor)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
    const name = nameMatch?.[1] || undefined;

    if (email || name) return { name, email };
  }
  return null;
}

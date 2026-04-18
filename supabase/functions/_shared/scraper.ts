/**
 * Shared scraper adapter — single entry point for web scraping/search across the platform.
 *
 * Today: wraps Firecrawl (via the existing `stealth-scrape` helper) for `scrape()` and
 *        wraps Firecrawl Search v2 for `search()`.
 * Tomorrow: add Crawl4AI, Browserless, or any other provider behind the same interface
 *           and switch via env (`SCRAPE_PROVIDER`, `SEARCH_PROVIDER`) without editing
 *           every caller.
 *
 * Why centralize: 42+ functions currently call Firecrawl directly. Migrating them all
 * one-by-one to a different provider would be a multi-day refactor. With this adapter,
 * a future swap is one config change.
 */
import { stealthScrape, reasonToCopy, type StealthResult } from "./stealth-scrape.ts";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const FIRECRAWL_SEARCH_URL = "https://api.firecrawl.dev/v2/search";

const SCRAPE_PROVIDER = (Deno.env.get("SCRAPE_PROVIDER") || "firecrawl").toLowerCase();
const SEARCH_PROVIDER = (Deno.env.get("SEARCH_PROVIDER") || "firecrawl").toLowerCase();

// ============= scrape =============

export interface ScrapeOpts {
  formats?: Array<"markdown" | "html" | "links">;
  onlyMainContent?: boolean;
  timeoutMs?: number;
  maxChars?: number;
}

export interface ScrapeResult {
  ok: boolean;
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
  /** Friendly UI copy when ok=false. Never leaks vendor/status info. */
  error?: string;
  provider: string;
}

export async function scrape(url: string, opts: ScrapeOpts = {}): Promise<ScrapeResult> {
  if (SCRAPE_PROVIDER === "firecrawl") {
    const r: StealthResult = await stealthScrape(url, opts);
    return {
      ok: r.ok,
      markdown: r.markdown,
      html: r.html,
      links: r.links,
      metadata: r.metadata,
      error: r.ok ? undefined : reasonToCopy(r.reason),
      provider: "firecrawl",
    };
  }
  // Future: case "crawl4ai": return crawl4aiScrape(url, opts);
  return { ok: false, error: "Scraper not configured.", provider: SCRAPE_PROVIDER };
}

// ============= search =============

export interface SearchOpts {
  limit?: number;
  lang?: string;
  country?: string;
  /** Time filter: 'qdr:h' | 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y' */
  tbs?: string;
  scrapeContent?: boolean;
  timeoutMs?: number;
}

export interface SearchHit {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

export interface SearchResult {
  ok: boolean;
  hits: SearchHit[];
  error?: string;
  provider: string;
}

async function firecrawlSearch(query: string, opts: SearchOpts): Promise<SearchResult> {
  if (!FIRECRAWL_API_KEY) {
    return { ok: false, hits: [], error: "Search not configured.", provider: "firecrawl" };
  }
  try {
    const body: Record<string, unknown> = {
      query,
      limit: opts.limit ?? 10,
      ...(opts.lang ? { lang: opts.lang } : {}),
      ...(opts.country ? { country: opts.country } : {}),
      ...(opts.tbs ? { tbs: opts.tbs } : {}),
      ...(opts.scrapeContent ? { scrapeOptions: { formats: ["markdown"] } } : {}),
    };
    const res = await fetch(FIRECRAWL_SEARCH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
    if (!res.ok) {
      console.error(`[scraper.search] firecrawl ${res.status}`);
      return { ok: false, hits: [], error: "Search is unavailable right now.", provider: "firecrawl" };
    }
    const data = await res.json();
    // v2 returns { success, data: { web: [...] } } or { data: [...] } depending on call shape
    const raw = data?.data?.web || data?.data || data?.web || [];
    const hits: SearchHit[] = (Array.isArray(raw) ? raw : []).map((r: any) => ({
      url: r.url,
      title: r.title,
      description: r.description,
      markdown: r.markdown,
    }));
    return { ok: true, hits, provider: "firecrawl" };
  } catch (e) {
    console.error("[scraper.search] exception:", e);
    return { ok: false, hits: [], error: "Search is unavailable right now.", provider: "firecrawl" };
  }
}

export async function search(query: string, opts: SearchOpts = {}): Promise<SearchResult> {
  if (SEARCH_PROVIDER === "firecrawl") return firecrawlSearch(query, opts);
  // Future: case "crawl4ai": return crawl4aiSearch(query, opts);
  return { ok: false, hits: [], error: "Search not configured.", provider: SEARCH_PROVIDER };
}

// Phase B — deterministic FSBO + EstateSales scanners.
// Replaces LLM "discovery" with real page scrapes via Firecrawl, plus
// per-listing URL verification (page must contain the extracted address).

import { firecrawlScrape, extractAddressesFromMarkdown, verifyUrlContainsAddress } from "./firecrawl-scrape.ts";

export interface DeterministicSignal {
  full_name?: string;
  address: string;
  city?: string;
  zip?: string;
  signal_type: string;
  signal_source: string;
  signal_detail?: string;
  signal_url?: string;
  signal_date?: string;
  source_method: "scraper";
}

// Detroit metro Zillow FSBO search URLs. Zillow exposes a city-scoped FSBO list
// at /<city>-mi/fsbo/ — the markdown rendering exposes street addresses inline.
const ZILLOW_FSBO_URLS = [
  "https://www.zillow.com/detroit-mi/fsbo/",
  "https://www.zillow.com/grosse-pointe-mi/fsbo/",
  "https://www.zillow.com/grosse-pointe-woods-mi/fsbo/",
  "https://www.zillow.com/dearborn-mi/fsbo/",
  "https://www.zillow.com/livonia-mi/fsbo/",
  "https://www.zillow.com/warren-mi/fsbo/",
  "https://www.zillow.com/sterling-heights-mi/fsbo/",
  "https://www.zillow.com/troy-mi/fsbo/",
  "https://www.zillow.com/southfield-mi/fsbo/",
  "https://www.zillow.com/royal-oak-mi/fsbo/",
];

const CITY_FROM_URL_RE = /zillow\.com\/([a-z-]+)-mi\/fsbo/;

function cityFromZillowUrl(url: string): string | undefined {
  const m = url.match(CITY_FROM_URL_RE);
  if (!m) return undefined;
  return m[1].split("-").map(p => p[0].toUpperCase() + p.slice(1)).join(" ");
}

/** Deterministic Zillow FSBO scrape. Returns one signal per real listing-page address. */
export async function scrapeZillowFSBO(opts: { perCityCap?: number; verifyUrls?: boolean } = {}): Promise<DeterministicSignal[]> {
  const out: DeterministicSignal[] = [];
  const cap = opts.perCityCap ?? 5;
  // Stagger: scrape sequentially so we don't hammer Firecrawl rate limits
  for (const url of ZILLOW_FSBO_URLS) {
    const city = cityFromZillowUrl(url);
    const page = await firecrawlScrape(url, { onlyMainContent: true });
    if (!page || !page.markdown) continue;
    const addrs = extractAddressesFromMarkdown(page.markdown, { max: cap });
    for (const a of addrs) {
      out.push({
        address: a.address,
        city,
        zip: a.zip,
        signal_type: "fsbo_listing",
        signal_source: "Zillow_FSBO",
        signal_detail: a.context.slice(0, 200),
        signal_url: url,
        signal_date: new Date().toISOString().slice(0, 10),
        source_method: "scraper",
      });
    }
  }
  // Optional per-listing URL verification — skipped by default (search page IS the source page)
  if (opts.verifyUrls) {
    const verified: DeterministicSignal[] = [];
    for (const s of out) {
      const ok = await verifyUrlContainsAddress(s.signal_url || "", s.address);
      if (ok) verified.push(s);
    }
    return verified;
  }
  return out;
}

// EstateSales.net publishes upcoming MI estate sales at /MI/<city>. The listing
// markdown reliably contains the street address.
const ESTATESALES_URLS = [
  "https://www.estatesales.net/MI/Detroit",
  "https://www.estatesales.net/MI/Grosse-Pointe",
  "https://www.estatesales.net/MI/Grosse-Pointe-Woods",
  "https://www.estatesales.net/MI/Dearborn",
  "https://www.estatesales.net/MI/Livonia",
  "https://www.estatesales.net/MI/Warren",
  "https://www.estatesales.net/MI/Sterling-Heights",
  "https://www.estatesales.net/MI/Troy",
  "https://www.estatesales.net/MI/Southfield",
  "https://www.estatesales.net/MI/Royal-Oak",
];

function cityFromEstateUrl(url: string): string | undefined {
  const m = url.match(/\/MI\/([A-Za-z-]+)/);
  if (!m) return undefined;
  return m[1].replace(/-/g, " ");
}

export async function scrapeEstateSales(opts: { perCityCap?: number } = {}): Promise<DeterministicSignal[]> {
  const out: DeterministicSignal[] = [];
  const cap = opts.perCityCap ?? 4;
  for (const url of ESTATESALES_URLS) {
    const city = cityFromEstateUrl(url);
    const page = await firecrawlScrape(url, { onlyMainContent: true });
    if (!page || !page.markdown) continue;
    const addrs = extractAddressesFromMarkdown(page.markdown, { max: cap });
    for (const a of addrs) {
      out.push({
        address: a.address,
        city,
        zip: a.zip,
        signal_type: "estate_sale",
        signal_source: "EstateSales_Scrape",
        signal_detail: a.context.slice(0, 200),
        signal_url: url,
        signal_date: new Date().toISOString().slice(0, 10),
        source_method: "scraper",
      });
    }
  }
  return out;
}

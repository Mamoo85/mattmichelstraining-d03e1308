// Phase C — deterministic county/court/treasurer scrapers.
// Replaces LLM "discovery" for foreclosure, probate, tax-delinquency, fixer-upper.
// Every address comes from a real, fetched public-records page.

import { firecrawlScrape, extractAddressesFromMarkdown } from "./firecrawl-scrape.ts";

export interface CountySignal {
  full_name?: string;
  address: string;
  city?: string;
  zip?: string;
  signal_type: string;
  signal_source: string;
  signal_detail?: string;
  signal_url?: string;
  signal_date?: string;
  estimated_loan_amount?: number;
  source_method: "scraper";
}

const TODAY = () => new Date().toISOString().slice(0, 10);

// ============================================================
// FORECLOSURE / LIS PENDENS
// ============================================================
// Detroit Legal News publishes a public mortgage-foreclosure notice page.
// Oakland and Macomb each publish to their county legal newspapers.
// These are statutory public notices — addresses are printed verbatim.
const FORECLOSURE_URLS = [
  "https://www.legalnews.com/detroit/foreclosures",
  "https://www.legalnews.com/oakland/foreclosures",
  "https://www.legalnews.com/macomb/foreclosures",
];

function countyFromLegalNewsUrl(url: string): string {
  const m = url.match(/legalnews\.com\/([a-z]+)\//);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : "Wayne";
}

export async function scrapeForeclosureNotices(opts: { perSourceCap?: number } = {}): Promise<CountySignal[]> {
  const out: CountySignal[] = [];
  const cap = opts.perSourceCap ?? 8;
  for (const url of FORECLOSURE_URLS) {
    const county = countyFromLegalNewsUrl(url);
    const page = await firecrawlScrape(url, { onlyMainContent: true });
    if (!page || !page.markdown) continue;
    const addrs = extractAddressesFromMarkdown(page.markdown, { max: cap });
    for (const a of addrs) {
      out.push({
        address: a.address,
        zip: a.zip,
        signal_type: "lis_pendens",
        signal_source: `LegalNews_${county}`,
        signal_detail: a.context.slice(0, 200),
        signal_url: url,
        signal_date: TODAY(),
        source_method: "scraper",
      });
    }
  }
  return out;
}

// ============================================================
// PROBATE FILINGS
// ============================================================
// Wayne County Probate Court publishes opened estates with property addresses
// in the legal newspaper public-notices section ("Estate of ...").
const PROBATE_URLS = [
  "https://www.legalnews.com/detroit/probate",
  "https://www.legalnews.com/oakland/probate",
  "https://www.legalnews.com/macomb/probate",
];

export async function scrapeProbateFilings(opts: { perSourceCap?: number } = {}): Promise<CountySignal[]> {
  const out: CountySignal[] = [];
  const cap = opts.perSourceCap ?? 6;
  for (const url of PROBATE_URLS) {
    const county = countyFromLegalNewsUrl(url);
    const page = await firecrawlScrape(url, { onlyMainContent: true });
    if (!page || !page.markdown) continue;
    // Probate notices format: "Estate of JOHN SMITH, deceased ... last known address 1234 Main St, Detroit MI 48201"
    const addrs = extractAddressesFromMarkdown(page.markdown, { max: cap });
    // Try to recover decedent name from preceding "Estate of X" pattern
    const estateRe = /Estate of\s+([A-Z][A-Za-z .'-]+?)(?:,|\s+deceased)/gi;
    const names: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = estateRe.exec(page.markdown)) !== null) names.push(m[1].trim());
    for (let i = 0; i < addrs.length; i++) {
      const a = addrs[i];
      out.push({
        full_name: names[i] || undefined,
        address: a.address,
        zip: a.zip,
        signal_type: "probate_filing",
        signal_source: `ProbateCourt_${county}`,
        signal_detail: a.context.slice(0, 200),
        signal_url: url,
        signal_date: TODAY(),
        source_method: "scraper",
      });
    }
  }
  return out;
}

// ============================================================
// TAX DELINQUENCY
// ============================================================
// Wayne County Treasurer publishes the annual delinquent tax list publicly.
// Format: "PARCEL ID | OWNER NAME | PROPERTY ADDRESS | AMOUNT".
// Oakland/Macomb publish similar lists. The URLs below are the public landing
// pages — Firecrawl follows the linked PDF/HTML list.
const TAX_DELINQUENCY_URLS = [
  "https://www.waynecounty.com/elected/treasurer/foreclosure-properties.aspx",
  "https://www.oakgov.com/treasurer/property-tax/foreclosure-list",
  "https://www.macombgov.org/departments/treasurers-office/tax-foreclosure",
];

export async function scrapeTaxDelinquency(opts: { perSourceCap?: number } = {}): Promise<CountySignal[]> {
  const out: CountySignal[] = [];
  const cap = opts.perSourceCap ?? 10;
  for (const url of TAX_DELINQUENCY_URLS) {
    const page = await firecrawlScrape(url, { onlyMainContent: true });
    if (!page || !page.markdown) continue;
    const addrs = extractAddressesFromMarkdown(page.markdown, { max: cap });
    const county = url.includes("wayne") ? "Wayne" : url.includes("oak") ? "Oakland" : "Macomb";
    for (const a of addrs) {
      out.push({
        address: a.address,
        zip: a.zip,
        signal_type: "tax_delinquency",
        signal_source: `Treasurer_${county}`,
        signal_detail: a.context.slice(0, 200),
        signal_url: url,
        signal_date: TODAY(),
        source_method: "scraper",
      });
    }
  }
  return out;
}

// ============================================================
// FIXER-UPPER LISTINGS
// ============================================================
// Zillow exposes keyword-search SRPs publicly. We use the FSBO-style markdown
// extraction and let the address regex pick up street addresses inline.
const FIXER_UPPER_URLS = [
  "https://www.zillow.com/detroit-mi/fixer-upper_att/",
  "https://www.zillow.com/detroit-mi/handyman-special_att/",
  "https://www.zillow.com/warren-mi/fixer-upper_att/",
  "https://www.zillow.com/dearborn-mi/fixer-upper_att/",
  "https://www.zillow.com/livonia-mi/fixer-upper_att/",
  "https://www.zillow.com/sterling-heights-mi/fixer-upper_att/",
];

function cityFromFixerUrl(url: string): string | undefined {
  const m = url.match(/zillow\.com\/([a-z-]+)-mi\//);
  if (!m) return undefined;
  return m[1].split("-").map(p => p[0].toUpperCase() + p.slice(1)).join(" ");
}

export async function scrapeFixerUpperListings(opts: { perSourceCap?: number } = {}): Promise<CountySignal[]> {
  const out: CountySignal[] = [];
  const cap = opts.perSourceCap ?? 5;
  for (const url of FIXER_UPPER_URLS) {
    const city = cityFromFixerUrl(url);
    const page = await firecrawlScrape(url, { onlyMainContent: true });
    if (!page || !page.markdown) continue;
    const addrs = extractAddressesFromMarkdown(page.markdown, { max: cap });
    for (const a of addrs) {
      out.push({
        address: a.address,
        city,
        zip: a.zip,
        signal_type: "fixer_upper_listing",
        signal_source: "Zillow_FixerUpper",
        signal_detail: a.context.slice(0, 200),
        signal_url: url,
        signal_date: TODAY(),
        source_method: "scraper",
      });
    }
  }
  return out;
}

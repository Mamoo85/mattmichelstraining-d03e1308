// _shared/firecrawl.ts — centralized Firecrawl scraping helper.
// Used for fax number extraction, contact page scraping, and structured data extraction.
// Always falls back gracefully — never throws.

import { assertDwaBudget, BudgetExceeded } from "./dwa-budget-gate.ts";

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
    let logSpend: ((c?: number) => void) | null = null;
    try { logSpend = await assertDwaBudget("firecrawl", undefined, "firecrawl"); }
    catch (e) { if (e instanceof BudgetExceeded) return null; throw e; }

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
    logSpend?.();
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

/** Standard subpaths most small-trade sites use to bury contact info. */
const CONTACT_SUBPATHS = [
  "", "/contact", "/contact-us", "/contactus", "/about", "/about-us",
  "/team", "/our-team", "/staff", "/leadership", "/owner", "/meet-the-owner",
  "/info", "/get-in-touch", "/reach-us", "/locations",
];

/** Deobfuscate common email cloaking patterns: name [at] domain [dot] com, name (at) domain, etc. */
function deobfuscateEmails(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .replace(/\s*\[\s*at\s*\]\s*/gi, "@")
    .replace(/\s*\(\s*at\s*\)\s*/gi, "@")
    .replace(/\s+at\s+(?=[a-z0-9-]+\.(com|net|org|io|co|biz|us|info|email))/gi, "@")
    .replace(/\s*\[\s*dot\s*\]\s*/gi, ".")
    .replace(/\s*\(\s*dot\s*\)\s*/gi, ".")
    .replace(/\s+dot\s+(?=[a-z]{2,4}\b)/gi, ".")
    .replace(/&#64;/gi, "@")
    .replace(/%40/gi, "@");
  const matches = cleaned.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

/** Pull mailto: hrefs from raw HTML (often present even when text is JS-rendered). */
function extractMailtoHrefs(html: string): string[] {
  if (!html) return [];
  const matches = [...html.matchAll(/mailto:([^"'?\s>]+)/gi)];
  return [...new Set(matches.map((m) => m[1].toLowerCase()))];
}

/**
 * Deep contact extraction across multiple subpages.
 * Tries CONTACT_SUBPATHS in parallel, deobfuscates "name [at] domain [dot] com",
 * scans mailto: hrefs in raw HTML, prefers domain-matching emails.
 * Returns first valid email + name found.
 */
export async function deepExtractContact(
  websiteUrl: string,
  opts?: { maxPages?: number },
): Promise<{ name?: string; email?: string; emails?: string[]; source_url?: string } | null> {
  if (!websiteUrl) return null;
  let domain = "";
  try { domain = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
  const base = websiteUrl.replace(/\/$/, "");
  const max = opts?.maxPages ?? 6;

  const urls = CONTACT_SUBPATHS.slice(0, max).map((p) => base + p);
  const results = await Promise.allSettled(
    urls.map((u) => firecrawlScrape(u, { onlyMainContent: false, includeHtml: true })),
  );

  const emailHits: { email: string; url: string }[] = [];
  let foundName: string | undefined;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== "fulfilled" || !r.value) continue;
    const md = r.value.markdown || "";
    const html = r.value.html || "";
    const text = md + " " + html;

    for (const e of deobfuscateEmails(text)) emailHits.push({ email: e, url: urls[i] });
    for (const e of extractMailtoHrefs(html)) emailHits.push({ email: e, url: urls[i] });

    if (!foundName) {
      const nameMatch = md.match(
        /(?:owner|president|founder|principal|proprietor|ceo|gm|general manager)[:\s,\-–]+([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+)/i,
      );
      if (nameMatch) foundName = nameMatch[1];
    }
  }

  if (!emailHits.length && !foundName) return null;

  // Prefer domain-matching emails, then info@/contact@, then anything not generic.
  const blocked = /^(?:noreply|no-reply|webmaster|postmaster|name|email|test|user|admin|example)@/i;
  const valid = emailHits.filter((h) => !blocked.test(h.email) && /\.(com|net|org|biz|us|co|io|info|email)$/i.test(h.email));
  const onDomain = valid.find((h) => h.email.endsWith(`@${domain}`));
  const biz = valid.find((h) => /^(info|contact|office|hello|sales|service|mail|owner)@/i.test(h.email));
  const pick = onDomain || biz || valid[0];

  return {
    name: foundName,
    email: pick?.email,
    emails: [...new Set(valid.map((v) => v.email))].slice(0, 5),
    source_url: pick?.url,
  };
}

/** Backwards-compatible wrapper that uses the deep extractor under the hood. */
export async function extractContactInfo(websiteUrl: string): Promise<{ name?: string; email?: string } | null> {
  const r = await deepExtractContact(websiteUrl, { maxPages: 4 });
  if (!r) return null;
  return { name: r.name, email: r.email };
}

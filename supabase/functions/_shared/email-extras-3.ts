// Third wave of free/low-cost email enrichment sources.
// All fail-open: return null on any error. No throws.
//
// Tiers 30-39:
//  30. sitemapCrawl       — fetch /sitemap.xml, scan contact-ish URLs for emails
//  31. linkedinSlugEmail  — guess LinkedIn company slug → public about page scrape
//  32. facebookPageEmail  — Facebook Page about/contact scrape
//  33. mapquestEmail      — MapQuest Search API place lookup
//  34. hereEmail          — HERE Places discover API
//  35. opencageEmail      — OpenCage forward geocoding annotations
//  36. secEdgarEmail      — SEC EDGAR company filing contact email
//  37. govinfoEmail       — GovInfo.gov collection search (federal docs)
//  38. samEntityEmail     — SAM.gov entity registration POC email
//  39. twitterBioEmail    — Twitter/X public bio scrape via nitter mirror

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const MAPQUEST_API_KEY  = Deno.env.get("MAPQUEST_API_KEY") || "";
const HERE_API_KEY      = Deno.env.get("HERE_API_KEY") || "";
const OPENCAGE_API_KEY  = Deno.env.get("OPENCAGE_API_KEY") || "";
const SAM_GOV_API_KEY   = Deno.env.get("SAM_GOV_API_KEY") || "";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function pickEmail(text: string, domain?: string): string | null {
  const all = (text.match(EMAIL_RE) || []).filter((e) =>
    !/\.(png|jpg|svg|gif|webp|woff|ttf|js|css)$/i.test(e) &&
    !e.toLowerCase().startsWith("noreply@") &&
    e.length < 80
  );
  if (!all.length) return null;
  if (domain) {
    const m = all.find((e) => e.toLowerCase().endsWith(`@${domain}`));
    if (m) return m;
  }
  return all[0];
}

async function safeFetch(url: string, init?: RequestInit, timeoutMs = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Mozilla/5.0", ...(init?.headers || {}) },
    });
    if (!res.ok) { await res.body?.cancel(); return null; }
    return await res.text();
  } catch { return null; }
}

// 30. sitemap crawl
export async function sitemapCrawl(domain: string): Promise<string | null> {
  const xml = await safeFetch(`https://${domain}/sitemap.xml`);
  if (!xml) return null;
  const urls = (xml.match(/<loc>([^<]+)<\/loc>/g) || [])
    .map((m) => m.replace(/<\/?loc>/g, ""))
    .filter((u) => /contact|about|team|staff/i.test(u))
    .slice(0, 4);
  for (const u of urls) {
    const html = await safeFetch(u);
    if (!html) continue;
    const e = pickEmail(html, domain);
    if (e) return e;
  }
  return null;
}

// 31. LinkedIn company slug guess (public page only — no API key)
export async function linkedinSlugEmail(businessName: string): Promise<string | null> {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return null;
  const html = await safeFetch(`https://www.linkedin.com/company/${slug}/about/`);
  if (!html) return null;
  return pickEmail(html);
}

// 32. Facebook Page about scrape
export async function facebookPageEmail(businessName: string): Promise<string | null> {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!slug) return null;
  const html = await safeFetch(`https://www.facebook.com/${slug}/about_contact_and_basic_info`);
  if (!html) return null;
  return pickEmail(html);
}

// 33. MapQuest Search
export async function mapquestEmail(businessName: string, city: string): Promise<string | null> {
  if (!MAPQUEST_API_KEY) return null;
  const q = encodeURIComponent(`${businessName} ${city}`);
  const json = await safeFetch(
    `https://www.mapquestapi.com/search/v4/place?key=${MAPQUEST_API_KEY}&q=${q}&pageSize=3`
  );
  if (!json) return null;
  return pickEmail(json);
}

// 34. HERE Places discover
export async function hereEmail(businessName: string, city: string): Promise<string | null> {
  if (!HERE_API_KEY) return null;
  const q = encodeURIComponent(`${businessName} ${city}`);
  const json = await safeFetch(
    `https://discover.search.hereapi.com/v1/discover?q=${q}&at=42.33,-83.04&limit=3&apiKey=${HERE_API_KEY}`
  );
  if (!json) return null;
  return pickEmail(json);
}

// 35. OpenCage geocoding (returns annotations sometimes incl. contact)
export async function opencageEmail(businessName: string, city: string): Promise<string | null> {
  if (!OPENCAGE_API_KEY) return null;
  const q = encodeURIComponent(`${businessName}, ${city}`);
  const json = await safeFetch(
    `https://api.opencagedata.com/geocode/v1/json?q=${q}&key=${OPENCAGE_API_KEY}&limit=2`
  );
  if (!json) return null;
  return pickEmail(json);
}

// 36. SEC EDGAR company filings (free, just User-Agent)
export async function secEdgarEmail(businessName: string): Promise<string | null> {
  const q = encodeURIComponent(businessName);
  const json = await safeFetch(
    `https://efts.sec.gov/LATEST/search-index?q=%22${q}%22&forms=10-K,10-Q,8-K&dateRange=custom&startdt=2023-01-01&enddt=2026-12-31`,
    { headers: { "User-Agent": "DWA Research research@detroitwebagent.com" } }
  );
  if (!json) return null;
  return pickEmail(json);
}

// 37. GovInfo.gov collection search
export async function govinfoEmail(businessName: string): Promise<string | null> {
  const q = encodeURIComponent(businessName);
  const json = await safeFetch(
    `https://www.govinfo.gov/wssearch/search?query=${q}&pageSize=5&offset=0`
  );
  if (!json) return null;
  return pickEmail(json);
}

// 38. SAM.gov entity POC email
export async function samEntityEmail(businessName: string): Promise<string | null> {
  if (!SAM_GOV_API_KEY) return null;
  const q = encodeURIComponent(businessName);
  const json = await safeFetch(
    `https://api.sam.gov/entity-information/v3/entities?api_key=${SAM_GOV_API_KEY}&q=${q}&samRegistered=Yes`
  );
  if (!json) return null;
  return pickEmail(json);
}

// 39. Twitter/X bio via nitter (public mirror)
export async function twitterBioEmail(businessName: string): Promise<string | null> {
  const handle = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!handle) return null;
  const html = await safeFetch(`https://nitter.net/${handle}`);
  if (!html) return null;
  return pickEmail(html);
}

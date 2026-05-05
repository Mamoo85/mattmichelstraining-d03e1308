// email-extras-6.ts — Gap-fill email enrichment sources, Tiers 90–109.
// Uses existing confirmed API keys: FIRECRAWL_API_KEY, APOLLO_API_KEY,
// HUNTER_IO_API_KEY, GOOGLE_MAPS_API_KEY. All others need no key.
// Imported lazily by email-waterfall.ts. All fail-open (null on any error).

import { firecrawlScrape } from "./firecrawl.ts";
import { apolloOrganizationEnrich, apolloPeopleSearch } from "./apollo.ts";
import { hunterFindEmail } from "./hunter.ts";

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function pickEmail(text: string, domain?: string): string | null {
  const all = (text.match(EMAIL_RE) || []).filter(
    (e) =>
      !/\.(png|jpg|svg|gif|webp|woff|ttf|js|css)$/i.test(e) &&
      !e.toLowerCase().startsWith("noreply@") &&
      !e.toLowerCase().startsWith("no-reply@") &&
      !e.toLowerCase().startsWith("postmaster@") &&
      e.length < 80,
  );
  if (!all.length) return null;
  if (domain) {
    const m = all.find((e) => e.toLowerCase().endsWith(`@${domain}`));
    if (m) return m;
  }
  return all[0];
}

async function safeText(
  url: string,
  init?: RequestInit,
  timeoutMs = 7000,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...((init?.headers as Record<string, string>) || {}),
      },
    });
    if (!res.ok) { await res.body?.cancel(); return null; }
    return await res.text();
  } catch { return null; }
}

async function safeJson(url: string, init?: RequestInit, timeoutMs = 7000): Promise<unknown> {
  const t = await safeText(url, init, timeoutMs);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

const enc = (s: string) => encodeURIComponent(s);
const HUNTER_KEY = Deno.env.get("HUNTER_API_KEY") || Deno.env.get("HUNTER_IO_API_KEY") || "";
const GOOGLE_KEY  = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const SNOV_UID    = Deno.env.get("SNOV_USER_ID") || "";
const SNOV_SECRET = Deno.env.get("SNOV_API_KEY") || "";

// ── Snov token helper (cached) ───────────────────────────────────────────────
let _snovToken: { t: string; exp: number } | null = null;
async function getSnovToken(): Promise<string | null> {
  if (!SNOV_UID || !SNOV_SECRET) return null;
  if (_snovToken && _snovToken.exp > Date.now()) return _snovToken.t;
  try {
    const r = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_UID}&client_secret=${SNOV_SECRET}`,
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const d = await r.json() as { access_token?: string; expires_in?: number };
    if (!d.access_token) return null;
    _snovToken = { t: d.access_token, exp: Date.now() + ((d.expires_in || 3600) - 60) * 1000 };
    return _snovToken.t;
  } catch { return null; }
}

async function snovVerifyEmail(email: string): Promise<boolean> {
  const tok = await getSnovToken();
  if (!tok) return false;
  try {
    const r = await fetch("https://api.snov.io/v1/get-emails-verification-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ emails: [email] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return false;
    const d = await r.json() as { data?: Array<{ email: string; status: string }> };
    const found = d.data?.find((x) => x.email === email);
    return found?.status === "valid" || found?.status === "catch-all";
  } catch { return false; }
}

async function hunterVerifyEmail(email: string): Promise<boolean> {
  if (!HUNTER_KEY) return false;
  try {
    const r = await fetch(`https://api.hunter.io/v2/email-verifier?email=${enc(email)}&api_key=${HUNTER_KEY}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return false;
    const d = await r.json() as { data?: { result?: string; score?: number } };
    const result = d.data?.result || "";
    return result === "deliverable" || result === "risky";
  } catch { return false; }
}

// 90. Firecrawl structured scrape of /contact page
export async function firecrawlContactEmail(domain: string): Promise<string | null> {
  for (const path of ["/contact", "/contact-us", "/contacts", "/reach-us"]) {
    try {
      const r = await firecrawlScrape(`https://${domain}${path}`, { onlyMainContent: true });
      if (r?.markdown) {
        const e = pickEmail(r.markdown, domain);
        if (e) return e;
      }
    } catch { /* continue */ }
  }
  return null;
}

// 91. Apollo /organizations/enrich — returns org.email when domain is known
export async function apolloOrgEnrichEmail(domain: string): Promise<string | null> {
  try {
    const org = await apolloOrganizationEnrich(domain);
    if (!org) return null;
    const blob = JSON.stringify(org);
    return pickEmail(blob, domain);
  } catch { return null; }
}

// 92. Email permutations + Hunter verify (first@, f.last@, first.last@, firstl@, info@, contact@)
export async function emailPermutationsVerified(
  domain: string,
  firstName?: string,
  lastName?: string,
): Promise<string | null> {
  if (!domain) return null;
  const f = (firstName || "").toLowerCase().replace(/[^a-z]/g, "");
  const l = (lastName || "").toLowerCase().replace(/[^a-z]/g, "");
  const patterns: string[] = ["info", "contact", "owner", "hello", "admin"];
  if (f) patterns.push(f);
  if (f && l) {
    patterns.push(`${f}.${l}`);
    patterns.push(`${f}${l}`);
    patterns.push(`${f[0]}${l}`);
    patterns.push(`${f[0]}.${l}`);
  }
  for (const p of patterns) {
    const email = `${p}@${domain}`;
    const valid = await hunterVerifyEmail(email);
    if (valid) return email;
  }
  return null;
}

// 93. Nitter (public Twitter/X mirror) — bio scrape for email
export async function nitterBioEmail(name: string): Promise<string | null> {
  const slug = name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "").slice(0, 20);
  const instances = ["nitter.net", "nitter.privacydev.net", "nitter.poast.org"];
  for (const host of instances) {
    const t = await safeText(`https://${host}/${enc(slug)}`);
    if (t) {
      const e = pickEmail(t);
      if (e) return e;
    }
  }
  return null;
}

// 94. Google cached /contact page (survives blocks, older cache)
export async function googleCacheContactEmail(domain: string): Promise<string | null> {
  for (const path of ["/contact", "/about", "/contact-us"]) {
    const t = await safeText(
      `https://webcache.googleusercontent.com/search?q=cache:${enc(`https://${domain}${path}`)}`,
    );
    if (t) {
      const e = pickEmail(t, domain);
      if (e) return e;
    }
  }
  return null;
}

// 95. Bing HTML scrape with domain+email query (no key)
export async function bingDomainEmailScrape(domain: string): Promise<string | null> {
  const t = await safeText(
    `https://www.bing.com/search?q=%40${enc(domain)}+email+contact&count=10`,
  );
  return t ? pickEmail(t, domain) : null;
}

// 96. Hunter domain-search — top scored email (uses existing HUNTER_IO_API_KEY)
export async function hunterDomainFirstEmail(domain: string): Promise<string | null> {
  try {
    const contact = await hunterFindEmail(domain);
    return contact?.email || null;
  } catch { return null; }
}

// 97. Bing HTML SERP scrape by business name + city (no key)
export async function bingHtmlScrapeEmail(name: string, city?: string): Promise<string | null> {
  const q = city ? `${name} ${city} email contact` : `${name} email contact`;
  const t = await safeText(`https://www.bing.com/search?q=${enc(q)}&count=10`);
  return t ? pickEmail(t) : null;
}

// 98. Yelp HTML scrape — search result → business page → website → email (no key)
export async function yelpHtmlScrapeEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  try {
    const q = city ? `${name} ${city}` : name;
    const searchPage = await safeText(
      `https://www.yelp.com/search?find_desc=${enc(name)}&find_loc=${enc(city || "")}`,
    );
    if (!searchPage) return null;
    // Extract first business URL
    const bizMatch = searchPage.match(/href="(\/biz\/[^"?]+)"/);
    if (!bizMatch) return null;
    const bizPage = await safeText(`https://www.yelp.com${bizMatch[1]}`);
    if (!bizPage) return null;
    // Try to get website link
    const siteMatch = bizPage.match(/biz_website.*?href="([^"]+)"/i);
    if (siteMatch) {
      const websitePage = await safeText(siteMatch[1]);
      if (websitePage) {
        const e = pickEmail(websitePage);
        if (e) return e;
      }
    }
    return pickEmail(bizPage);
  } catch { return null; }
}

// 99. Google Maps Places → website → crawl /, /contact, /about, /team (parallel)
export async function googleMapsWebsiteMultipage(
  name: string,
  city?: string,
): Promise<string | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const query = city ? `${name} ${city}` : name;
    const searchRes = await safeJson(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${enc(query)}&inputtype=textquery&fields=place_id&key=${GOOGLE_KEY}`,
    ) as { candidates?: Array<{ place_id: string }> } | null;
    const placeId = searchRes?.candidates?.[0]?.place_id;
    if (!placeId) return null;
    const detailRes = await safeJson(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website&key=${GOOGLE_KEY}`,
    ) as { result?: { website?: string } } | null;
    const website = detailRes?.result?.website;
    if (!website) return null;
    let domain = "";
    try { domain = new URL(website).hostname.replace(/^www\./, ""); } catch { return null; }
    const pages = ["/", "/contact", "/about", "/team", "/staff"];
    const results = await Promise.all(
      pages.map((p) => safeText(`https://${domain}${p}`)),
    );
    for (const html of results) {
      if (html) {
        const e = pickEmail(html, domain);
        if (e) return e;
      }
    }
    return null;
  } catch { return null; }
}

// 100. MX existence check → generate info@domain hint (DoH)
export async function mxExistencePatternEmail(domain: string): Promise<string | null> {
  try {
    const j = await safeJson(
      `https://dns.google/resolve?name=${enc(domain)}&type=MX`,
    ) as { Answer?: Array<{ data: string }> } | null;
    const answers = j?.Answer || [];
    if (!answers.length) return null;
    // MX exists — check if any MX points to same domain (own mail server = real business)
    const ownMx = answers.some((a) =>
      a.data?.includes(domain) || a.data?.includes("google") || a.data?.includes("outlook"),
    );
    if (ownMx) return `info@${domain}`;
    return null;
  } catch { return null; }
}

// 101. RDAP multi-registry registrant email
export async function whoisRegistrantEmail(domain: string): Promise<string | null> {
  const tld = domain.split(".").pop() || "";
  const registries = [
    `https://rdap.org/domain/${enc(domain)}`,
    `https://rdap.iana.org/domain/${enc(tld)}`,
    `https://www.rdap.net/domain/${enc(domain)}`,
  ];
  for (const url of registries) {
    try {
      const j = await safeJson(url) as Record<string, unknown> | null;
      if (!j) continue;
      const blob = JSON.stringify(j);
      const e = pickEmail(blob);
      if (e && !e.includes("iana.org") && !e.includes("icann.org")) return e;
    } catch { /* try next */ }
  }
  return null;
}

// 102. Firecrawl /about and /team page extraction
export async function firecrawlAboutTeamEmail(domain: string): Promise<string | null> {
  for (const path of ["/about", "/team", "/about-us", "/our-team", "/staff"]) {
    try {
      const r = await firecrawlScrape(`https://${domain}${path}`, { onlyMainContent: true });
      if (r?.markdown) {
        const e = pickEmail(r.markdown, domain);
        if (e) return e;
      }
    } catch { /* continue */ }
  }
  return null;
}

// 103. Google Places phone number → owner name pattern email
export async function googlePlacesPhonePatternEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const query = city ? `${name} ${city}` : name;
    const searchRes = await safeJson(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${enc(query)}&inputtype=textquery&fields=place_id&key=${GOOGLE_KEY}`,
    ) as { candidates?: Array<{ place_id: string }> } | null;
    const placeId = searchRes?.candidates?.[0]?.place_id;
    if (!placeId) return null;
    const detailRes = await safeJson(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${GOOGLE_KEY}`,
    ) as { result?: { formatted_phone_number?: string; website?: string } } | null;
    const website = detailRes?.result?.website;
    if (!website) return null;
    let domain = "";
    try { domain = new URL(website).hostname.replace(/^www\./, ""); } catch { return null; }
    // Scrape homepage for email
    const html = await safeText(`https://${domain}/`);
    return html ? pickEmail(html, domain) : null;
  } catch { return null; }
}

// 104. State Secretary of State — registered agent email (MI, OH, IN, IL, TX, FL)
export async function stateSosEmail(
  businessName: string,
  state?: string,
): Promise<string | null> {
  const s = (state || "MI").toUpperCase();
  try {
    if (s === "MI") {
      const t = await safeText(
        `https://cofs.lara.state.mi.us/SearchApi/Search/Search?searchValue=${enc(businessName)}&searchType=0`,
      );
      if (t) { const e = pickEmail(t); if (e) return e; }
    }
    if (s === "OH") {
      const t = await safeText(
        `https://businesssearch.ohiosos.gov/api/businesses?businessName=${enc(businessName)}&page=1`,
      );
      if (t) { const e = pickEmail(t); if (e) return e; }
    }
    if (s === "TX") {
      const t = await safeText(
        `https://mycpa.cpa.state.tx.us/coa/coaSearchRequest?name=${enc(businessName)}`,
      );
      if (t) { const e = pickEmail(t); if (e) return e; }
    }
    if (s === "FL") {
      const t = await safeText(
        `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&inquiryDirectionType=ForwardList&searchNameOrder=${enc(businessName)}`,
      );
      if (t) { const e = pickEmail(t); if (e) return e; }
    }
  } catch { /* ignore */ }
  return null;
}

// 105. State contractor license board email (MI LARA, OH OCILB, TX TDLR)
export async function contractorsStateLicenseEmail(
  businessName: string,
  state?: string,
): Promise<string | null> {
  const s = (state || "MI").toUpperCase();
  try {
    if (s === "MI") {
      const t = await safeText(
        `https://aca-prod.accela.com/MILARA/Cap/CapHome.aspx?module=Licenses&search=${enc(businessName)}`,
      );
      if (t) { const e = pickEmail(t); if (e) return e; }
    }
    if (s === "OH") {
      const t = await safeText(
        `https://elicense.ohio.gov/OH_VerifyLicense/Search?type=business&q=${enc(businessName)}`,
      );
      if (t) { const e = pickEmail(t); if (e) return e; }
    }
    if (s === "TX") {
      const t = await safeText(
        `https://www.tdlr.texas.gov/LicenseSearch/licfile.asp?searchstring=${enc(businessName)}`,
      );
      if (t) { const e = pickEmail(t); if (e) return e; }
    }
  } catch { /* ignore */ }
  return null;
}

// 106. Google PageSpeed Insights — DOM accessibility text sometimes contains email
export async function pagespeedDomEmail(domain: string): Promise<string | null> {
  if (!GOOGLE_KEY) return null;
  try {
    const j = await safeJson(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${enc(domain)}&strategy=desktop&key=${GOOGLE_KEY}`,
      {},
      15000,
    ) as Record<string, unknown> | null;
    if (!j) return null;
    return pickEmail(JSON.stringify(j), domain);
  } catch { return null; }
}

// 107. Internet Archive CDX — /contact and /about multi-snapshot scan
export async function internetArchiveContactPagesEmail(domain: string): Promise<string | null> {
  const paths = ["/contact", "/about", "/contact-us", "/team"];
  for (const p of paths) {
    try {
      const cdx = await safeJson(
        `http://web.archive.org/cdx/search/cdx?url=${enc(domain + p)}&output=json&limit=3&fl=timestamp,original&filter=statuscode:200&collapse=timestamp:6`,
      ) as string[][] | null;
      if (!cdx || cdx.length < 2) continue;
      for (const row of cdx.slice(1)) {
        const [ts, orig] = row;
        if (!ts || !orig) continue;
        const archived = await safeText(`https://web.archive.org/web/${ts}/${orig}`);
        if (archived) {
          const e = pickEmail(archived, domain);
          if (e) return e;
        }
      }
    } catch { /* try next path */ }
  }
  return null;
}

// 108. Apollo people search — decision-maker email at domain
export async function apolloPeopleDecisionMakerEmail(
  domain: string,
  businessName?: string,
): Promise<string | null> {
  try {
    const result = await apolloPeopleSearch({
      organization_domains: [domain],
      person_titles: ["owner", "president", "gm", "general manager", "founder", "ceo", "director", "principal"],
      page: 1,
      per_page: 5,
    });
    if (!result?.ok || !result.data) return null;
    const people = (result.data as { people?: Array<{ email?: string }> })?.people || [];
    const email = people.find((p) => p.email)?.email;
    return email || null;
  } catch { return null; }
}

// 109. MX-aware email pattern — check MX host to infer email provider, then smart pattern + verify
export async function emailPatternMxSmartEmail(
  domain: string,
  firstName?: string,
  lastName?: string,
): Promise<string | null> {
  if (!domain) return null;
  try {
    const j = await safeJson(
      `https://dns.google/resolve?name=${enc(domain)}&type=MX`,
    ) as { Answer?: Array<{ data: string }> } | null;
    const mxHosts = (j?.Answer || []).map((a) => (a.data || "").toLowerCase());
    if (!mxHosts.length) return null;

    // Determine provider hints from MX
    const isGoogle = mxHosts.some((h) => h.includes("google") || h.includes("aspmx"));
    const isMicrosoft = mxHosts.some((h) => h.includes("outlook") || h.includes("protection.outlook"));
    const hasCustom = mxHosts.some((h) => h.includes(domain));

    const f = (firstName || "").toLowerCase().replace(/[^a-z]/g, "");
    const l = (lastName || "").toLowerCase().replace(/[^a-z]/g, "");

    // Priority patterns based on provider
    let patterns: string[];
    if (isGoogle || isMicrosoft) {
      // Google/Microsoft tenants: first.last, first, flast are most common
      patterns = f && l
        ? [`${f}.${l}`, f, `${f}${l[0]}`, `${f[0]}.${l}`, "info", "contact"]
        : ["info", "contact", "hello", "owner", "admin"];
    } else if (hasCustom) {
      // Own mail server: info@, owner@, contact@ most common for small biz
      patterns = ["info", "owner", "contact", "office", "hello"];
      if (f) patterns.splice(2, 0, f);
      if (f && l) patterns.splice(2, 0, `${f}.${l}`);
    } else {
      patterns = ["info", "contact", "owner"];
      if (f) patterns.push(f);
      if (f && l) patterns.push(`${f}.${l}`);
    }

    for (const p of patterns.slice(0, 6)) {
      const email = `${p}@${domain}`;
      const valid = await hunterVerifyEmail(email);
      if (valid) return email;
    }
    return null;
  } catch { return null; }
}

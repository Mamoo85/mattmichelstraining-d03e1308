// email-extras-2.ts — Free email enrichment sources, Tiers 25–38.
// Additional free/semi-free sources: search engines, public registries,
// social graphs, geocoders, and government data APIs.
// All fail-open (null on any error). Imported lazily by email-waterfall.ts.

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
  timeoutMs = 6000,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EnrichBot/1.0)",
        ...((init?.headers as Record<string, string>) || {}),
      },
    });
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

async function safeJson(
  url: string,
  init?: RequestInit,
  timeoutMs = 6000,
): Promise<unknown> {
  const t = await safeText(url, init, timeoutMs);
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

const enc = (s: string) => encodeURIComponent(s);

// 25. Yandex search scrape (works without API key)
export async function yandexEmail(
  name: string,
  domain?: string,
): Promise<string | null> {
  const query = domain ? `${name} site:${domain} email` : `${name} email contact`;
  const t = await safeText(
    `https://yandex.com/search/xml?text=${enc(query)}&lr=84`,
  );
  return t ? pickEmail(t, domain) : null;
}

// 26. GitHub org events (public, no key needed)
export async function githubEventsEmail(name: string): Promise<string | null> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  // Try org events first, then search for org
  const t = await safeText(
    `https://api.github.com/orgs/${enc(slug)}/events?per_page=10`,
    { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } },
  );
  if (t) {
    const e = pickEmail(t);
    if (e) return e;
  }
  // Try org members endpoint
  const m = await safeText(
    `https://api.github.com/orgs/${enc(slug)}/public_members?per_page=5`,
    { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } },
  );
  return m ? pickEmail(m) : null;
}

// 27. Wayback CDX multi-url scan (broader than homepage)
export async function waybackCdxEmail(domain: string): Promise<string | null> {
  const paths = ["/contact", "/about", "/team", "/staff", "/contact-us"];
  for (const p of paths) {
    const cdx = (await safeJson(
      `http://web.archive.org/cdx/search/cdx?url=${enc(domain + p)}&output=json&limit=1&fl=timestamp,original&filter=statuscode:200`,
    )) as string[][] | null;
    const ts = cdx?.[1]?.[0];
    const orig = cdx?.[1]?.[1];
    if (!ts || !orig) continue;
    const archived = await safeText(`https://web.archive.org/web/${ts}/${orig}`);
    if (archived) {
      const e = pickEmail(archived, domain);
      if (e) return e;
    }
  }
  return null;
}

// 28. Crunchbase public organization search (unauthenticated, HTML)
export async function crunchbaseEmail(name: string): Promise<string | null> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const t = await safeText(`https://www.crunchbase.com/organization/${enc(slug)}`);
  return t ? pickEmail(t) : null;
}

// 29. Sitemap.xml crawl — finds contact/about pages, scrapes for email
export async function sitemapCrawlEmail(domain: string): Promise<string | null> {
  for (const smap of ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-0.xml"]) {
    const t = await safeText(`https://${domain}${smap}`);
    if (!t) continue;
    // Extract URLs containing 'contact' or 'about'
    const urls = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .filter((u) => /contact|about|team|staff|reach/i.test(u))
      .slice(0, 5);
    for (const u of urls) {
      const page = await safeText(u);
      if (page) {
        const e = pickEmail(page, domain);
        if (e) return e;
      }
    }
  }
  return null;
}

// 30. LinkedIn company page slug (public HTML, no auth)
export async function linkedinSlugEmail(name: string): Promise<string | null> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const t = await safeText(
    `https://www.linkedin.com/company/${enc(slug)}/about/`,
  );
  return t ? pickEmail(t) : null;
}

// 31. Facebook page info (public graph, no key for basic fields)
export async function facebookPageEmail(name: string): Promise<string | null> {
  const slug = name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]+/g, "");
  const t = await safeText(`https://www.facebook.com/${enc(slug)}/about`);
  return t ? pickEmail(t) : null;
}

// 32. MapQuest public search (no API key for basic HTML)
export async function mapquestEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const query = city ? `${name} ${city}` : name;
  const t = await safeText(
    `https://www.mapquest.com/search/results?query=${enc(query)}`,
  );
  return t ? pickEmail(t) : null;
}

// 33. HERE Places (free tier — uses app_id/app_code or API key)
export async function hereEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const apiKey = Deno.env.get("HERE_API_KEY");
  if (!apiKey) return null;
  const q = city ? `${name} in ${city}` : name;
  const j = await safeJson(
    `https://discover.search.hereapi.com/v1/discover?q=${enc(q)}&in=countryCode:USA&limit=3&apiKey=${apiKey}`,
  );
  return pickEmail(JSON.stringify(j || {}));
}

// 34. OpenCage geocoder — returns contact email in result extras
export async function opencageEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const apiKey = Deno.env.get("OPENCAGE_API_KEY");
  if (!apiKey) return null;
  const q = city ? `${name}, ${city}` : name;
  const j = await safeJson(
    `https://api.opencagedata.com/geocode/v1/json?q=${enc(q)}&key=${apiKey}&limit=3&no_annotations=0`,
  );
  return pickEmail(JSON.stringify(j || {}));
}

// 35. SEC EDGAR full-text search — finds email in filings
export async function secEdgarEmail(name: string): Promise<string | null> {
  // EDGAR full-text search API (free, no auth)
  const j = await safeJson(
    `https://efts.sec.gov/LATEST/search-index?q="${enc(name)}"&dateRange=custom&startdt=2022-01-01&forms=DEF+14A,10-K,ARS`,
  );
  if (j) {
    const e = pickEmail(JSON.stringify(j));
    if (e) return e;
  }
  // Also try company search
  const co = await safeJson(
    `https://efts.sec.gov/LATEST/search-index?q=${enc(name)}&forms=10-K&dateRange=custom&startdt=2023-01-01`,
  );
  return co ? pickEmail(JSON.stringify(co)) : null;
}

// 36. GovInfo.gov (GPO) — federal publications, often list contacts
export async function govinfoEmail(name: string): Promise<string | null> {
  const j = await safeJson(
    `https://api.govinfo.gov/search?query=${enc(name)}&pageSize=5&offsetMark=*&sorts=relevance%3ADESC`,
  );
  return j ? pickEmail(JSON.stringify(j)) : null;
}

// 37. SAM.gov entity search (free, no key needed for basic search)
export async function samEntityEmail(name: string): Promise<string | null> {
  const j = await safeJson(
    `https://api.sam.gov/entity-information/v3/entities?legalBusinessName=${enc(name)}&includeSections=entityRegistration,pointsOfContact&format=json`,
    {},
    8000,
  );
  return j ? pickEmail(JSON.stringify(j)) : null;
}

// 38. Twitter/X bio scrape (public embed endpoint)
export async function twitterBioEmail(name: string): Promise<string | null> {
  // Try Twitter widget / oembed for company handle
  const slug = name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 20);
  const t = await safeText(
    `https://publish.twitter.com/oembed?url=https://twitter.com/${enc(slug)}&omit_script=true`,
  );
  return t ? pickEmail(t) : null;
}

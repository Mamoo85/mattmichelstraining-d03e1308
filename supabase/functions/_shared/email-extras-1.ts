// email-extras-1.ts — Free email enrichment sources, Tiers 10–24.
// Second wave: Wayback Machine, BBB, Detroit open business registry,
// Google Places, GitHub commits, DNS MX patterns, Bing SERP, Reddit,
// Common Crawl, Hunter finder, YellowPages, Yelp, Foursquare, OSM, DuckDuckGo.
// All fail-open (null on any error / non-200 / empty result).

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
        "User-Agent": "Mozilla/5.0 (compatible; EnrichBot/1.0)",
        ...((init?.headers as Record<string, string>) || {}),
      },
    });
    if (!res.ok) { await res.body?.cancel(); return null; }
    return await res.text();
  } catch { return null; }
}

async function safeJson(
  url: string,
  init?: RequestInit,
  timeoutMs = 7000,
): Promise<unknown> {
  const t = await safeText(url, init, timeoutMs);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

const enc = (s: string) => encodeURIComponent(s);

// 10. Wayback Machine — scrape the most recent cached copy of the homepage
// for emails that may have been removed from the live site.
export async function waybackEmail(domain: string): Promise<string | null> {
  try {
    // CDX API: find most recent snapshot URL
    const cdx = await safeJson(
      `https://web.archive.org/cdx/search/cdx?url=${enc(domain)}/&output=json&fl=timestamp,original&filter=statuscode:200&limit=3&collapse=digest`,
    ) as Array<[string, string]> | null;
    if (!Array.isArray(cdx) || cdx.length < 2) return null;
    // cdx[0] is the header row ["timestamp","original"]
    const [ts] = cdx[1];
    const archivedUrl = `https://web.archive.org/web/${ts}/${domain}/`;
    const html = await safeText(archivedUrl);
    return html ? pickEmail(html, domain) : null;
  } catch { return null; }
}

// 11. BBB direct API endpoint (returns JSON business info including contact)
export async function bbbEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  // BBB has an unofficial JSON API used by their search widget
  const q = city ? `${name} ${city}` : name;
  const t = await safeText(
    `https://www.bbb.org/search?find_text=${enc(q)}&find_loc=&find_type=&find_id=&find_by=name&find_latlng=&find_country=USA&find_state=&find_page=1`,
    { headers: { Accept: "application/json, text/html" } },
  );
  return t ? pickEmail(t) : null;
}

// 12. Detroit Open Business Registry (ArcGIS free)
// Matches business by name, returns phone/website from "Currently_Open_Businesses"
export async function detroitOpenBizEmail(
  name: string,
): Promise<string | null> {
  try {
    const url =
      `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Currently_Open_Businesses/FeatureServer/0/query` +
      `?where=${enc(`business_name LIKE '%${name.replace(/'/g, "''")}%'`)}&outFields=business_name,business_email,website&f=json&resultRecordCount=5`;
    const j = await safeJson(url) as { features?: Array<{ attributes?: Record<string, string> }> } | null;
    const attrs = j?.features?.[0]?.attributes;
    if (!attrs) return null;
    if (attrs.business_email && attrs.business_email !== "null") return attrs.business_email;
    if (attrs.website) {
      // Scrape the website for email as a secondary step
      const html = await safeText(attrs.website.startsWith("http") ? attrs.website : `https://${attrs.website}`);
      if (html) return pickEmail(html);
    }
    return null;
  } catch { return null; }
}

// 13. Google Places API — text search → place details → scrape website
export async function googlePlacesEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return null;
  try {
    const query = city ? `${name} ${city}` : name;
    const search = await safeJson(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${enc(query)}&key=${key}`,
    ) as { results?: Array<{ place_id?: string }> } | null;
    const placeId = search?.results?.[0]?.place_id;
    if (!placeId) return null;
    const detail = await safeJson(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=website,formatted_phone_number&key=${key}`,
    ) as { result?: { website?: string } } | null;
    const website = detail?.result?.website;
    if (!website) return null;
    const html = await safeText(website);
    return html ? pickEmail(html) : null;
  } catch { return null; }
}

// 14. GitHub commits — find committer email for an org or user matching the business name
export async function githubCommitsEmail(
  name: string,
): Promise<string | null> {
  const token = Deno.env.get("GITHUB_TOKEN");
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    // Search for orgs/users matching business name
    const users = await safeJson(
      `https://api.github.com/search/users?q=${enc(name)}&type=org&per_page=3`,
      { headers },
    ) as { items?: Array<{ login?: string }> } | null;
    const login = users?.items?.[0]?.login;
    if (!login) return null;
    // Fetch recent commits for that org's most active repo
    const repos = await safeJson(
      `https://api.github.com/orgs/${enc(login)}/repos?sort=pushed&per_page=1`,
      { headers },
    ) as Array<{ name?: string }> | null;
    const repo = Array.isArray(repos) ? repos[0]?.name : null;
    if (!repo) return null;
    const commits = await safeJson(
      `https://api.github.com/repos/${enc(login)}/${enc(repo)}/commits?per_page=5`,
      { headers },
    ) as Array<{ commit?: { author?: { email?: string } } }> | null;
    const email = Array.isArray(commits)
      ? commits.map((c) => c?.commit?.author?.email).find(
          (e) => e && pickEmail(e) && !e.includes("noreply"),
        )
      : null;
    return email ? pickEmail(email) : null;
  } catch { return null; }
}

// 15. DNS MX pattern — resolve domain's MX host, generate patterns, verify with Snov
// (Verification is intentionally skipped here; this just generates the candidate.
//  Caller wires in verification separately via pattern_verify tier.)
export async function dnsMxPatternEmail(domain: string): Promise<string | null> {
  try {
    // Use Google Public DNS-over-HTTPS to resolve MX records (no Deno.resolveDns needed)
    const j = await safeJson(
      `https://dns.google/resolve?name=${enc(domain)}&type=MX`,
    ) as { Answer?: Array<{ data?: string }> } | null;
    if (!Array.isArray(j?.Answer) || !j.Answer.length) return null;
    // MX data looks like "10 mail.example.com." — extract the mail hostname
    const mx = j.Answer[0]?.data?.split(" ")?.[1]?.replace(/\.$/, "");
    if (!mx) return null;
    // If MX is on the same domain, return a common pattern
    if (mx.endsWith(`.${domain}`) || mx === domain) {
      return `info@${domain}`;
    }
    return null;
  } catch { return null; }
}

// 16. Bing SERP — search "BusinessName email contact"
export async function bingSerpEmail(
  name: string,
  domain?: string,
): Promise<string | null> {
  const key = Deno.env.get("BING_SEARCH_API_KEY");
  if (key) {
    // Use official API when available
    try {
      const q = domain ? `site:${domain} email` : `"${name}" email contact`;
      const j = await safeJson(
        `https://api.bing.microsoft.com/v7.0/search?q=${enc(q)}&count=5`,
        { headers: { "Ocp-Apim-Subscription-Key": key } },
      ) as { webPages?: { value?: Array<{ snippet?: string }> } } | null;
      const snippets = j?.webPages?.value?.map((v) => v?.snippet || "").join(" ") || "";
      return snippets ? pickEmail(snippets, domain) : null;
    } catch { /* fall through */ }
  }
  // Free fallback: scrape Bing HTML search
  const q = domain ? `site:${enc(domain)} email` : `${enc(`"${name}"`)}+email+contact`;
  const html = await safeText(`https://www.bing.com/search?q=${q}&setlang=en`);
  return html ? pickEmail(html, domain) : null;
}

// 17. Reddit — search for business mentions with contact info
export async function redditEmail(name: string): Promise<string | null> {
  try {
    const j = await safeJson(
      `https://www.reddit.com/search.json?q=${enc(`"${name}"`)}+email&sort=relevance&limit=5`,
      { headers: { Accept: "application/json" } },
    ) as { data?: { children?: Array<{ data?: { selftext?: string; title?: string } }> } } | null;
    const posts = j?.data?.children ?? [];
    for (const p of posts) {
      const text = [p.data?.selftext, p.data?.title].filter(Boolean).join(" ");
      const e = pickEmail(text);
      if (e) return e;
    }
    return null;
  } catch { return null; }
}

// 18. Common Crawl CDX — find domain in recent crawl index, fetch cached page for email
export async function commonCrawlEmail(domain: string): Promise<string | null> {
  try {
    // CC CDX index API (last crawl index)
    const index = "CC-MAIN-2024-51";
    const cdx = await safeJson(
      `https://index.commoncrawl.org/${index}-index?url=${enc(domain + "/*")}&output=json&limit=3&fields=filename,offset,length`,
    );
    // If CDX is newline-delimited JSON, parse first line
    let record: { filename?: string; offset?: string; length?: string } | null = null;
    if (typeof cdx === "string") {
      try { record = JSON.parse((cdx as string).split("\n")[0]); } catch { return null; }
    } else if (cdx && typeof cdx === "object") {
      record = cdx as typeof record;
    }
    if (!record?.filename || !record?.offset || !record?.length) return null;
    // Fetch the WARC segment from S3
    const start = parseInt(record.offset, 10);
    const end = start + parseInt(record.length, 10) - 1;
    const resp = await fetch(
      `https://data.commoncrawl.org/${record.filename}`,
      { headers: { Range: `bytes=${start}-${end}`, "User-Agent": "EnrichBot/1.0" }, signal: AbortSignal.timeout(10000) },
    );
    if (!resp.ok) { await resp.body?.cancel(); return null; }
    const text = await resp.text();
    return pickEmail(text, domain);
  } catch { return null; }
}

// 19. Hunter.io email finder — by name + domain (different from domain-search tier)
export async function hunterFinderEmail(
  domain: string,
  firstName?: string | null,
  lastName?: string | null,
): Promise<string | null> {
  const key = Deno.env.get("HUNTER_API_KEY") || Deno.env.get("HUNTER_IO_API_KEY");
  if (!key || !firstName || !lastName) return null;
  try {
    const j = await safeJson(
      `https://api.hunter.io/v2/email-finder?domain=${enc(domain)}&first_name=${enc(firstName)}&last_name=${enc(lastName)}&api_key=${key}`,
    ) as { data?: { email?: string } } | null;
    const email = j?.data?.email;
    return email && pickEmail(email) ? email : null;
  } catch { return null; }
}

// 20. YellowPages.com — business directory HTML scrape
export async function yellowpagesEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const loc = city ? city.toLowerCase().replace(/\s+/g, "-") : "detroit-mi";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const t = await safeText(
    `https://www.yellowpages.com/search?search_terms=${enc(name)}&geo_location_terms=${enc(city || "Detroit, MI")}`,
  );
  return t ? pickEmail(t) : null;
}

// 21. Yelp Fusion — business search API (returns phone/website, then scrape)
export async function yelpFusionEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const key = Deno.env.get("YELP_API_KEY");
  if (key) {
    try {
      const loc = city || "Detroit, MI";
      const j = await safeJson(
        `https://api.yelp.com/v3/businesses/search?term=${enc(name)}&location=${enc(loc)}&limit=3`,
        { headers: { Authorization: `Bearer ${key}` } },
      ) as { businesses?: Array<{ url?: string; id?: string }> } | null;
      const biz = j?.businesses?.[0];
      if (biz?.url) {
        const html = await safeText(biz.url);
        if (html) { const e = pickEmail(html); if (e) return e; }
      }
    } catch { /* fall through to HTML scrape */ }
  }
  // Free HTML fallback
  const t = await safeText(
    `https://www.yelp.com/search?find_desc=${enc(name)}&find_loc=${enc(city || "Detroit, MI")}`,
  );
  return t ? pickEmail(t) : null;
}

// 22. Foursquare Places API — search for venue, get website, scrape
export async function foursquareEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  const key = Deno.env.get("FOURSQUARE_API_KEY");
  if (!key) return null;
  try {
    const ll = city ? "" : "&near=Detroit,MI";
    const j = await safeJson(
      `https://api.foursquare.com/v3/places/search?query=${enc(name)}${ll}&limit=3`,
      { headers: { Authorization: key, Accept: "application/json" } },
    ) as { results?: Array<{ fsq_id?: string; website?: string }> } | null;
    const place = j?.results?.[0];
    if (place?.website) {
      const html = await safeText(place.website);
      if (html) { const e = pickEmail(html); if (e) return e; }
    }
    return null;
  } catch { return null; }
}

// 23. OpenStreetMap Nominatim — free geocoding/business search
export async function osmEmail(
  name: string,
  city?: string,
): Promise<string | null> {
  try {
    const q = city ? `${name}, ${city}` : `${name}, Detroit`;
    const j = await safeJson(
      `https://nominatim.openstreetmap.org/search?q=${enc(q)}&format=json&addressdetails=1&limit=3`,
      { headers: { "User-Agent": "DWA-EnrichBot/1.0 (matt@detroitwebagent.com)" } },
    ) as Array<{ extratags?: { email?: string; website?: string } }> | null;
    if (!Array.isArray(j) || !j.length) return null;
    for (const r of j) {
      if (r.extratags?.email) return r.extratags.email;
      if (r.extratags?.website) {
        const html = await safeText(r.extratags.website);
        if (html) { const e = pickEmail(html); if (e) return e; }
      }
    }
    return null;
  } catch { return null; }
}

// 24. DuckDuckGo Instant Answer API — zero-click info sometimes has email
export async function duckduckgoEmail(
  name: string,
): Promise<string | null> {
  try {
    const j = await safeJson(
      `https://api.duckduckgo.com/?q=${enc(name)}&format=json&no_html=1&skip_disambig=1`,
    ) as { AbstractURL?: string; AbstractText?: string; RelatedTopics?: Array<{ Text?: string }> } | null;
    const text = [j?.AbstractText, ...(j?.RelatedTopics?.map((r) => r?.Text) ?? [])].filter(Boolean).join(" ");
    const e = pickEmail(text);
    if (e) return e;
    if (j?.AbstractURL) {
      const html = await safeText(j.AbstractURL);
      if (html) return pickEmail(html);
    }
    return null;
  } catch { return null; }
}

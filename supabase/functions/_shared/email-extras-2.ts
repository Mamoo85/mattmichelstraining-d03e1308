// Second wave of free / low-cost email-extraction helpers.
// Wired into the waterfall after email-extras (tiers 20-29).
// Every helper fails open (returns null) — never throws.

const UA = { "User-Agent": "Mozilla/5.0 (compatible; DWA-Discovery/1.0)" };

function looksLikeBizEmail(e: string): boolean {
  const l = e.toLowerCase();
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(l)) return false;
  if (/\.(png|jpg|svg|gif|webp|js|css)$/.test(l)) return false;
  if (/(example|sentry|wixpress|gstatic|googleapis|cloudflare|gravatar|schema\.org|w3\.org|sentry\.io|wordpress\.com)/.test(l)) return false;
  if (/^(user|admin|test|noreply|no-reply|webmaster|postmaster|name|email|someone|nobody|null|root|daemon)@/.test(l)) return false;
  return true;
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

async function safeJson(url: string, headers: Record<string, string> = {}, timeoutMs = 7000): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) { await r.body?.cancel(); return null; }
    return await r.json();
  } catch { return null; }
}
async function safeText(url: string, headers: Record<string, string> = {}, timeoutMs = 7000): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) { await r.body?.cancel(); return null; }
    return await r.text();
  } catch { return null; }
}

// 20. Hunter Email Finder — needs first/last + domain. Uses HUNTER_IO_API_KEY (Hunter sometimes 'HUNTER_API_KEY').
export async function hunterFinder(domain: string, first: string, last: string): Promise<string | null> {
  const key = Deno.env.get("HUNTER_IO_API_KEY") || Deno.env.get("HUNTER_API_KEY");
  if (!key) return null;
  const j = await safeJson(
    `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(last)}&api_key=${key}`,
  );
  const e = j?.data?.email;
  return e && looksLikeBizEmail(e) ? e : null;
}

// 21. Yellowpages.com — scrape directory result page for emails.
export async function yellowpagesEmail(businessName: string, city: string): Promise<string | null> {
  const html = await safeText(
    `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(businessName)}&geo_location_terms=${encodeURIComponent(city)}`,
  );
  if (!html) return null;
  const emails = (html.match(EMAIL_RE) || []).filter(looksLikeBizEmail);
  return emails[0] || null;
}

// 22. Yelp Fusion — needs YELP_API_KEY. Returns business URL → scrape for email.
export async function yelpFusionEmail(businessName: string, city: string): Promise<string | null> {
  const key = Deno.env.get("YELP_API_KEY");
  if (!key) return null;
  const j = await safeJson(
    `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(businessName)}&location=${encodeURIComponent(city)}&limit=1`,
    { Authorization: `Bearer ${key}` },
  );
  const url = j?.businesses?.[0]?.url;
  if (!url) return null;
  const html = await safeText(url);
  if (!html) return null;
  const emails = (html.match(EMAIL_RE) || []).filter(looksLikeBizEmail);
  return emails[0] || null;
}

// 23. Foursquare Places — needs FOURSQUARE_API_KEY.
export async function foursquareEmail(businessName: string, city: string): Promise<string | null> {
  const key = Deno.env.get("FOURSQUARE_API_KEY");
  if (!key) return null;
  const j = await safeJson(
    `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(businessName)}&near=${encodeURIComponent(city)}&limit=1&fields=email,website`,
    { Authorization: key, Accept: "application/json" },
  );
  const place = j?.results?.[0];
  if (place?.email && looksLikeBizEmail(place.email)) return place.email;
  if (place?.website) {
    const html = await safeText(place.website);
    const emails = (html?.match(EMAIL_RE) || []).filter(looksLikeBizEmail);
    return emails[0] || null;
  }
  return null;
}

// 24. OpenStreetMap Overpass — searches for business by name, reads contact:email tag.
export async function osmContactEmail(businessName: string, city: string): Promise<string | null> {
  const q = `[out:json][timeout:10];area[name="${city.replace(/"/g, "")}"]->.a;(node["name"~"${businessName.replace(/"/g, "").slice(0, 40)}",i](area.a);way["name"~"${businessName.replace(/"/g, "").slice(0, 40)}",i](area.a););out tags 5;`;
  const j = await safeJson(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
  for (const el of (j?.elements || [])) {
    const e = el?.tags?.["contact:email"] || el?.tags?.email;
    if (e && looksLikeBizEmail(e)) return e;
  }
  return null;
}

// 25. DuckDuckGo HTML — `"@domain"` SERP.
export async function duckduckgoEmail(domain: string): Promise<string | null> {
  const html = await safeText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"@${domain}"`)}`);
  if (!html) return null;
  const emails = (html.match(EMAIL_RE) || [])
    .filter((e) => e.toLowerCase().endsWith(`@${domain}`))
    .filter(looksLikeBizEmail);
  return emails[0] || null;
}

// 26. Yandex search — alt-engine SERP for `"@domain"`.
export async function yandexEmail(domain: string): Promise<string | null> {
  const html = await safeText(`https://yandex.com/search/?text=${encodeURIComponent(`"@${domain}"`)}`);
  if (!html) return null;
  const emails = (html.match(EMAIL_RE) || [])
    .filter((e) => e.toLowerCase().endsWith(`@${domain}`))
    .filter(looksLikeBizEmail);
  return emails[0] || null;
}

// 27. GitHub Events — recent public events by org members may leak commit author emails.
export async function githubEventsEmail(domain: string): Promise<string | null> {
  const tok = Deno.env.get("GITHUB_TOKEN");
  if (!tok) return null;
  // Find users whose public profile shows the domain, then read their events.
  const search = await safeJson(
    `https://api.github.com/search/users?q=${encodeURIComponent(domain + " in:email")}&per_page=3`,
    { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json" },
  );
  for (const u of (search?.items || []).slice(0, 3)) {
    const events = await safeJson(
      `https://api.github.com/users/${u.login}/events/public?per_page=10`,
      { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json" },
    );
    for (const ev of (events || [])) {
      for (const c of (ev?.payload?.commits || [])) {
        const e = c?.author?.email;
        if (e && looksLikeBizEmail(e) && e.toLowerCase().endsWith(`@${domain}`)) return e;
      }
    }
  }
  return null;
}

// 28. Wayback CDX — find any archived contact pages, then scrape one.
export async function waybackCdxEmail(domain: string): Promise<string | null> {
  const txt = await safeText(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain + "/*")}&filter=statuscode:200&filter=mimetype:text/html&limit=5&output=json&fl=timestamp,original&filter=urlkey:.*contact.*`,
  );
  if (!txt) return null;
  let rows: string[][] = [];
  try { rows = JSON.parse(txt); } catch { return null; }
  for (const r of rows.slice(1, 4)) {
    const [ts, original] = r;
    if (!ts || !original) continue;
    const html = await safeText(`https://web.archive.org/web/${ts}id_/${original}`);
    if (!html) continue;
    const emails = (html.match(EMAIL_RE) || []).filter(looksLikeBizEmail);
    if (emails[0]) return emails[0];
  }
  return null;
}

// 29. Crunchbase basic — needs CRUNCHBASE_API_KEY. Returns org contact_email when present.
export async function crunchbaseEmail(businessName: string): Promise<string | null> {
  const key = Deno.env.get("CRUNCHBASE_API_KEY");
  if (!key) return null;
  const j = await safeJson(
    `https://api.crunchbase.com/api/v4/searches/organizations?user_key=${key}`,
    { "Content-Type": "application/json" },
    8000,
  );
  // Crunchbase v4 search requires POST body — fall back: try autocomplete GET.
  const ac = j ?? await safeJson(
    `https://api.crunchbase.com/api/v4/autocompletes?query=${encodeURIComponent(businessName)}&collection_ids=organizations&limit=1&user_key=${key}`,
  );
  const e = ac?.entities?.[0]?.identifier?.permalink;
  if (!e) return null;
  const detail = await safeJson(
    `https://api.crunchbase.com/api/v4/entities/organizations/${e}?field_ids=contact_email&user_key=${key}`,
  );
  const em = detail?.properties?.contact_email;
  return em && looksLikeBizEmail(em) ? em : null;
}

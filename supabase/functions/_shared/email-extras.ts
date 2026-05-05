// Free email-extraction helpers wired into the waterfall after BBB.
// Every helper fails open (returns null) — never throws.
// All sources are free / no extra paid keys.

const UA = { "User-Agent": "Mozilla/5.0 (compatible; DWA-Discovery/1.0)" };

function looksLikeBizEmail(e: string): boolean {
  const l = e.toLowerCase();
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(l)) return false;
  if (/\.(png|jpg|svg|gif|webp|js|css)$/.test(l)) return false;
  if (/(example|sentry|wixpress|gstatic|googleapis|cloudflare|gravatar|schema\.org|w3\.org|sentry\.io)/.test(l)) return false;
  if (/^(user|admin|test|noreply|no-reply|webmaster|postmaster|name|email|someone|nobody|null|root|daemon)@/.test(l)) return false;
  return true;
}

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

// 3. Google Places — find website by name+city, then scrape its homepage for emails.
export async function googlePlacesEmail(businessName: string, city: string): Promise<string | null> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return null;
  const find = await safeJson(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(businessName + " " + city)}&inputtype=textquery&fields=place_id&key=${key}`,
  );
  const pid = find?.candidates?.[0]?.place_id;
  if (!pid) return null;
  const det = await safeJson(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pid}&fields=website&key=${key}`,
  );
  const site = det?.result?.website;
  if (!site) return null;
  const html = await safeText(site);
  if (!html) return null;
  const emails = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).filter(looksLikeBizEmail);
  return emails[0] || null;
}

// 4. Detroit Open Business Registry — has email_address column for many records (MI only).
export async function detroitOpenBizEmail(businessName: string): Promise<string | null> {
  const url = `https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Detroit_Open_Business_Registry/FeatureServer/0/query?where=${encodeURIComponent(`UPPER(business_name) LIKE UPPER('%${businessName.replace(/'/g, "''").slice(0, 40)}%')`)}&outFields=business_name,email_address,owner_name&f=json&resultRecordCount=5`;
  const j = await safeJson(url);
  const feats = j?.features ?? [];
  for (const f of feats) {
    const e = f?.attributes?.email_address;
    if (e && looksLikeBizEmail(e)) return e;
  }
  return null;
}

// 6. GitHub commit-author email by domain — pulls public commits where author uses @domain.
export async function githubCommitEmail(domain: string): Promise<string | null> {
  const tok = Deno.env.get("GITHUB_TOKEN");
  if (!tok) return null;
  const j = await safeJson(
    `https://api.github.com/search/commits?q=author-email:${encodeURIComponent("@" + domain)}&per_page=5`,
    { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github.cloak-preview+json" },
  );
  for (const it of (j?.items || [])) {
    const e = it?.commit?.author?.email;
    if (e && looksLikeBizEmail(e) && e.toLowerCase().endsWith(`@${domain}`)) return e;
  }
  return null;
}

// 7. DNS MX existence check via Cloudflare DoH — proves domain accepts mail before pattern guess.
export async function hasMx(domain: string): Promise<boolean> {
  const j = await safeJson(`https://cloudflare-dns.com/dns-query?name=${domain}&type=MX`, { Accept: "application/dns-json" });
  return Array.isArray(j?.Answer) && j.Answer.some((a: any) => a?.type === 15);
}
// Then return common pattern guess as low-confidence "candidate"
export async function dnsMxPatternGuess(domain: string, first?: string | null, last?: string | null): Promise<string | null> {
  if (!(await hasMx(domain))) return null;
  if (first && last) {
    const f = first.toLowerCase().replace(/[^a-z]/g, "");
    const l = last.toLowerCase().replace(/[^a-z]/g, "");
    if (f && l) return `${f}.${l}@${domain}`;
  }
  return `info@${domain}`;
}

// 8. Bing HTML search — `"@domain.com" -www` returns SERP snippets containing emails.
export async function bingDomainEmail(domain: string): Promise<string | null> {
  const html = await safeText(`https://www.bing.com/search?q=${encodeURIComponent(`"@${domain}"`)}`);
  if (!html) return null;
  const emails = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
    .filter((e) => e.toLowerCase().endsWith(`@${domain}`))
    .filter(looksLikeBizEmail);
  return emails[0] || null;
}

// 9. Reddit JSON search — surfaces emails posted in trade subs / city subs.
export async function redditMentionEmail(businessName: string): Promise<string | null> {
  const j = await safeJson(`https://www.reddit.com/search.json?q=${encodeURIComponent(businessName + " email")}&limit=10`);
  const posts = j?.data?.children || [];
  for (const p of posts) {
    const text = `${p?.data?.title || ""} ${p?.data?.selftext || ""}`;
    const emails = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).filter(looksLikeBizEmail);
    if (emails[0]) return emails[0];
  }
  return null;
}

// 10. Common Crawl URL index — finds any cached page on the domain that may leak emails.
export async function commonCrawlEmail(domain: string): Promise<string | null> {
  const idx = await safeJson(`https://index.commoncrawl.org/CC-MAIN-2024-30-index?url=${encodeURIComponent(domain + "/contact*")}&output=json&limit=3`);
  // CC returns NDJSON when not asked for json output; try text fallback
  let urls: string[] = [];
  if (Array.isArray(idx)) urls = idx.map((r: any) => r?.url).filter(Boolean);
  if (!urls.length) {
    const txt = await safeText(`https://index.commoncrawl.org/CC-MAIN-2024-30-index?url=${encodeURIComponent(domain + "/contact*")}&limit=3`);
    if (txt) {
      urls = txt.split("\n").map((l) => { try { return JSON.parse(l)?.url; } catch { return null; } }).filter(Boolean) as string[];
    }
  }
  for (const u of urls.slice(0, 2)) {
    const html = await safeText(u);
    if (!html) continue;
    const emails = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []).filter(looksLikeBizEmail);
    if (emails[0]) return emails[0];
  }
  return null;
}

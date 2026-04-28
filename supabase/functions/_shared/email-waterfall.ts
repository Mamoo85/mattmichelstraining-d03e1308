// Email enrichment waterfall — shared module.
// Order (cheapest → most expensive):
//   1. site_scrape      (free)
//   2. snov             (cheap, owned)
//   3. apollo           (free tier)
//   4. pattern_verify   (Snov verify pattern guesses)
//   5. hunter           (last paid step — drain slowly)
//   6. pdl              (premium, only with business_name + city)
//
// Stop at first hit with confidence >= 50.
// Skips any provider 429'd in the last 60 minutes.
// Logs every call into enrichment_provider_health via bump_provider_health RPC.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY") || "";
const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";
const SNOV_USER_ID   = Deno.env.get("SNOV_USER_ID") || "";
const SNOV_API_KEY   = Deno.env.get("SNOV_API_KEY") || "";
const PDL_API_KEY    = Deno.env.get("PDL_API_KEY") || "";

export type EmailWaterfallInput = {
  website?: string | null;
  business_name?: string | null;
  city?: string | null;
  state?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
};

export type EmailWaterfallResult = {
  email: string | null;
  source: string | null;
  confidence: number;
  trace: { source: string; ok: boolean; error?: string }[];
};

export type WaterfallCounters = Record<string, number>;

const BLOCKLIST = [
  "example.com","google.com","facebook.com","wix.com","squarespace.com","sentry.io","w3.org",
  "wixpress.com","domain.com","yoursite.com","yourdomain.com","test.com","placeholder",
  "wordpress.com","wordpress.org","github.com","jsdelivr","googleapis.com","gstatic.com",
  "cloudflare","schema.org","gravatar.com","fontawesome","googleusercontent.com",
  "creativecommons.org","mozilla.org","apple.com","microsoft.com","twitter.com",
  "instagram.com","linkedin.com","youtube.com","tiktok.com","pinterest.com","yelp.com",
  "bbb.org","angieslist.com","homeadvisor.com","thumbtack.com",
];
const BLOCKED_PREFIXES = [
  "user@","admin@","test@","noreply@","no-reply@","webmaster@","postmaster@",
  "name@","email@","someone@","nobody@","null@","root@","daemon@",
];

function normalizeUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = raw.startsWith("http") ? raw : `https://${raw}`;
    new URL(u);
    return u;
  } catch { return null; }
}

function domainFromWebsite(website?: string | null): string | null {
  if (!website) return null;
  const u = normalizeUrl(website);
  if (!u) return null;
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return null; }
}

// ── Provider Health helpers ──────────────────────────────────────────────────
const HEALTH_CACHE: Record<string, { skip: boolean; ts: number }> = {};
const SKIP_CACHE_TTL_MS = 60_000;

async function isProviderRateLimited(sb: SupabaseClient, provider: string): Promise<boolean> {
  const cached = HEALTH_CACHE[provider];
  if (cached && Date.now() - cached.ts < SKIP_CACHE_TTL_MS) return cached.skip;
  try {
    const { data } = await sb
      .from("enrichment_provider_health")
      .select("last_429_at, credits_remaining")
      .eq("provider", provider)
      .maybeSingle();
    let skip = false;
    if (data?.last_429_at) {
      const ageMs = Date.now() - new Date(data.last_429_at).getTime();
      if (ageMs < 60 * 60 * 1000) skip = true;
    }
    if (data && typeof data.credits_remaining === "number" && data.credits_remaining <= 0) skip = true;
    HEALTH_CACHE[provider] = { skip, ts: Date.now() };
    return skip;
  } catch {
    return false;
  }
}

async function bump(sb: SupabaseClient, provider: string, hit: boolean, opts?: { credits?: number; was429?: boolean }) {
  try {
    await sb.rpc("bump_provider_health", {
      _provider: provider,
      _hit: hit,
      _credits_remaining: opts?.credits ?? null,
      _was_429: opts?.was429 ?? false,
    });
    if (opts?.was429) HEALTH_CACHE[provider] = { skip: true, ts: Date.now() };
  } catch (e) {
    console.warn(`[waterfall] bump ${provider} failed:`, e);
  }
}

// ── Validators ──────────────────────────────────────────────────────────────
function looksValidEmail(e: string): boolean {
  const l = e.toLowerCase();
  if (BLOCKLIST.some((d) => l.includes(d))) return false;
  if (/\.(png|jpg|svg|js|css|gif|webp|woff|ttf|eot)$/i.test(l)) return false;
  if (l.length > 60 || l.length < 6) return false;
  const local = l.split("@")[0];
  if (local.length > 20 && /[0-9a-f]{8,}/.test(local)) return false;
  if (BLOCKED_PREFIXES.some((p) => l.startsWith(p))) return false;
  if (!/\.(com|net|org|biz|us|co|io|info|email)$/.test(l)) return false;
  return true;
}

// ── 1. Site scrape ──────────────────────────────────────────────────────────
async function siteScrape(websiteUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();

    let siteDomain = "";
    try { siteDomain = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase(); } catch {}

    const emails = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
      .filter(looksValidEmail);
    if (!emails.length) return null;
    if (siteDomain) {
      const m = emails.find((e) => e.toLowerCase().endsWith(`@${siteDomain}`));
      if (m) return m;
    }
    const bizPrefixes = ["info@","contact@","office@","hello@","sales@","service@","mail@"];
    return emails.find((e) => bizPrefixes.some((p) => e.toLowerCase().startsWith(p))) || emails[0];
  } catch { return null; }
}

// ── 2. Snov.io domain search ────────────────────────────────────────────────
let SNOV_TOKEN_CACHE: { token: string; exp: number } | null = null;
async function getSnovToken(): Promise<string | null> {
  if (!SNOV_USER_ID || !SNOV_API_KEY) return null;
  if (SNOV_TOKEN_CACHE && SNOV_TOKEN_CACHE.exp > Date.now()) return SNOV_TOKEN_CACHE.token;
  try {
    const res = await fetch("https://api.snov.io/v1/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${SNOV_USER_ID}&client_secret=${SNOV_API_KEY}`,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!j?.access_token) return null;
    SNOV_TOKEN_CACHE = { token: j.access_token, exp: Date.now() + 50 * 60 * 1000 };
    return j.access_token;
  } catch { return null; }
}

async function snovDomainSearch(sb: SupabaseClient, domain: string): Promise<{ email: string; confidence: number } | null> {
  const token = await getSnovToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.snov.io/v2/domain-emails-with-info?domain=${encodeURIComponent(domain)}&type=all&limit=5`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) }
    );
    if (res.status === 429) { await bump(sb, "snov", false, { was429: true }); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    const emails = data?.data?.emails || data?.emails || [];
    const best = emails
      .filter((e: any) => e?.email && looksValidEmail(e.email))
      .sort((a: any, b: any) => ((b.smtp_status === "valid" ? 1 : 0) - (a.smtp_status === "valid" ? 1 : 0)))[0];
    if (!best) return null;
    return { email: best.email, confidence: best.smtp_status === "valid" ? 80 : 55 };
  } catch { return null; }
}

async function snovVerify(sb: SupabaseClient, email: string): Promise<boolean> {
  const token = await getSnovToken();
  if (!token) return false;
  try {
    const res = await fetch(
      `https://api.snov.io/v1/email-verifier?access_token=${token}&email=${encodeURIComponent(email)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.status === 429) { await bump(sb, "snov", false, { was429: true }); return false; }
    if (!res.ok) return false;
    const data = await res.json();
    const result = data?.data?.result || data?.result;
    return result === "deliverable" || result === "risky";
  } catch { return false; }
}

// ── 3. Apollo people/match ──────────────────────────────────────────────────
async function apolloMatch(sb: SupabaseClient, domain: string, businessName: string): Promise<{ email: string; confidence: number } | null> {
  if (!APOLLO_API_KEY) return null;
  try {
    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": APOLLO_API_KEY,
      },
      body: JSON.stringify({ organization_name: businessName, domain, reveal_personal_emails: false }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) { await bump(sb, "apollo", false, { was429: true }); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    const person = data?.person;
    if (!person?.email || !looksValidEmail(person.email)) return null;
    return { email: person.email, confidence: 70 };
  } catch { return null; }
}

// ── 4. Pattern guess + Snov verify ──────────────────────────────────────────
async function patternGuessAndVerify(
  sb: SupabaseClient,
  domain: string,
  first?: string | null,
  last?: string | null,
): Promise<{ email: string; confidence: number } | null> {
  const guesses: string[] = [];
  if (first && last) {
    const f = first.toLowerCase().replace(/[^a-z]/g, "");
    const l = last.toLowerCase().replace(/[^a-z]/g, "");
    if (f && l) {
      guesses.push(`${f}.${l}@${domain}`, `${f}${l}@${domain}`, `${f[0]}${l}@${domain}`, `${f}@${domain}`);
    }
  }
  guesses.push(`info@${domain}`, `contact@${domain}`, `hello@${domain}`, `sales@${domain}`, `office@${domain}`);
  for (const g of guesses) {
    if (!looksValidEmail(g)) continue;
    const ok = await snovVerify(sb, g);
    if (ok) return { email: g, confidence: 65 };
  }
  return null;
}

// ── 5. Hunter (last paid step) ──────────────────────────────────────────────
async function hunterDomainSearch(sb: SupabaseClient, domain: string): Promise<{ email: string; confidence: number } | null> {
  if (!HUNTER_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=5&api_key=${HUNTER_API_KEY}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (res.status === 429) { await bump(sb, "hunter", false, { was429: true }); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    const credits = data?.meta?.results;
    if (typeof credits === "number") {
      // Hunter doesn't return remaining credits in domain-search; ignore.
    }
    const emails = data?.data?.emails || [];
    const sorted = emails
      .filter((e: any) => e.value && looksValidEmail(e.value) && (e.confidence ?? 0) >= 50)
      .sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0));
    if (!sorted.length) return null;
    return { email: sorted[0].value, confidence: sorted[0].confidence ?? 50 };
  } catch { return null; }
}

// ── 6.5 PDL name-only search (healthcare / contractors w/o business) ──────
// Used when business_name+city is missing but we have a person's name + city.
// Calls mixed_people/search → top match → resolve email via person/enrich by id.
async function pdlNameOnlySearch(
  sb: SupabaseClient,
  firstName: string,
  lastName: string,
  city?: string | null,
  state?: string | null,
): Promise<{ email: string; confidence: number } | null> {
  if (!PDL_API_KEY) return null;
  try {
    // mixed_people/search uses Elasticsearch query DSL
    const must: any[] = [
      { term: { first_name: firstName.toLowerCase() } },
      { term: { last_name: lastName.toLowerCase() } },
    ];
    if (city) must.push({ term: { location_locality: city.toLowerCase() } });
    if (state) must.push({ term: { location_region: state.toLowerCase() } });

    const body = {
      query: { bool: { must } },
      size: 1,
    };
    const res = await fetch("https://api.peopledatalabs.com/v5/person/search", {
      method: "POST",
      headers: { "X-Api-Key": PDL_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 429) { await bump(sb, "pdl", false, { was429: true }); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    const person = data?.data?.[0];
    if (!person) return null;
    const email = person.work_email || person.personal_emails?.[0] || person.recommended_personal_email;
    if (!email || !looksValidEmail(email)) return null;
    // Lower confidence than direct company match — name-only is fuzzier
    return { email, confidence: 60 };
  } catch { return null; }
}

// ── 6. PDL person enrich ────────────────────────────────────────────────────
async function pdlPersonEnrich(
  sb: SupabaseClient,
  businessName: string,
  city: string,
  state?: string | null,
): Promise<{ email: string; confidence: number } | null> {
  if (!PDL_API_KEY) return null;
  try {
    const params = new URLSearchParams({
      company: businessName,
      locality: city,
      ...(state ? { region: state } : {}),
      pretty: "false",
    });
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { "X-Api-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) { await bump(sb, "pdl", false, { was429: true }); return null; }
    if (!res.ok) return null;
    const data = await res.json();
    const email = data?.data?.work_email || data?.data?.personal_emails?.[0];
    if (!email || !looksValidEmail(email)) return null;
    return { email, confidence: 75 };
  } catch { return null; }
}

// ── Main waterfall ──────────────────────────────────────────────────────────
export async function runEmailWaterfall(
  sb: SupabaseClient,
  input: EmailWaterfallInput,
  counters?: WaterfallCounters,
): Promise<EmailWaterfallResult> {
  const trace: EmailWaterfallResult["trace"] = [];
  const url = normalizeUrl(input.website || "");
  const domain = domainFromWebsite(input.website);

  const hit = (source: string, email: string, confidence: number): EmailWaterfallResult => {
    if (counters) counters[source] = (counters[source] || 0) + 1;
    trace.push({ source, ok: true });
    return { email, source, confidence, trace };
  };
  const miss = (source: string, error?: string) => {
    trace.push({ source, ok: false, error });
  };

  // 1. site_scrape
  if (url) {
    const e = await siteScrape(url);
    if (e) { await bump(sb, "site_scrape", true); return hit("site_scrape", e, 60); }
    await bump(sb, "site_scrape", false);
    miss("site_scrape");
  }

  // 2. snov
  if (domain && !(await isProviderRateLimited(sb, "snov"))) {
    const r = await snovDomainSearch(sb, domain);
    if (r) { await bump(sb, "snov", true); return hit("snov", r.email, r.confidence); }
    await bump(sb, "snov", false);
    miss("snov");
  }

  // 3. apollo
  if (domain && input.business_name && !(await isProviderRateLimited(sb, "apollo"))) {
    const r = await apolloMatch(sb, domain, input.business_name);
    if (r) { await bump(sb, "apollo", true); return hit("apollo", r.email, r.confidence); }
    await bump(sb, "apollo", false);
    miss("apollo");
  }

  // 4. pattern_verify
  if (domain && !(await isProviderRateLimited(sb, "snov"))) {
    const r = await patternGuessAndVerify(sb, domain, input.contact_first_name, input.contact_last_name);
    if (r) { await bump(sb, "pattern_verify", true); return hit("pattern_verify", r.email, r.confidence); }
    await bump(sb, "pattern_verify", false);
    miss("pattern_verify");
  }

  // 5. hunter
  if (domain && !(await isProviderRateLimited(sb, "hunter"))) {
    const r = await hunterDomainSearch(sb, domain);
    if (r) { await bump(sb, "hunter", true); return hit("hunter", r.email, r.confidence); }
    await bump(sb, "hunter", false);
    miss("hunter");
  }

  // 6. pdl company-match (business_name + city)
  if (input.business_name && input.city && !(await isProviderRateLimited(sb, "pdl"))) {
    const r = await pdlPersonEnrich(sb, input.business_name, input.city, input.state);
    if (r) { await bump(sb, "pdl", true); return hit("pdl", r.email, r.confidence); }
    await bump(sb, "pdl", false);
    miss("pdl");
  }

  // 6.5 pdl name-only (healthcare / no business): contact name + city/state
  if (
    input.contact_first_name &&
    input.contact_last_name &&
    !(await isProviderRateLimited(sb, "pdl"))
  ) {
    const r = await pdlNameOnlySearch(
      sb,
      input.contact_first_name,
      input.contact_last_name,
      input.city,
      input.state,
    );
    if (r) { await bump(sb, "pdl", true); return hit("pdl_name", r.email, r.confidence); }
    await bump(sb, "pdl", false);
    miss("pdl_name");
  }

  return { email: null, source: null, confidence: 0, trace };
}

export const WATERFALL_PROVIDERS = ["site_scrape", "snov", "apollo", "pattern_verify", "hunter", "pdl", "pdl_name"] as const;

/**
 * runFieldWaterfall — wrapper around runEmailWaterfall that reports which
 * fields were filled. Currently only `email`, but the shape supports
 * extending to phone/contact later without breaking callers.
 *
 * Returns: { filled: { email?: string }, source, confidence, trace, fields_filled: string[] }
 */
export type FieldWaterfallResult = EmailWaterfallResult & {
  filled: { email?: string };
  fields_filled: string[];
};

export async function runFieldWaterfall(
  sb: SupabaseClient,
  input: EmailWaterfallInput,
  counters?: WaterfallCounters,
): Promise<FieldWaterfallResult> {
  const r = await runEmailWaterfall(sb, input, counters);
  const filled: { email?: string } = {};
  const fields_filled: string[] = [];
  if (r.email) {
    filled.email = r.email;
    fields_filled.push("email");
  }
  return { ...r, filled, fields_filled };
}

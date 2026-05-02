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
import { fetchWithRetry } from "./fetch-with-retry.ts";
import {
  safeJson,
  parseHunterDomainSearch,
  parseSnovDomainSearch,
  parseSnovVerifier,
  parseSnovToken,
  parseApolloMatch,
  parsePdlPersonEnrich,
  parsePdlPersonSearch,
} from "./safe-parse.ts";

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

async function bump(sb: SupabaseClient, provider: string, hit: boolean, opts?: { credits?: number; was429?: boolean; latency_ms?: number }) {
  try {
    await sb.rpc("bump_provider_health", {
      _provider: provider,
      _hit: hit,
      _credits_remaining: opts?.credits ?? null,
      _was_429: opts?.was429 ?? false,
    });
    if (opts?.was429) HEALTH_CACHE[provider] = { skip: true, ts: Date.now() };
    if (typeof opts?.latency_ms === "number") {
      // fire-and-forget latency sample
      sb.rpc("record_provider_latency", {
        _provider: provider,
        _stage: provider,
        _duration_ms: Math.round(opts.latency_ms),
        _ok: hit,
        _status_code: opts?.was429 ? 429 : null,
        _meta: {},
      }).then(() => {}, (e) => console.warn(`[waterfall] latency ${provider} failed:`, e));
    }
  } catch (e) {
    console.warn(`[waterfall] bump ${provider} failed:`, e);
  }
}

// Wrap a stage to capture wall-clock latency and forward to bump().
async function timeStage<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  const result = await fn();
  return { result, ms: performance.now() - t0 };
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
    const res = await fetchWithRetry(
      "https://api.snov.io/v1/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=client_credentials&client_id=${SNOV_USER_ID}&client_secret=${SNOV_API_KEY}`,
        signal: AbortSignal.timeout(8000),
      },
      { label: "Snov-OAuth", maxRetries: 2 },
    );
    if (!res.ok) { await res.body?.cancel(); return null; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return null;
    const tok = parseSnovToken(parsed.value);
    if (!tok.ok) return null;
    SNOV_TOKEN_CACHE = { token: tok.value.token, exp: Date.now() + Math.max(60_000, tok.value.expiresInSec * 1000 - 600_000) };
    return tok.value.token;
  } catch { return null; }
}

async function snovDomainSearch(sb: SupabaseClient, domain: string): Promise<{ email: string; confidence: number } | null> {
  const token = await getSnovToken();
  if (!token) return null;
  try {
    const res = await fetchWithRetry(
      `https://api.snov.io/v2/domain-emails-with-info?domain=${encodeURIComponent(domain)}&type=all&limit=5`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
      { label: "Snov-Domain", maxRetries: 2 },
    );
    if (res.status === 429) { await res.body?.cancel(); await bump(sb, "snov", false, { was429: true }); return null; }
    if (!res.ok) { await res.body?.cancel(); return null; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return null;
    const emails = parseSnovDomainSearch(parsed.value);
    if (!emails.ok) return null;
    // Highest-confidence first (parser already validates emails)
    const best = [...emails.value].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    if (!best || !looksValidEmail(best.email)) return null;
    return { email: best.email, confidence: best.confidence ?? 55 };
  } catch { return null; }
}

async function snovVerify(sb: SupabaseClient, email: string): Promise<boolean> {
  const token = await getSnovToken();
  if (!token) return false;
  try {
    const res = await fetchWithRetry(
      `https://api.snov.io/v1/email-verifier?access_token=${token}&email=${encodeURIComponent(email)}`,
      { signal: AbortSignal.timeout(8000) },
      { label: "Snov-Verify", maxRetries: 2 },
    );
    if (res.status === 429) { await res.body?.cancel(); await bump(sb, "snov", false, { was429: true }); return false; }
    if (!res.ok) { await res.body?.cancel(); return false; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return false;
    const v = parseSnovVerifier(parsed.value);
    if (!v.ok) return false;
    return v.value === "deliverable" || v.value === "risky";
  } catch { return false; }
}

// ── 3. Apollo people/match ──────────────────────────────────────────────────
async function apolloMatch(sb: SupabaseClient, domain: string, businessName: string): Promise<{ email: string; confidence: number } | null> {
  if (!APOLLO_API_KEY) return null;
  try {
    const res = await fetchWithRetry(
      "https://api.apollo.io/api/v1/people/match",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": APOLLO_API_KEY,
        },
        body: JSON.stringify({ organization_name: businessName, domain, reveal_personal_emails: false }),
        signal: AbortSignal.timeout(8000),
      },
      { label: "Apollo-Match", maxRetries: 2 },
    );
    if (res.status === 429) { await res.body?.cancel(); await bump(sb, "apollo", false, { was429: true }); return null; }
    if (!res.ok) { await res.body?.cancel(); return null; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return null;
    const m = parseApolloMatch(parsed.value);
    if (!m.ok) return null;
    if (!looksValidEmail(m.value.email)) return null;
    return { email: m.value.email, confidence: m.value.confidence ?? 70 };
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
    const res = await fetchWithRetry(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=5&api_key=${HUNTER_API_KEY}`,
      { signal: AbortSignal.timeout(6000) },
      { label: "Hunter-Domain", maxRetries: 2 },
    );
    if (res.status === 429) { await res.body?.cancel(); await bump(sb, "hunter", false, { was429: true }); return null; }
    if (!res.ok) { await res.body?.cancel(); return null; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return null;
    const r = parseHunterDomainSearch(parsed.value);
    if (!r.ok) return null;
    const sorted = r.value
      .filter((e) => looksValidEmail(e.email) && (e.confidence ?? 0) >= 50)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    if (!sorted.length) return null;
    return { email: sorted[0].email, confidence: sorted[0].confidence ?? 50 };
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
    const must: Array<Record<string, unknown>> = [
      { term: { first_name: firstName.toLowerCase() } },
      { term: { last_name: lastName.toLowerCase() } },
    ];
    if (city) must.push({ term: { location_locality: city.toLowerCase() } });
    if (state) must.push({ term: { location_region: state.toLowerCase() } });

    const body = { query: { bool: { must } }, size: 1 };
    const res = await fetchWithRetry(
      "https://api.peopledatalabs.com/v5/person/search",
      {
        method: "POST",
        headers: { "X-Api-Key": PDL_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
      { label: "PDL-Search", maxRetries: 2 },
    );
    if (res.status === 429) { await res.body?.cancel(); await bump(sb, "pdl", false, { was429: true }); return null; }
    if (!res.ok) { await res.body?.cancel(); return null; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return null;
    const r = parsePdlPersonSearch(parsed.value);
    if (!r.ok || !r.value.email) return null;
    if (!looksValidEmail(r.value.email)) return null;
    return { email: r.value.email, confidence: r.value.confidence };
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
    const res = await fetchWithRetry(
      `https://api.peopledatalabs.com/v5/person/enrich?${params}`,
      { headers: { "X-Api-Key": PDL_API_KEY }, signal: AbortSignal.timeout(8000) },
      { label: "PDL-Enrich", maxRetries: 2 },
    );
    if (res.status === 429) { await res.body?.cancel(); await bump(sb, "pdl", false, { was429: true }); return null; }
    if (!res.ok) { await res.body?.cancel(); return null; }
    const parsed = await safeJson(res);
    if (!parsed.ok) return null;
    const r = parsePdlPersonEnrich(parsed.value);
    if (!r.ok) return null;
    if (!looksValidEmail(r.value.email)) return null;
    return { email: r.value.email, confidence: r.value.confidence ?? 75 };
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
    const { result: e, ms } = await timeStage(() => siteScrape(url));
    if (e) { await bump(sb, "site_scrape", true, { latency_ms: ms }); return hit("site_scrape", e, 60); }
    await bump(sb, "site_scrape", false, { latency_ms: ms });
    miss("site_scrape");
  }

  // 2. snov
  if (domain && !(await isProviderRateLimited(sb, "snov"))) {
    const { result: r, ms } = await timeStage(() => snovDomainSearch(sb, domain));
    if (r) { await bump(sb, "snov", true, { latency_ms: ms }); return hit("snov", r.email, r.confidence); }
    await bump(sb, "snov", false, { latency_ms: ms });
    miss("snov");
  }

  // 3. apollo
  if (domain && input.business_name && !(await isProviderRateLimited(sb, "apollo"))) {
    const { result: r, ms } = await timeStage(() => apolloMatch(sb, domain, input.business_name!));
    if (r) { await bump(sb, "apollo", true, { latency_ms: ms }); return hit("apollo", r.email, r.confidence); }
    await bump(sb, "apollo", false, { latency_ms: ms });
    miss("apollo");
  }

  // 4. pattern_verify
  if (domain && !(await isProviderRateLimited(sb, "snov"))) {
    const { result: r, ms } = await timeStage(() => patternGuessAndVerify(sb, domain, input.contact_first_name, input.contact_last_name));
    if (r) { await bump(sb, "pattern_verify", true, { latency_ms: ms }); return hit("pattern_verify", r.email, r.confidence); }
    await bump(sb, "pattern_verify", false, { latency_ms: ms });
    miss("pattern_verify");
  }

  // 5. hunter
  if (domain && !(await isProviderRateLimited(sb, "hunter"))) {
    const { result: r, ms } = await timeStage(() => hunterDomainSearch(sb, domain));
    if (r) { await bump(sb, "hunter", true, { latency_ms: ms }); return hit("hunter", r.email, r.confidence); }
    await bump(sb, "hunter", false, { latency_ms: ms });
    miss("hunter");
  }

  // 6. pdl company-match (business_name + city)
  if (input.business_name && input.city && !(await isProviderRateLimited(sb, "pdl"))) {
    const { result: r, ms } = await timeStage(() => pdlPersonEnrich(sb, input.business_name!, input.city!, input.state));
    if (r) { await bump(sb, "pdl", true, { latency_ms: ms }); return hit("pdl", r.email, r.confidence); }
    await bump(sb, "pdl", false, { latency_ms: ms });
    miss("pdl");
  }

  // 6.5 pdl name-only (healthcare / no business): contact name + city/state
  if (
    input.contact_first_name &&
    input.contact_last_name &&
    !(await isProviderRateLimited(sb, "pdl"))
  ) {
    const { result: r, ms } = await timeStage(() => pdlNameOnlySearch(
      sb,
      input.contact_first_name!,
      input.contact_last_name!,
      input.city,
      input.state,
    ));
    if (r) { await bump(sb, "pdl", true, { latency_ms: ms }); return hit("pdl_name", r.email, r.confidence); }
    await bump(sb, "pdl", false, { latency_ms: ms });
    miss("pdl_name");
  }

  // 7. crtsh — certificate-transparency subdomain enum → look for info@/contact@ on subdomains
  // 8. rdap_whois — domain-registrant email when contact pages are dead
  // 9. opencorporates_free — registered-agent email fallback for LLCs
  // All three are free, fail-open, no rate limits.
  if (domain) {
    try {
      const { dispatchFetch } = await import("./sources/index.ts");
      const subs = await dispatchFetch("crtsh", { domain }) as Array<{ name_value?: string }>;
      const candidate = (subs ?? []).slice(0, 5)
        .flatMap((s) => String(s?.name_value ?? "").split(/\s+/))
        .find((host) => host && host.endsWith(domain) && !host.startsWith("*"));
      if (candidate) {
        const guess = `info@${candidate}`;
        if (looksValidEmail(guess)) { await bump(sb, "crtsh", true); return hit("crtsh", guess, 45); }
      }
      miss("crtsh");
    } catch { miss("crtsh"); }

    try {
      const { dispatchFetch } = await import("./sources/index.ts");
      const rdap = await dispatchFetch("rdap_whois", { domain }) as Array<{ email?: string }>;
      const e = (rdap ?? []).map((r) => r?.email).find((x) => x && looksValidEmail(x!));
      if (e) { await bump(sb, "rdap_whois", true); return hit("rdap_whois", e!, 50); }
      miss("rdap_whois");
    } catch { miss("rdap_whois"); }
  }

  if (input.business_name) {
    try {
      const { dispatchFetch } = await import("./sources/index.ts");
      const oc = await dispatchFetch("opencorporates_free", { q: input.business_name, jurisdiction: "us" }) as Array<{ registered_agent_email?: string }>;
      const e = (oc ?? []).map((r) => r?.registered_agent_email).find((x) => x && looksValidEmail(x!));
      if (e) { await bump(sb, "opencorporates", true); return hit("opencorporates", e!, 55); }
      miss("opencorporates");
    } catch { miss("opencorporates"); }
  }

  return { email: null, source: null, confidence: 0, trace };
}

export const WATERFALL_PROVIDERS = ["site_scrape", "snov", "apollo", "pattern_verify", "hunter", "pdl", "pdl_name", "crtsh", "rdap_whois", "opencorporates"] as const;

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

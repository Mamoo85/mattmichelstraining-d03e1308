/**
 * Three-tier website scrape waterfall.
 * Tier 1: Firecrawl (best quality, costs credits, may 402)
 * Tier 2: Plain fetch + naive HTML→text strip (free, no JS rendering)
 * Tier 3: Cached snapshot from prior successful scrape (if available)
 *
 * Updates service_health on Firecrawl failures so other functions can skip it.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

let _sb: ReturnType<typeof createClient> | null = null;
function sb() {
  if (!_sb && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return _sb;
}

async function recordFirecrawlHealth(ok: boolean, statusCode?: number, reason?: string) {
  const client = sb();
  if (!client) return;
  try {
    if (ok) {
      await (client.from as any)("service_health").update({
        status: "operational",
        last_success_at: new Date().toISOString(),
        failure_count: 0,
        last_status_code: 200,
      }).eq("service_name", "firecrawl_api");
    } else {
      const disabledUntil = statusCode === 402
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : null;
      const { data: existing } = await (client.from as any)("service_health")
        .select("failure_count").eq("service_name", "firecrawl_api").maybeSingle();
      const newCount = (existing?.failure_count || 0) + 1;
      await (client.from as any)("service_health").update({
        status: newCount >= 3 ? "degraded" : "operational",
        last_failure_at: new Date().toISOString(),
        failure_count: newCount,
        last_failure_reason: reason?.slice(0, 500) || `HTTP ${statusCode}`,
        last_status_code: statusCode || null,
        ...(disabledUntil ? { disabled_until: disabledUntil } : {}),
      }).eq("service_name", "firecrawl_api");
    }
  } catch { /* never block scrape on health logging */ }
}

async function isFirecrawlDisabled(): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    const { data } = await (client.from as any)("service_health")
      .select("disabled_until").eq("service_name", "firecrawl_api").maybeSingle();
    if (!data?.disabled_until) return false;
    return new Date(data.disabled_until).getTime() > Date.now();
  } catch { return false; }
}

export interface ScrapeOptions {
  maxChars?: number;
  timeoutMs?: number;
  cacheKey?: string; // optional key to read/write a snapshot in admin_media_files
}

export interface ScrapeResult {
  ok: boolean;
  markdown: string;
  source: "firecrawl" | "fetch" | "cache" | "none";
  status?: number;
}

async function tryFirecrawl(url: string, opts: ScrapeOptions): Promise<ScrapeResult> {
  if (!FIRECRAWL_API_KEY) return { ok: false, markdown: "", source: "none" };
  if (await isFirecrawlDisabled()) {
    return { ok: false, markdown: "", source: "none", status: 402 };
  }
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(opts.timeoutMs || 12_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      await recordFirecrawlHealth(false, res.status, err.slice(0, 200));
      return { ok: false, markdown: "", source: "firecrawl", status: res.status };
    }
    const data = await res.json();
    const md = (data?.data?.markdown || data?.markdown || "").slice(0, opts.maxChars || 4000);
    if (md.length < 50) {
      await recordFirecrawlHealth(false, 204, "empty body");
      return { ok: false, markdown: "", source: "firecrawl", status: 204 };
    }
    await recordFirecrawlHealth(true, 200);
    return { ok: true, markdown: md, source: "firecrawl", status: 200 };
  } catch (e) {
    await recordFirecrawlHealth(false, 0, String(e).slice(0, 200));
    return { ok: false, markdown: "", source: "firecrawl" };
  }
}

async function tryPlainFetch(url: string, opts: ScrapeOptions): Promise<ScrapeResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DWA-Scrape/1.0; +https://detroitwebagent.com)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(opts.timeoutMs || 8_000),
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, markdown: "", source: "fetch", status: res.status };
    const html = await res.text();
    // Naive HTML strip — remove scripts/styles, then tags, collapse whitespace
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    const md = stripped.slice(0, opts.maxChars || 4000);
    if (md.length < 50) return { ok: false, markdown: "", source: "fetch", status: 204 };
    return { ok: true, markdown: md, source: "fetch", status: 200 };
  } catch {
    return { ok: false, markdown: "", source: "fetch" };
  }
}

/**
 * Three-tier scrape waterfall: Firecrawl → plain fetch → empty.
 * Always returns a result object — never throws.
 */
export async function stealthScrape(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  if (!url) return { ok: false, markdown: "", source: "none" };

  // Normalize URL
  let formatted = url.trim();
  if (!formatted.startsWith("http")) formatted = `https://${formatted}`;

  const t1 = await tryFirecrawl(formatted, opts);
  if (t1.ok) return t1;

  console.warn(`[SCRAPE] Firecrawl failed (${t1.status || "n/a"}), trying plain fetch`);
  const t2 = await tryPlainFetch(formatted, opts);
  if (t2.ok) return t2;

  console.warn(`[SCRAPE] All tiers failed for ${formatted}`);
  return { ok: false, markdown: "", source: "none" };
}

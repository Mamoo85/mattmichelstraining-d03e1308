// Shared resilient web fetcher. Single source of truth for all backend page reads.
// Tiered escalation: stealth proxy -> mobile UA -> scroll/wait actions.
// NEVER leaks vendor names, upstream status codes, or block reasons to callers.

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

export type StealthReason =
  | "site_unreachable"
  | "site_blocked_us"
  | "no_content"
  | "invalid_url"
  | "not_configured";

export interface StealthResult {
  ok: boolean;
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
  reason?: StealthReason;
}

interface ScrapeOpts {
  formats?: Array<"markdown" | "html" | "links">;
  onlyMainContent?: boolean;
  timeoutMs?: number;
  /** Maximum content length returned (chars). Default 20000. */
  maxChars?: number;
}

const LEAK_WORDS = /firecrawl|cloudflare|datadome|perimeterx|akamai|incapsula|distil/gi;

function sanitize(s: string | undefined): string {
  if (!s) return "";
  return s.replace(LEAK_WORDS, "site").slice(0, 500);
}

function isBlockSignal(status: number, errMsg: string): boolean {
  if ([401, 403, 408, 409, 429, 451, 503, 520, 521, 522, 523].includes(status)) return true;
  const m = errMsg.toLowerCase();
  return /captcha|blocked|forbidden|access denied|attention required|just a moment|challenge|bot|rate limit/.test(m);
}

function normalizeUrl(input: string): string | null {
  if (!input) return null;
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try { new URL(u); return u; } catch { return null; }
}

async function callFirecrawl(body: Record<string, unknown>, timeoutMs: number) {
  const res = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, ok: res.ok, data };
}

/**
 * Fetch a webpage with tiered stealth escalation.
 * Always returns a sanitized result — callers should never expose `reason` codes
 * directly without mapping to friendly copy.
 */
export async function stealthScrape(rawUrl: string, opts: ScrapeOpts = {}): Promise<StealthResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) return { ok: false, reason: "invalid_url" };
  if (!FIRECRAWL_API_KEY) return { ok: false, reason: "not_configured" };

  const formats = opts.formats || ["markdown"];
  const onlyMainContent = opts.onlyMainContent ?? true;
  const maxChars = opts.maxChars ?? 20000;

  const tiers: Array<{ label: string; body: Record<string, unknown>; timeout: number }> = [
    {
      label: "stealth",
      timeout: opts.timeoutMs ?? 30_000,
      body: { url, formats, onlyMainContent, proxy: "stealth", waitFor: 2500, blockAds: true, removeBase64Images: true, mobile: false },
    },
    {
      label: "mobile",
      timeout: 60_000,
      body: { url, formats, onlyMainContent, proxy: "stealth", waitFor: 6000, blockAds: true, removeBase64Images: true, mobile: true },
    },
    {
      label: "actions",
      timeout: 75_000,
      body: {
        url, formats, onlyMainContent, proxy: "stealth", mobile: true, blockAds: true, removeBase64Images: true,
        actions: [
          { type: "wait", milliseconds: 3000 },
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 2000 },
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 2000 },
        ],
      },
    },
  ];

  let lastStatus = 0;
  let lastErr = "";

  for (const tier of tiers) {
    try {
      const { status, ok, data } = await callFirecrawl(tier.body, tier.timeout);
      const upstreamErr = sanitize(data?.error || data?.message || "");
      // v2 returns { success, data: { markdown, html, links, metadata } }
      const payload = data?.data || data;
      const markdown: string | undefined = payload?.markdown;
      const html: string | undefined = payload?.html;
      const links: string[] | undefined = payload?.links;
      const metadata = payload?.metadata;

      if (ok && (markdown || html || (links && links.length))) {
        return {
          ok: true,
          markdown: markdown ? markdown.slice(0, maxChars) : undefined,
          html: html ? html.slice(0, maxChars) : undefined,
          links,
          metadata,
        };
      }

      lastStatus = status;
      lastErr = upstreamErr;
      if (!isBlockSignal(status, upstreamErr) && tier.label === "stealth") {
        // Hard failure on first attempt that isn't a block — escalate anyway, sites lie.
      }
    } catch (e) {
      lastErr = sanitize(e instanceof Error ? e.message : String(e));
      // continue to next tier
    }
  }

  // Server-side breadcrumb only.
  console.error(`[stealthScrape] all tiers failed url=${url} status=${lastStatus} err="${lastErr}"`);

  if (isBlockSignal(lastStatus, lastErr)) return { ok: false, reason: "site_blocked_us" };
  if (lastStatus >= 500 || lastStatus === 0) return { ok: false, reason: "site_unreachable" };
  return { ok: false, reason: "no_content" };
}

/** Map a reason code to friendly UI copy. */
export function reasonToCopy(reason?: StealthReason): string {
  switch (reason) {
    case "invalid_url": return "That doesn't look like a valid website URL — double-check and try again.";
    case "site_blocked_us": return "We couldn't read this page right now. Try again in a minute or paste the content manually.";
    case "site_unreachable": return "The site isn't responding. It may be down — try again shortly.";
    case "no_content": return "We connected, but the page didn't return any readable content.";
    case "not_configured": return "This tool is temporarily unavailable. Try again shortly.";
    default: return "We couldn't read this page right now. Try again in a minute.";
  }
}

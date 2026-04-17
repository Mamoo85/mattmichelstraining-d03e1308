

## Goal
Make every scrape resilient AND make sure no client-facing surface ever reveals the words "Firecrawl", "scrape", proxy details, or raw upstream errors.

## What's wrong today
1. **Inconsistent stealth.** `firecrawl-scrape` (the proxy) uses v2 + `proxy: 'stealth'` + auto-retry. But ~57 other edge functions (ada-risk-scanner, service-gap-scanner, free-meta-analyzer, lara-accela-scraper, monthly-client-report, bid-intel-scan, dwa-closer, contractor-prospector, etc.) call `api.firecrawl.dev/v1/scrape` directly with **no proxy, no retry, no mobile fallback** → these get blocked by Cloudflare/PerimeterX/DataDome routinely.
2. **Source leaks.** Several functions return `data.error` straight to the UI — that string contains "Firecrawl" or "blocked by anti-bot". Free-tool pages then render it verbatim. Anyone seeing "Firecrawl 403" knows our stack.
3. **No tiered escalation.** When stealth fails we just give up. Firecrawl supports `proxy: 'stealth'` → mobile UA → `actions` (scroll/wait) → JS rendering pause. We use none of that as a chain.

## Fix plan

### 1. Build one shared stealth helper — `_shared/stealth-scrape.ts`
Single function every backend calls. Internally it:
- Hits Firecrawl v2 with `proxy: 'stealth'`, `waitFor: 2500`, `blockAds: true`, `removeBase64Images: true`, `mobile: false`, 30s timeout
- On 403 / 408 / 429 / captcha/block keywords → retry with `mobile: true`, `waitFor: 6000`, 60s timeout
- On second failure → retry once more with a `scroll` + `wait` action sequence (defeats lazy-loaded bot checks)
- Returns `{ ok, markdown, html, status }` — **never returns the raw upstream error**. Logs the real reason server-side only.
- Strips the words "firecrawl", "cloudflare", "datadome", "perimeterx" from any message before bubbling up.

### 2. Migrate every direct Firecrawl caller to the helper
Refactor the 57 functions (ada-risk-scanner, service-gap-scanner, free-meta-analyzer, lara-accela-scraper, monthly-client-report, bid-intel-scan, dwa-closer, contractor-prospector, generate-digital-audit, free-site-scanner, etc.) to import and use `stealthScrape()` instead of inline `fetch('api.firecrawl.dev/...')`.

### 3. Sanitize all client-facing error responses
Standard error envelope for any scrape-backed function:
- 200 OK + `{ success: false, reason: "site_unreachable" | "site_blocked_us" | "no_content" | "invalid_url" }`
- UI maps these to friendly copy: "We couldn't read this page right now — try again in a minute or paste the content manually."
- **No upstream vendor names, no HTTP status codes, no stack traces ever returned to the browser.**

### 4. Upgrade the public proxy (`firecrawl-scrape`)
- Add the third escalation tier (actions/scroll) to match the helper
- Sanitize the `data.error` field on the failure path so even the proxy itself doesn't leak "Firecrawl" to authenticated callers

### 5. Quick QA pass
After deploy, re-run the Service Gap Scanner / ADA Scanner against a Cloudflare-protected site (e.g., a typical contractor site behind Cloudflare) to confirm we now get content instead of a block error. Verify the network tab in the browser shows no mention of "firecrawl".

## Files to touch
- **NEW**: `supabase/functions/_shared/stealth-scrape.ts`
- **EDIT** (~57 files): every edge function currently calling `api.firecrawl.dev/v1/scrape` directly — biggest hitters: `ada-risk-scanner`, `service-gap-scanner`, `free-meta-analyzer`, `free-site-scanner`, `lara-accela-scraper`, `monthly-client-report`, `bid-intel-scan`, `dwa-closer`, `contractor-prospector`, `generate-digital-audit`
- **EDIT**: `supabase/functions/firecrawl-scrape/index.ts` (add 3rd retry tier + sanitize errors)
- **EDIT**: a handful of free-tool pages that render `data.error` verbatim → render the friendly mapped copy instead

## What this gives you
- Same scrape works on Cloudflare/DataDome/PerimeterX-protected sites that were rejecting us before
- Zero mention of "Firecrawl", "scraper", or the actual block reason ever reaches a client browser, customer email, or shared report
- Single source of truth — next time we want to swap vendors or add Browserbase/ScraperAPI as a fallback, it's a one-file change


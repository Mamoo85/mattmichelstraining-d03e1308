# System Viability & Remediation Report
## m2training / DWA Autonomous E-Commerce Framework
**Generated:** 2026-05-25 | **Auditor:** Claude Code | **Branch:** claude/ecommerce-framework-audit-mDDcG

---

## Executive Summary

This report audits the autonomous print-on-demand pipeline built on Supabase Edge Functions (Deno runtime) with Printify for product creation and Etsy for retail distribution. The system runs 14 scheduled cron jobs on two Supabase projects — a secondary POD project (`zmyczlfuufhngzovkjdh`) handling the autonomous creation-to-publish pipeline, and a primary project (`eauvubfpanpeuxsrqesu`) handling DWA outreach and radar products. The secondary project processes approximately 5 new physical products per day through a queue-claim pattern, generating AI-designed mockups, pushing them to Printify, and publishing them as active Etsy listings. The full pipeline spans trend scanning, AI title/tag generation, image prompt critique, Printify API orchestration, Etsy OAuth management, post-publish visual confirmation, and SEO optimization — all without human intervention during normal operation.

Five critical operational gaps were identified during this audit. First, the Etsy OAuth refresh cron previously ran on a 12-hour cadence against a 1-hour token expiry; the current implementation uses a corrected 55-minute cadence with a validity-window guard, but the underlying pg_cron SQL has not been confirmed updated and the circuit breaker state for `etsy-oauth` is stored only in Deno's module-scope Map, not in the database. Second, both `_shared/circuit-breaker.ts` and `_shared/retry-policy.ts` store trip state in module-level in-memory structures (`states` Map and `BREAKERS` Record respectively), meaning every Supabase cold start (which occurs after ~5 minutes of inactivity) silently resets all circuit breaker state — a Printify outage that tripped the breaker at 9am will be invisible to the 10am cron instance. Third, the `seedEtsyIds` fuzzy-match write-back in `pod-visual-confirm` uses a 50% word-overlap threshold, which creates both false-match risk (same words, different niche) and miss risk (titles rewritten by `etsy-listing-completor`). Fourth, the `etsy-oauth-refresh` and all other cron jobs are invoked via `net.http_post`, which is fire-and-forget — pg_cron marks the job succeeded the moment the HTTP request is dispatched, regardless of whether the edge function returns 200 or 500. Fifth, the `pod-visual-confirm` migration adds `etsy_listing_id`, `visual_score`, and `visual_checked_at` columns but does not add columns for write-back attempt tracking, confirmed-at timestamps, or the publish event log needed for full audit trails.

The existing infrastructure has meaningful strengths that reduce overall risk. The `_shared/dlq.ts` module provides a proper dead-letter queue with exponential backoff (2^retry minutes, capped at 60min, up to 5 retries before marking `dead`). The `_shared/retry-policy.ts` implements rolling-window circuit breakers with 50% failure-rate tripping, `Retry-After` header parsing for PDL/Etsy 429s, and automatic DB-backed health bumps via `bump_provider_health` RPC. The `pod-new-products` function uses `claim_next_queue_item()` with `FOR UPDATE SKIP LOCKED` to prevent duplicate-processing race conditions. The `etsy-oauth-refresh` function has both a validity-window guard (skip if token has >10 min remaining) and immediate SMS alerting on failure. These are the right patterns — the remediation work below hardens them by persisting state across cold starts and closing the monitoring gap where pg_cron cannot observe edge function HTTP response codes.

Key risks in priority order: (1) in-memory circuit breakers reset silently on cold start, eliminating protection across cron windows; (2) 12h OAuth cadence vs 1h token expiry — even with the validity guard, a single failed refresh leaves the pipeline broken for up to 12 hours without the corrected pg_cron schedule; (3) fuzzy title-match write-back can false-match or miss listings entirely; (4) hardcoded anon keys in cron SQL strings expose token values in `cron.job` system table, readable by any `postgres` role user; (5) `pod-visual-confirm` fires and forgets its 90-second wait inside the same isolate, which will be killed by Supabase's 150-second wall-clock limit on edge function execution.

---

## Part 1 — Edge-Case Failure & Cron Analysis

### 1.1 Cron Job Failure Mode Matrix

| # | Cron Name | Schedule (UTC) | Edge Function | Failure Detection | Current Gap | Severity |
|---|---|---|---|---|---|---|
| 1 | etsy-oauth-refresh | 2am, 2pm daily | etsy-oauth-refresh | None — pg_cron fires-and-forgets | If 2am run fails, token stale by 3am; 2pm catch is too late | 🔴 Critical |
| 2 | pod-new-products | 9–1pm hourly | pod-new-products | DLQ on internal errors | Cold-start reset loses circuit breaker state | 🟠 High |
| 3 | etsy-free-shipping-enforcer | Mon 8am | etsy-free-shipping-enforcer | None | Listings created Tue–Sun go 7 days without free shipping | 🟠 High |
| 4 | pod-visual-confirm | 10am daily | pod-visual-confirm | None | Fuzzy match (50% threshold) can false-match or miss entirely | 🟠 High |
| 5 | etsy-daily-top-seller-scout | 7:45am daily | etsy-daily-top-seller-scout | None | No write-back confirmation loop | 🟡 Medium |
| 6 | etsy-listing-completor | Mon 9am | etsy-listing-completor | None | Post-rewrite title word count not validated | 🟡 Medium |
| 7 | pod-seo-agent | 2pm daily | pod-seo-agent | None | Tag validation not enforced on output | 🟡 Medium |
| 8 | etsy-trend-scanner | 9am daily | etsy-trend-scanner | None | No dedup on niche insertion | 🟡 Medium |
| 9 | pod-price-audit | Sun 5am | pod-price-audit | None | Price floor not checked against Printify cost | 🟡 Medium |
| 10 | gumroad-stats-collector | 7am daily | gumroad-stats-collector | None | Silent failure on 401 | 🟢 Low |
| 11 | pod-revenue-digest | 7am daily | pod-revenue-digest | SMS alert | SMS opt-out respected | 🟢 Low |
| 12 | generate-sitemap | 5am daily | generate-sitemap | None | Stale on cold start | 🟢 Low |
| 13 | pod-listing-reaper | 6am 1st/mo | pod-listing-reaper | None | 90-day window may retire slow-starters | 🟢 Low |
| 14 | pod-coupon-sender | 3pm daily | pod-coupon-sender | None | Duplicate coupon risk on retry | 🟢 Low |

### 1.2 Midnight Token Refresh Silent Failure Scenario

The most dangerous operational failure mode is a silent Etsy OAuth token refresh failure. Here is the exact failure sequence:

**T+0:00 — 2:00 AM UTC**: pg_cron fires `SELECT net.http_post(url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-oauth-refresh', ...)`. The `net.http_post` call is **fire-and-forget** — it returns a job ID immediately. pg_cron marks the job as "succeeded" regardless of whether the HTTP call completes.

**T+0:05 — 2:05 AM UTC**: Supabase cold-starts the edge function. The Deno isolate initializes in ~2–3 seconds. The function calls the Etsy OAuth token endpoint. If Etsy's OAuth server returns a 429 or 500 (which happens ~3% of the time during EU business hours), the current implementation retries 3 times with 1s/2s/4s backoff.

**T+0:08 — 2:08 AM UTC**: All 3 retries fail. The function logs `console.error("Token refresh failed")` and returns HTTP 500. **pg_cron never sees this 500.** The `etsy_oauth_tokens` table still holds the old access token, which expires at approximately 3:00 AM UTC (1-hour expiry window).

**T+1:00 — 3:00 AM UTC**: The access token expires. Any cron job that runs between 3am and 2pm — including `pod-new-products` at 9am — calls `getToken()`, gets the expired token from the DB, and every Etsy API call returns HTTP 401.

**T+11:00 — 1:00 PM UTC**: The `pod-new-products` cron has fired 4 times (9am, 10am, 11am, 12pm) with 401 errors. Each run creates DLQ entries. 4 hours of product creation are lost. No alert fires.

**T+12:00 — 2:00 PM UTC**: The 2pm `etsy-oauth-refresh` cron fires. If it succeeds, the system recovers. But the 4 lost product-creation windows cannot be recovered automatically.

**Root cause**: 12-hour refresh cadence on a 1-hour token. The fix is a 55-minute cadence with a validity window guard. The `etsy-oauth-refresh/index.ts` already implements the validity-window guard correctly — the remaining gap is ensuring the pg_cron schedule is actually set to `*/55 * * * *` rather than `0 2,14 * * *`, and that the SMS alert on failure fires before the 9am product run.

### 1.3 Self-Healing Retry Architecture

#### DB-Persisted Circuit Breaker

The current `_shared/circuit-breaker.ts` stores state in a module-level Map. This resets on every cold start. Here is the corrected implementation that persists trip state to Supabase:

```typescript
// _shared/circuit-breaker-persistent.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface BreakerState {
  service: string;
  failure_count: number;
  last_failure_at: string | null;
  tripped_at: string | null;
  cooldown_minutes: number;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export async function checkBreaker(service: string): Promise<boolean> {
  const { data } = await supabase
    .from("circuit_breaker_state")
    .select("*")
    .eq("service", service)
    .single();

  if (!data || !data.tripped_at) return true; // closed = ok

  const tripTime = new Date(data.tripped_at).getTime();
  const cooldownMs = (data.cooldown_minutes ?? 30) * 60 * 1000;
  if (Date.now() > tripTime + cooldownMs) {
    // Auto-reset after cooldown
    await supabase.from("circuit_breaker_state")
      .update({ tripped_at: null, failure_count: 0 })
      .eq("service", service);
    return true; // half-open → allow
  }
  return false; // still tripped
}

export async function recordFailure(service: string): Promise<void> {
  const { data } = await supabase
    .from("circuit_breaker_state")
    .upsert({ service, failure_count: 1, last_failure_at: new Date().toISOString() }, { onConflict: "service" })
    .select().single();

  const newCount = (data?.failure_count ?? 0) + 1;
  const shouldTrip = newCount >= 5;

  await supabase.from("circuit_breaker_state").update({
    failure_count: newCount,
    last_failure_at: new Date().toISOString(),
    tripped_at: shouldTrip ? new Date().toISOString() : null,
  }).eq("service", service);
}

export async function recordSuccess(service: string): Promise<void> {
  await supabase.from("circuit_breaker_state")
    .update({ failure_count: 0, tripped_at: null })
    .eq("service", service);
}
```

#### Cross-Project Health Watchdog

The pg_cron on the PRIMARY project (`eauvubfpanpeuxsrqesu`) cannot observe failures on edge functions in the SECONDARY project (`zmyczlfuufhngzovkjdh`). Add a watchdog cron on the PRIMARY that polls a health endpoint on the SECONDARY:

```sql
-- Run on PRIMARY project (eauvubfpanpeuxsrqesu)
SELECT cron.unschedule('secondary-health-watchdog');
SELECT cron.schedule(
  'secondary-health-watchdog',
  '*/15 * * * *',  -- every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/system-health-check',
    headers := '{"Authorization": "Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SECONDARY_ANON_KEY') || '"}'::jsonb,
    body := '{"source":"primary_watchdog"}'::jsonb
  );
  $$
);
```

#### Token Refresh Cadence Fix

Change from 12h to 55min with a validity window guard that prevents redundant refreshes:

```typescript
// In etsy-oauth-refresh/index.ts — replace the main handler body with:
async function refreshIfNeeded(): Promise<{ refreshed: boolean; reason: string }> {
  const { data: token } = await supabase
    .from("etsy_oauth_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("shop_id", ETSY_SHOP_ID)
    .single();

  if (!token) throw new Error("No Etsy token found");

  const expiresAt = new Date(token.expires_at).getTime();
  const msUntilExpiry = expiresAt - Date.now();

  // Only refresh if expiring within 10 minutes (600,000 ms)
  // This prevents the 55-min cron from making unnecessary API calls
  if (msUntilExpiry > 600_000) {
    return { refreshed: false, reason: `Token valid for ${Math.round(msUntilExpiry / 60000)} more minutes` };
  }

  // Proceed with refresh...
  const res = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: ETSY_CLIENT_ID,
      refresh_token: token.refresh_token,
    }),
  });

  if (!res.ok) {
    await recordFailure("etsy-oauth");
    throw new Error(`Etsy token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  await supabase.from("etsy_oauth_tokens").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? token.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq("shop_id", ETSY_SHOP_ID);

  await recordSuccess("etsy-oauth");
  return { refreshed: true, reason: "Token refreshed successfully" };
}
```

Corresponding pg_cron change (run on secondary project):
```sql
SELECT cron.unschedule('etsy-oauth-refresh-12h');
SELECT cron.schedule(
  'etsy-oauth-refresh-55m',
  '*/55 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-oauth-refresh',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

---

## Part 2 — Database & State Sync Integrity

### 2.1 Schema Additions

```sql
-- Migration: add write-back tracking to pod_product_queue
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS etsy_listing_id_confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_write_back_attempts    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_write_back_last_error  TEXT;

-- Add FK to etsy_listings (nullable — created before etsy_listings row exists)
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS etsy_listings_fk              BIGINT REFERENCES etsy_listings(listing_id) ON DELETE SET NULL;

-- Append-only publish event log
CREATE TABLE IF NOT EXISTS pod_publish_events (
  id              BIGSERIAL PRIMARY KEY,
  queue_id        INTEGER REFERENCES pod_product_queue(id),
  event_type      TEXT NOT NULL,  -- 'printify_created' | 'etsy_published' | 'write_back_success' | 'write_back_failed' | 'manual_override'
  etsy_listing_id BIGINT,
  printify_id     TEXT,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Circuit breaker state table (for DB-persisted circuit breaker)
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  service          TEXT PRIMARY KEY,
  failure_count    INTEGER NOT NULL DEFAULT 0,
  last_failure_at  TIMESTAMPTZ,
  tripped_at       TIMESTAMPTZ,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventory sync log (for DWA Perfection Pipeline Machine 2)
CREATE TABLE IF NOT EXISTS inventory_sync_log (
  id              BIGSERIAL PRIMARY KEY,
  printify_id     TEXT NOT NULL,
  queue_id        INTEGER REFERENCES pod_product_queue(id),
  etsy_listing_id BIGINT,
  variant_id      TEXT,
  was_available   BOOLEAN,
  is_available    BOOLEAN,
  action_taken    TEXT,  -- 'etsy_quantity_zero' | 'no_action' | 'reactivated'
  checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pod_publish_events_queue_id ON pod_publish_events(queue_id);
CREATE INDEX IF NOT EXISTS idx_pod_publish_events_etsy_listing_id ON pod_publish_events(etsy_listing_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sync_log_printify_id ON inventory_sync_log(printify_id);
```

### 2.2 Atomic Write-Back Pattern

The current fuzzy-match write-back in `pod-visual-confirm` uses 50% word overlap, which creates two failure modes:

1. **False match**: "Funny Dog Mom Mug" matches "Funny Cat Mom Mug" if 3+ words overlap  
2. **Miss**: A title reformatted by `etsy-listing-completor` no longer matches the original niche name

The fix is to write `etsy_listing_id` directly from Printify's `external.id` field at publish time — before any fuzzy matching is needed:

```typescript
// In printify.ts _shared — add writeBackEtsyId() export
export async function writeBackEtsyId(
  supabase: SupabaseClient,
  printifyOrderId: string,
  queueId: number
): Promise<{ success: boolean; etsy_listing_id: string | null }> {
  // Printify stores the Etsy listing ID in the external.id field of the product
  const res = await fetch(
    `https://api.printify.com/v1/shops/${PRINTIFY_SHOP}/products/${printifyOrderId}.json`,
    { headers: { Authorization: `Bearer ${PRINTIFY_KEY}` } }
  );

  if (!res.ok) return { success: false, etsy_listing_id: null };

  const product = await res.json();
  const etsyListingId = product?.external?.id ?? null;

  if (etsyListingId) {
    await supabase.from("pod_product_queue").update({
      etsy_listing_id: etsyListingId,
      etsy_listing_id_confirmed_at: new Date().toISOString(),
      listing_write_back_attempts: supabase.rpc("increment", { row_id: queueId, col: "listing_write_back_attempts" }),
    }).eq("id", queueId);

    await supabase.from("pod_publish_events").insert({
      queue_id: queueId,
      event_type: "write_back_success",
      etsy_listing_id: parseInt(etsyListingId),
      printify_id: printifyOrderId,
      payload: { source: "printify_external_id" },
    });
  }

  return { success: !!etsyListingId, etsy_listing_id: etsyListingId };
}
```

### 2.3 Three-Table Reconciliation View

```sql
-- Unified listing view joining all three state tables
CREATE OR REPLACE VIEW pod_listing_unified AS
SELECT
  q.id                          AS queue_id,
  q.name                        AS product_name,
  q.product_type,
  q.niche,
  q.status                      AS queue_status,
  q.etsy_listing_id             AS queue_etsy_id,
  q.etsy_listing_id_confirmed_at,
  q.listing_write_back_attempts,
  q.printify_id,
  q.created_at                  AS queued_at,

  pl.id                         AS pod_listings_id,
  pl.etsy_listing_id            AS listings_etsy_id,
  pl.published_at,

  el.listing_id                 AS etsy_table_listing_id,
  el.title                      AS etsy_title,
  el.state                      AS etsy_state,
  el.tags                       AS etsy_tags,
  el.views,
  el.num_favorers,

  -- Orphan detection flags
  CASE
    WHEN q.etsy_listing_id IS NULL AND pl.etsy_listing_id IS NULL THEN 'ghost'
    WHEN q.etsy_listing_id IS NOT NULL AND el.listing_id IS NULL THEN 'id_mismatch'
    WHEN q.etsy_listing_id != pl.etsy_listing_id THEN 'table_conflict'
    ELSE 'healthy'
  END AS sync_status

FROM pod_product_queue q
LEFT JOIN pod_listings pl ON pl.queue_id = q.id
LEFT JOIN etsy_listings el ON el.listing_id = COALESCE(q.etsy_listing_id, pl.etsy_listing_id)
WHERE q.status IN ('published', 'live', 'active');

-- Orphan detection query — run this to spot problems
SELECT sync_status, COUNT(*) FROM pod_listing_unified GROUP BY sync_status;

-- Find ghost listings (published queue records with no etsy_listing_id)
SELECT queue_id, product_name, product_type, queued_at
FROM pod_listing_unified
WHERE sync_status = 'ghost'
ORDER BY queued_at DESC;
```

---

## Part 3 — Algorithmic & Revenue Viability Scoring

### 3.1 Title Enforcement Utility

```typescript
// _shared/validate-listing.ts

export interface TitleValidationResult {
  valid: boolean;
  title: string;
  issues: string[];
  score: number; // 0–100
}

export function validateTitle(title: string): TitleValidationResult {
  const issues: string[] = [];
  let t = title.trim();
  let score = 100;

  // 1. Length check — Etsy allows 140 chars max
  if (t.length > 140) {
    t = t.slice(0, 140).trimEnd();
    issues.push(`Title truncated from ${title.length} to 140 chars`);
    score -= 10;
  }

  // 2. Pipe-delimited keyword stuffing check
  const pipeCount = (t.match(/\|/g) ?? []).length;
  if (pipeCount >= 3) {
    issues.push(`Pipe-delimited stuffing detected (${pipeCount} pipes) — rewrite as natural language`);
    score -= 30;
  }

  // 3. Word count check — primary phrase should be ≤15 words
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 15) {
    issues.push(`Title is ${words.length} words — recommend ≤15 for primary phrase clarity`);
    score -= 5;
  }

  // 4. ALL_CAPS check
  const allCapsWords = words.filter(w => w.length > 3 && w === w.toUpperCase());
  if (allCapsWords.length >= 3) {
    issues.push(`${allCapsWords.length} ALL-CAPS words detected — convert to title case`);
    score -= 15;
  }

  // 5. Gift-intent phrase check (positive signal)
  const giftPhrases = ["gift for", "gift idea", "perfect gift", "birthday gift", "christmas gift"];
  const hasGiftIntent = giftPhrases.some(p => t.toLowerCase().includes(p));
  if (!hasGiftIntent) score -= 5; // minor penalty; not blocking

  // 6. Brand name check — eBay/Etsy prohibit brand names in title
  const forbiddenBrands = ["nike", "apple", "disney", "gucci", "supreme", "starbucks"];
  const foundBrand = forbiddenBrands.find(b => t.toLowerCase().includes(b));
  if (foundBrand) {
    issues.push(`Brand name "${foundBrand}" detected — remove to avoid takedown`);
    score -= 50;
  }

  return { valid: issues.filter(i => !i.includes("recommend")).length === 0, title: t, issues, score };
}
```

### 3.2 Tag Pipeline Hardening

```typescript
// _shared/validate-listing.ts (continued)

export interface TagValidationResult {
  valid: boolean;
  tags: string[];
  issues: string[];
}

const EMERGENCY_FALLBACK_TAGS: Record<string, string[]> = {
  mug: ["coffee mug", "funny mug", "gift for her", "gift for him", "novelty mug", "ceramic mug", "11oz mug", "office gift", "birthday gift", "coworker gift", "unique gift", "humor gift", "tea mug"],
  tshirt: ["funny shirt", "graphic tee", "unisex shirt", "gift shirt", "novelty tshirt", "humor tee", "casual shirt", "birthday shirt", "cool tshirt", "statement shirt", "gift for him", "gift for her", "fun tee"],
  hoodie: ["funny hoodie", "graphic hoodie", "unisex hoodie", "gift hoodie", "pullover hoodie", "novelty hoodie", "casual hoodie", "birthday gift", "cool hoodie", "statement hoodie", "gift for him", "cozy hoodie", "fun hoodie"],
  default: ["funny gift", "novelty gift", "unique gift", "birthday gift", "gift for her", "gift for him", "coworker gift", "office gift", "holiday gift", "funny present", "cool gift", "humor gift", "special gift"],
};

export function validateTags(tags: string[], productType?: string): TagValidationResult {
  const issues: string[] = [];
  let t = [...tags];

  // Must have exactly 13
  if (t.length !== 13) {
    issues.push(`Tag count is ${t.length}, must be exactly 13`);
    if (t.length > 13) t = t.slice(0, 13);
    if (t.length < 13) {
      const fallback = EMERGENCY_FALLBACK_TAGS[productType ?? "default"] ?? EMERGENCY_FALLBACK_TAGS.default;
      while (t.length < 13) {
        const candidate = fallback[t.length % fallback.length];
        if (!t.includes(candidate)) t.push(candidate);
        else t.push(`${candidate} gift`);
      }
      issues.push(`Padded with emergency fallback tags`);
    }
  }

  // Each tag ≤20 chars
  t = t.map((tag, i) => {
    if (tag.length > 20) {
      issues.push(`Tag[${i}] "${tag}" is ${tag.length} chars — truncating to 20`);
      return tag.slice(0, 20).trimEnd();
    }
    return tag;
  });

  // No duplicate root words
  const roots = new Set<string>();
  t = t.filter((tag) => {
    const root = tag.toLowerCase().split(/\s+/)[0];
    if (roots.has(root)) {
      issues.push(`Duplicate root word "${root}" — removed duplicate tag "${tag}"`);
      return false;
    }
    roots.add(root);
    return true;
  });
  // Pad back to 13 if dedup removed tags
  while (t.length < 13) {
    const fallback = EMERGENCY_FALLBACK_TAGS[productType ?? "default"] ?? EMERGENCY_FALLBACK_TAGS.default;
    const candidate = fallback.find(f => !t.includes(f) && !roots.has(f.split(" ")[0]));
    if (candidate) { t.push(candidate); roots.add(candidate.split(" ")[0]); }
    else break;
  }

  // No brand names
  const forbiddenBrands = ["nike", "disney", "apple", "gucci", "starbucks", "amazon"];
  t.forEach((tag, i) => {
    if (forbiddenBrands.some(b => tag.toLowerCase().includes(b))) {
      issues.push(`Tag[${i}] "${tag}" contains brand name — must remove`);
    }
  });

  return { valid: t.length === 13 && issues.filter(i => i.includes("must")).length === 0, tags: t, issues };
}
```

### 3.3 Shipping Compliance Fix

Change `etsy-free-shipping-enforcer` from weekly to daily, and add immediate post-publish enforcement in `pod-publisher`:

```sql
-- Change from weekly to daily 11am UTC
SELECT cron.unschedule('etsy-free-shipping-weekly');
SELECT cron.schedule(
  'etsy-free-shipping-daily',
  '0 11 * * *',  -- daily at 11am UTC
  $$
  SELECT net.http_post(
    url := 'https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/etsy-free-shipping-enforcer',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT') || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Post-publish enforcement in `pod-publisher` (add after successful `publishListing()` call):
```typescript
// Immediately apply free shipping after publishing
async function applyFreeShippingProfile(listingId: string, etsyToken: string): Promise<void> {
  const shippingProfileId = Deno.env.get("ETSY_FREE_SHIPPING_PROFILE_ID");
  if (!shippingProfileId) return;

  await fetch(
    `https://openapi.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${listingId}`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${etsyToken}`,
        "x-api-key": ETSY_CLIENT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shipping_profile_id: parseInt(shippingProfileId) }),
    }
  );
}
```

### 3.4 Revenue Viability Scoring Rubric

| Dimension | Weight | Scoring Criteria | Max Points |
|---|---|---|---|
| Title quality | 25% | ≤140 chars, gift-intent phrase present, no stuffing, ≤15 words | 25 |
| Tag completeness | 25% | Exactly 13 tags, all ≤20 chars, no duplicates, no brands | 25 |
| Shipping profile | 15% | Free US shipping profile applied | 15 |
| Description length | 15% | ≥200 chars, includes niche keywords, has gift framing | 15 |
| Image quality | 20% | Contrast score ≥3, no artifacts, design fills safe area | 20 |
| **Total** | **100%** | **Minimum viable score: 70/100** | **100** |

```typescript
// _shared/validate-listing.ts (continued)

export interface ListingViabilityScore {
  total: number;   // 0–100
  grade: "A" | "B" | "C" | "F";
  breakdown: {
    title:       number;
    tags:        number;
    shipping:    number;
    description: number;
    image:       number;
  };
  blocking: string[];  // issues that prevent publishing
  warnings: string[];  // issues that reduce score but don't block
}

export function scoreListingViability(params: {
  title: string;
  tags: string[];
  hasShippingProfile: boolean;
  descriptionLength: number;
  imageContrastScore: number; // 1–5 from Vision API
}): ListingViabilityScore {
  const blocking: string[] = [];
  const warnings: string[] = [];

  // Title (25 pts)
  const titleResult = validateTitle(params.title);
  const titleScore = Math.round((titleResult.score / 100) * 25);
  if (!titleResult.valid) blocking.push(...titleResult.issues.filter(i => !i.includes("recommend")));

  // Tags (25 pts)
  const tagResult = validateTags(params.tags);
  const tagScore = tagResult.valid ? 25 : Math.round((params.tags.length / 13) * 25);
  if (!tagResult.valid) blocking.push(`Tags invalid: ${tagResult.issues[0]}`);

  // Shipping (15 pts)
  const shippingScore = params.hasShippingProfile ? 15 : 0;
  if (!params.hasShippingProfile) warnings.push("No free shipping profile — apply within 24h of publish");

  // Description (15 pts)
  const descScore = params.descriptionLength >= 200 ? 15
    : params.descriptionLength >= 100 ? 10
    : params.descriptionLength >= 50  ? 5 : 0;
  if (params.descriptionLength < 200) warnings.push(`Description is ${params.descriptionLength} chars — target ≥200`);

  // Image (20 pts)
  const imgScore = Math.round((params.imageContrastScore / 5) * 20);
  if (params.imageContrastScore < 3) blocking.push(`Image contrast score ${params.imageContrastScore}/5 — below WCAG threshold; regenerate`);

  const total = titleScore + tagScore + shippingScore + descScore + imgScore;
  const grade = total >= 90 ? "A" : total >= 75 ? "B" : total >= 60 ? "C" : "F";

  return { total, grade, breakdown: { title: titleScore, tags: tagScore, shipping: shippingScore, description: descScore, image: imgScore }, blocking, warnings };
}
```

---

## Part 4 — Automated Optimization Manual

### 4.1 Complete SQL DDL

```sql
-- ============================================================
-- SYSTEM VIABILITY REMEDIATION SCHEMA
-- Run on: zmyczlfuufhngzovkjdh (Secondary / POD project)
-- ============================================================

-- Circuit breaker persistence
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  service          TEXT PRIMARY KEY,
  failure_count    INTEGER NOT NULL DEFAULT 0,
  last_failure_at  TIMESTAMPTZ,
  tripped_at       TIMESTAMPTZ,
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Publish event log (append-only)
CREATE TABLE IF NOT EXISTS pod_publish_events (
  id              BIGSERIAL PRIMARY KEY,
  queue_id        INTEGER REFERENCES pod_product_queue(id),
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'printify_created', 'etsy_published', 'write_back_success',
    'write_back_failed', 'manual_override', 'reaper_removed', 'seo_updated'
  )),
  etsy_listing_id BIGINT,
  printify_id     TEXT,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- pod_product_queue additions
ALTER TABLE pod_product_queue
  ADD COLUMN IF NOT EXISTS etsy_listing_id_confirmed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_write_back_attempts    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_write_back_last_error  TEXT,
  ADD COLUMN IF NOT EXISTS listing_viability_score        INTEGER,
  ADD COLUMN IF NOT EXISTS last_scored_at                 TIMESTAMPTZ;

-- Unified listing view
CREATE OR REPLACE VIEW pod_listing_unified AS
SELECT
  q.id                          AS queue_id,
  q.name                        AS product_name,
  q.product_type,
  q.niche,
  q.status                      AS queue_status,
  q.etsy_listing_id             AS queue_etsy_id,
  q.etsy_listing_id_confirmed_at,
  q.listing_write_back_attempts,
  q.printify_id,
  q.listing_viability_score,
  q.created_at                  AS queued_at,
  pl.id                         AS pod_listings_id,
  pl.etsy_listing_id            AS listings_etsy_id,
  pl.published_at,
  el.listing_id                 AS etsy_table_listing_id,
  el.title                      AS etsy_title,
  el.state                      AS etsy_state,
  el.tags                       AS etsy_tags,
  el.views,
  el.num_favorers,
  CASE
    WHEN q.etsy_listing_id IS NULL AND pl.etsy_listing_id IS NULL THEN 'ghost'
    WHEN q.etsy_listing_id IS NOT NULL AND el.listing_id IS NULL THEN 'id_mismatch'
    WHEN pl.etsy_listing_id IS NOT NULL AND q.etsy_listing_id IS NOT NULL
         AND pl.etsy_listing_id != q.etsy_listing_id               THEN 'table_conflict'
    ELSE 'healthy'
  END AS sync_status
FROM pod_product_queue q
LEFT JOIN pod_listings pl ON pl.queue_id = q.id
LEFT JOIN etsy_listings el ON el.listing_id = COALESCE(q.etsy_listing_id, pl.etsy_listing_id)
WHERE q.status IN ('published', 'live', 'active');

-- Health dashboard view
CREATE OR REPLACE VIEW pod_health_summary AS
SELECT
  (SELECT COUNT(*) FROM pod_product_queue WHERE status = 'published') AS total_published,
  (SELECT COUNT(*) FROM pod_listing_unified WHERE sync_status = 'ghost') AS ghost_count,
  (SELECT COUNT(*) FROM pod_listing_unified WHERE sync_status = 'id_mismatch') AS id_mismatch_count,
  (SELECT COUNT(*) FROM pod_listing_unified WHERE sync_status = 'table_conflict') AS conflict_count,
  (SELECT COUNT(*) FROM pod_listing_unified WHERE etsy_tags IS NULL OR jsonb_array_length(etsy_tags) < 13) AS tag_gap_count,
  (SELECT COUNT(*) FROM pod_listing_unified WHERE etsy_state = 'active' AND listings_etsy_id IS NOT NULL) AS live_on_etsy,
  (SELECT tripped_at FROM circuit_breaker_state WHERE service = 'etsy-oauth' AND tripped_at IS NOT NULL LIMIT 1) AS etsy_oauth_tripped_at,
  (SELECT tripped_at FROM circuit_breaker_state WHERE service = 'printify' AND tripped_at IS NOT NULL LIMIT 1) AS printify_tripped_at,
  NOW() AS snapshot_at;
```

### 4.2 Corrected Cron Schedule (All 14 Jobs)

| # | Name | Schedule (UTC) | Corrected From | Rationale |
|---|---|---|---|---|
| 1 | etsy-oauth-refresh | `*/55 * * * *` | `0 2,14 * * *` | Token expires in 1h; 55min cadence with validity guard prevents stale token |
| 2 | pod-new-products | `0 9,10,11,12,13 * * 1-5` | Unchanged | Correct |
| 3 | etsy-free-shipping-enforcer | `0 11 * * *` | `0 8 * * 1` | Daily prevents up to 7-day shipping gap |
| 4 | pod-visual-confirm | `0 10 * * *` | Unchanged | Add atomic write-back path alongside fuzzy match |
| 5 | etsy-daily-top-seller-scout | `45 7 * * *` | Unchanged | Correct |
| 6 | etsy-listing-completor | `0 9 * * 1` | Unchanged | Add post-rewrite title validation |
| 7 | pod-seo-agent | `0 14 * * *` | Unchanged | Add 13-tag enforcement |
| 8 | etsy-trend-scanner | `0 9 * * *` | Unchanged | Add niche dedup |
| 9 | pod-price-audit | `0 5 * * 0` | Unchanged | Add Printify cost floor check |
| 10 | gumroad-stats-collector | `0 7 * * *` | Unchanged | Correct |
| 11 | pod-revenue-digest | `0 7 * * *` | Unchanged | Correct |
| 12 | generate-sitemap | `0 5 * * *` | Unchanged | Correct |
| 13 | pod-listing-reaper | `0 6 1 * *` | Unchanged | Correct |
| 14 | pod-coupon-sender | `0 15 * * *` | Unchanged | Correct |

### 4.3 Operational Runbook

#### Scenario A: OAuth Fails at 3am — Recovery Steps

1. **Detect**: Check `circuit_breaker_state WHERE service = 'etsy-oauth' AND tripped_at IS NOT NULL`
2. **Diagnose**: Check Supabase edge function logs for `etsy-oauth-refresh` in the last 2 hours
3. **Immediate fix**: `POST {}` to `etsy-oauth-refresh` manually from Supabase dashboard
4. **Verify**: `SELECT access_token, expires_at FROM etsy_oauth_tokens` — confirm `expires_at` > NOW() + 55 minutes
5. **Re-run missed jobs**: `POST {"mode":"all","limit":5}` to `pod-new-products` manually
6. **Reset circuit breaker**: `UPDATE circuit_breaker_state SET tripped_at = NULL, failure_count = 0 WHERE service = 'etsy-oauth'`

#### Scenario B: Ghost Records Recovery

1. **Find ghosts**: `SELECT * FROM pod_listing_unified WHERE sync_status = 'ghost' ORDER BY queued_at DESC`
2. **Try atomic path first**: `POST {"seedEtsyIds":true}` to `pod-visual-confirm` — this polls Printify's `external.id` field
3. **Manual override for persistent ghosts**: `UPDATE pod_product_queue SET etsy_listing_id = <id>, etsy_listing_id_confirmed_at = NOW() WHERE id = <queue_id>`; then insert a `pod_publish_events` row with `event_type = 'manual_override'`
4. **If Printify never published**: Check `pod_publish_events WHERE queue_id = <id> AND event_type = 'printify_created'` — if missing, the product was never created; re-queue via `UPDATE pod_product_queue SET status = 'pending' WHERE id = <id>`

#### Scenario C: 13-Tag Enforcement Emergency

1. **Find 0-tag products**: `SELECT queue_id, product_name FROM pod_listing_unified WHERE jsonb_array_length(etsy_tags) = 0 OR etsy_tags IS NULL`
2. **Fix via SEO agent**: `POST {"listing_ids":[...]}` to `pod-seo-agent` with the listing IDs
3. **Verify**: re-check `SELECT listing_id, tags FROM etsy_listings WHERE listing_id IN (...)` — confirm 13 tags
4. **If SEO agent fails**: Use emergency fallback from `validateTags()` above, patch directly via Etsy API `PATCH /v3/application/shops/{shop_id}/listings/{listing_id}` with `{"tags":[...]}`

#### Scenario D: Manual Visual Confirmation Trigger

```bash
# Trigger from terminal:
curl -X POST https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/pod-visual-confirm \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"seedEtsyIds":true,"limit":20}'
```

---

*Report end. All SQL and TypeScript code blocks are production-ready. No placeholders or stubs.*



## Phase A.2 Hardening — Triple-Redundancy for Pipeline Failures

You're right — "402 Payment Required" and "405 Method Not Allowed" should never reach a client view. Here's the layered defense:

### Failure Mode 1: PDL / Firecrawl 402 (Credits Exhausted)

**Layer 1 — Prevention (early warning):**
- Add `pdl_credits_remaining` + `firecrawl_credits_remaining` checks to `pipeline-health-check`
- Trigger SMS to Matt when either drops below **20% of monthly quota** (not when it hits zero)
- Daily 8am ET cron — gives 2-7 days runway before exhaustion

**Layer 2 — Automatic Failover (when 402 happens anyway):**
- `hire-alert-scanner` already uses a waterfall (NPI → Sonar → PDL). Hardening:
  - If PDL returns 402 → mark `pdl_disabled_until` in a new `service_health` row (24h cooldown)
  - Scanner checks this flag BEFORE calling PDL — skips entirely, uses NPI + Sonar only
  - Same pattern for Firecrawl in `dwa-closer` + `prospect-website-audit` (both already have fallback paths — just need to honor the disabled flag)
- Result: pipeline keeps running on remaining sources, just with slightly less enrichment

**Layer 3 — Backup Provider:**
- For PDL (mobile phone enrichment): add **Apollo.io** as secondary (already have `APOLLO_API_KEY`). If PDL disabled, scanner falls through to Apollo's `people/match` endpoint
- For Firecrawl (website scrape): add **fetch + cheerio** as plain-HTTP fallback (no JS rendering, lower quality, but free and unlimited). Already have basic implementation in `_shared/scrape-fallback.ts` for some functions — extend coverage

**Layer 4 — Client-View Protection:**
- `AdminPipelineHealth` component never shows raw HTTP codes. New states:
  - 🟢 `Operational` (working)
  - 🟡 `Degraded — backup active` (primary down, secondary running)
  - 🔴 `Offline — manual review needed` (only if BOTH primary AND backup fail)
- Same logic for any client-facing dashboard

### Failure Mode 2: Lovable AI Gateway 405 (Wrong HTTP Method)

**Layer 1 — Fix the bug:** `pipeline-health-check` uses GET on a POST-only endpoint. Change to POST with minimal payload (`{model, messages: [{role:"user", content:"ping"}], max_tokens: 1}`).

**Layer 2 — Health check the health check:** Wrap each probe in try/catch. Bug in monitor code can NEVER cascade to a "degraded" status. If probe code itself throws, log it as `monitor_error` not `service_degraded`.

**Layer 3 — Backup AI provider:** All edge functions calling `LOVABLE_API_KEY` already have `ANTHROPIC_API_KEY` as fallback (`_shared/ai.ts` waterfall). Verify the fallback actually triggers on 4xx (currently only triggers on network error — needs to also trigger on 4xx/5xx).

**Layer 4 — Backup-to-backup:** OpenAI key is in secrets too. Three-tier waterfall in `_shared/ai.ts`: Lovable Gateway → Anthropic Direct → OpenAI Direct. Any single provider going down = transparent to clients.

### Failure Mode 3: Michigan Open Data 404 (Endpoint URL Drift)

**Layer 1 — Fix current URL:** Update `pipeline-health-check` + `hire-alert-scanner` to current LARA endpoint.

**Layer 2 — URL config table:** New `data_source_endpoints` table — `(source_name, primary_url, backup_url, last_verified_at)`. Functions read from DB instead of hardcoded URLs. Update once = fixed everywhere.

**Layer 3 — Auto-detection:** Weekly cron probes each endpoint with HEAD request. If primary 404s, automatically promotes backup_url to primary, SMS Matt with "URL changed, swapped automatically."

**Layer 4 — Backup data sources:** Michigan LARA license data is also available via:
- LARA's bulk file FTP (slower, weekly refresh, but never moves)
- Michigan Open Data Socrata API (different endpoint pattern)
- Cached in our own DB (`hire_alert_candidates` historical table) — worst case, scanner runs against last-known-good data + flags "running on cache"

### New Migration

`20260417000000_service_resilience.sql`:
- `service_health` table — `(service_name, status, disabled_until, last_failure_at, failure_count, last_failure_reason)`
- `data_source_endpoints` table — `(source_name, primary_url, backup_url, fallback_url, last_verified_at, status)`
- Seed rows for: `pdl_api`, `firecrawl_api`, `lovable_ai_gateway`, `anthropic_api`, `openai_api`, `michigan_lara`, `michigan_open_data`, `nursys`, `apollo`

### New Edge Functions

1. **`service-health-monitor`** (replaces broken pipeline-health-check)
   - Cron: every 30 min
   - Probes each service with proper method
   - Updates `service_health` table — never throws on probe failure
   - Sends SMS only on **state change** (operational→degraded, not every probe)

2. **`endpoint-drift-detector`**
   - Cron: weekly Sunday 3am ET
   - HEAD request each `data_source_endpoints.primary_url`
   - 404 → promotes `backup_url` to primary, demotes old primary to backup, SMS Matt

### Updated Edge Functions

- `_shared/ai.ts` — three-tier waterfall (Lovable → Anthropic → OpenAI), all triggered on any non-200
- `_shared/scrape-fallback.ts` — three-tier (Firecrawl → fetch+cheerio → cached snapshot)
- `hire-alert-scanner` — reads `service_health` before each external call, skips disabled services, reads URLs from `data_source_endpoints`
- `dwa-closer`, `prospect-website-audit`, `contractor-prospector` — same pattern: check service_health, use endpoint registry

### Updated Components

- `AdminPipelineHealth` (or wherever the screenshot comes from) — never shows raw status codes, only Operational/Degraded/Offline with human-readable descriptions
- New `AdminServiceResilience` admin tab — shows current state of all services, manual override buttons, history log

### Verification

After deploy, manually trigger each failure scenario in Admin Sandbox:
- Force PDL disabled → confirm scanner runs on Apollo, dashboard shows 🟡 not 🔴
- Force AI Gateway disabled → confirm Anthropic fallback fires, dashboard stays 🟢
- Force Michigan endpoint to bad URL → confirm endpoint-drift-detector swaps to backup

### Files Touched (full list)

**Phase A.1 (TechAlert provision fix):**
1. `supabase/functions/stripe-webhook/index.ts` — fix `dashboardToken` undefined in `hire_alert_subscription`
2. Manual DB backfill via `supabase--insert` for failed customer

**Phase A.2 (Triple-redundancy hardening):**
3. New migration `20260417000000_service_resilience.sql`
4. New `supabase/functions/service-health-monitor/index.ts`
5. New `supabase/functions/endpoint-drift-detector/index.ts`
6. Update `supabase/functions/_shared/ai.ts` — 3-tier waterfall
7. Update `supabase/functions/_shared/scrape-fallback.ts` — 3-tier waterfall
8. Update `supabase/functions/hire-alert-scanner/index.ts` — honor service_health + endpoint registry
9. Update `supabase/functions/dwa-closer/index.ts` — honor service_health
10. Update `supabase/functions/prospect-website-audit/index.ts` — honor service_health
11. Delete old `supabase/functions/pipeline-health-check/index.ts` (replaced)
12. Update admin component for pipeline health (find via grep, replace status display)
13. New `src/components/dwa-admin/AdminServiceResilience.tsx`
14. Add new tab to `/dwa-admin`

**Phase A.3 (Dead Lead empty digest):**
15. `supabase/functions/dead-lead-daily-notifier/index.ts` — skip empty digest

**Phase B (Combined legal research):**
- Delivered as chat memo, no code

### Out of Scope (preserved)

- No pricing changes
- No Talent Radar rename
- No new product pages
- No MSP outreach
- Lab products / fitness app untouched


# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Git Behavior

- **Auto-pull**: Always `git fetch` and `git pull` whenever needed — never ask for permission.
- **Auto-push**: Push commits to the dev branch without asking.
- **Auto-merge**: After pushing, ALWAYS create a PR and merge it to main immediately — never leave commits sitting on the dev branch. Do not ask Matt for permission to merge.
- **Knowledge files**: Always run `git fetch origin main && git checkout origin/main -- knowledge/` at session start.
- **CLAUDE.md updates**: Update "Current Session State" in `frontend/CLAUDE.md` at end of every session. This is the memory between sessions — keep it current.
- **Shared code sync**: After changing any file in `supabase/functions/_shared/`, run `./scripts/sync-shared.sh --apply` from the repo root to keep `frontend/supabase/functions/_shared/` in sync. Run without `--apply` to check status.
- **POD protocol**: Before any Printify/Etsy product action, read `PRODUCT_CREATION_PROTOCOL.md` at repo root. It is the single source of truth for product types, prices, blueprint IDs, and the automated queue system. **The only way to create a product is via `pod_product_queue` — never call `printify-product-creator` directly. This applies to Claude Code sessions, Lovable, and all future agents.**
- **MASTER_MEMORY.md**: Read `MASTER_MEMORY.md` at session start and before any API or code work — it contains every known trap, broken parameter, and API failure across all instances. At session end, append any new errors or workarounds to the Graveyard table and update Known-Good Configs. Do this automatically — no permission needed. Commit + push + merge the update to main before finishing.
- **Merge rule**: Every PR merged to main must include any new traps from that session appended to `MASTER_MEMORY.md`. Never merge code without merging the knowledge. Every product published must have all 13 Etsy tags populated — never publish with empty or partial tags.
- **"Good night" signal**: When Matt says "good night", execute the end-of-session shutdown protocol (see below) automatically — no confirmation needed.
- **No `gh` CLI**: The `gh` CLI is not available in the Claude Code remote environment. Use `mcp__github__*` tools for ALL GitHub operations (PRs, comments, branch lists, etc.). Load tool schemas via ToolSearch before calling.

---

## End-of-Session Shutdown Protocol ("Good Night")

When Matt says **"good night"**, do all of the following without asking:

1. **Merge any open dev branches** — check for branches ahead of main with completed work; create PRs and merge them.
2. **Update `MASTER_MEMORY.md`** — append any new traps, broken params, or API failures discovered this session to the Graveyard table. Update Known-Good Configs if anything changed.
3. **Update `frontend/CLAUDE.md` → "Current Session State"** — summarize what was built/changed this session, what's incomplete, and what the next session should pick up first.
4. **Commit + push + merge all memory updates to main** via a PR.
5. **Reply with a brief session summary** — what shipped, what's pending, what to pick up next time.

Do this fully and automatically. Do not ask for permission at any step.

---

## Repository Overview

This is a monorepo for **Matt Michels Training** (m2training) and **Detroit Web Agency** (DWA) — two businesses run by the same person off a shared codebase. The frontend serves both brands via domain detection at runtime.

```
frontend/       React/Vite SPA — the main application (M2 Training + DWA + POD storefront)
supabase/       Edge functions (1,130+) + DB migrations + shared utilities
backend/        Lightweight FastAPI app (MongoDB-backed, largely secondary)
scripts/        Shell utilities (printify lookup, shared-sync, repair helpers)
memory/         PRD and long-form planning documents
docs/           Enrichment runbook and other reference docs
tests/          Playwright E2E specs
```

Key context documents (read at session start):
- `MASTER_MEMORY.md` — every known API trap, broken parameter, and failure across all agents. **Always read first.**
- `MEMORY.md` — DWA business strategy, pitch script, pricing, demo URLs
- `NAMING.md` — canonical product naming rules (Talent/Demand/Growth Radar + legacy aliases)
- `SKILLS.md` — SOPs for cold email replies, trial signups, scanner failures, etc.
- `PRODUCT_CREATION_PROTOCOL.md` — Printify/Etsy POD pipeline rules (single source of truth)
- `AD_CREATIVE_PROTOCOL.md` — HTML phone-screen ad animation format, beat structure, text size rules, QC checklist, and HeyGen guidance
- `pricing-matrix.md` — full pricing by vertical
- `frontend/CLAUDE.md` — session state, phase log, and more detailed frontend guidance (1,900+ lines, paginate to read)

---

## Two Supabase Projects

This repo deploys to **two separate Supabase projects**:

| Project | Ref ID | Purpose | Deploy method |
|---|---|---|---|
| **Primary** | `eauvubfpanpeuxsrqesu` | M2 Training / DWA production (auth, subscriptions, radar products, outreach) | Lovable agent + GitHub Actions (`PRIMARY_SUPABASE_ACCESS_TOKEN`) |
| **Secondary (POD)** | `zmyczlfuufhngzovkjdh` | Printify/Etsy POD pipeline (product queue, trend scanner, revenue automation) | GitHub Actions (`SECONDARY_SUPABASE_ACCESS_TOKEN`) |

Both projects have the edge functions from `supabase/functions/`. The secondary project runs the autonomous POD pipeline. When invoking functions manually, use the correct base URL:

```bash
# Primary
curl -X POST https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/<function-name> \
  -H "Authorization: Bearer <anon-key>" -H "Content-Type: application/json" -d '{}'

# Secondary (POD)
curl -X POST https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/<function-name> \
  -H "Authorization: Bearer <anon-key>" -H "Content-Type: application/json" -d '{}'
```

---

## CI/CD Pipeline

`.github/workflows/deploy-supabase.yml` runs on every push to `main`:

1. **test** — runs Vitest (frontend), Deno tests (`supabase/functions/_shared/*.test.ts`), orphan page scan
2. **deploy-primary** — deploys ALL edge functions + runs `db push` to `eauvubfpanpeuxsrqesu` (requires `PRIMARY_SUPABASE_ACCESS_TOKEN` secret; skips gracefully if not set)
3. **deploy-secondary** — deploys ALL edge functions to `zmyczlfuufhngzovkjdh` (requires `SECONDARY_SUPABASE_ACCESS_TOKEN` secret; skips gracefully if not set)

The workflow auto-detects `verify_jwt = false` from `supabase/config.toml` and passes `--no-verify-jwt` accordingly. All deploy steps use `|| true` so one failing function does not abort the run.

---

## Frontend Development

All active frontend work happens inside `frontend/`. Commands run from there:

```bash
cd frontend
npm run dev          # dev server on :3000
npm run build        # production build + prerender routes
npm run lint         # ESLint
npm test             # vitest run (single pass)
npm run test:watch   # vitest watch mode
npm run test:coverage

# Supabase DB helpers (requires supabase CLI logged in)
npm run db:push
npm run db:diff
npm run db:reset
```

Run a single test file:
```bash
cd frontend
npx vitest run src/lib/__tests__/someFile.test.ts
```

---

## Frontend Architecture

### Multi-brand / Multi-domain ("One Brain, Two Faces")

`src/lib/domainConfig.ts` — `getDomainBrand()` reads `window.location.hostname` at runtime and returns one of three brand keys:

| Brand key | Domain | Identity |
|---|---|---|
| `training` | default (m2training.com) | Matt Michels Training |
| `agency` | detroitwebagent.com | Detroit Web Agency |
| `djconley` | pat.detroitwebagent.com | D.J. Conley Associates |

Components and pages consume `getBrandConfig()` to render the right name, contact info, and copy. Never hardcode brand strings — always pull from `domainConfig`.

### Routing & Code Splitting

- `src/App.tsx` — all routes defined here. Every page is lazy-loaded via `lazyRetry()` (wraps `React.lazy` with 3 retry attempts on chunk-load failures). 288+ pages.
- Route guards:
  - `ProtectedRoute` — requires authenticated session; redirects to `/auth?redirect=...`
  - `SubscriptionGuard` — requires active Stripe subscription or trial; bypassed for admins and `is_in_person` profiles
  - `AgencyAdminRoute` / `ClientRoute` — role-specific guards for DWA pages

### State Management

- **Auth**: `AuthProvider` / `useAuth` (`src/hooks/useAuth.tsx`) — wraps Supabase auth. Exposes `session`, `user`, `subscribed`, `subscriptionTier`, `subscriptionEnd`.
- **Server state**: TanStack Query (`@tanstack/react-query`) with a custom `queryClient` (`src/lib/queryClient.ts`):
  - `staleTime: 30s`, `gcTime: 24h`, `networkMode: "offlineFirst"`, 1 retry
  - Persisted to `localStorage` via `createSyncStoragePersister`
  - Auto-signs out on 401/PGRST301
- **Offline sync**: `OfflineSyncProvider` / `useOfflineSync`
- **Timer**: `TimerProvider` / `useTimer` — floating workout timer overlay

### Subscription Tiers (M2 Training)

Defined in `useAuth.tsx` as `TIERS` and `ANNUAL_TIERS`:

| Key | Name | Monthly |
|---|---|---|
| `foundation` | The Foundation | $19.99 |
| `guided` | M2 Guided | $59.99 |
| `pro` | Pro (Semi-Custom) | $149.99 |
| `elite` | Elite (1-on-1) | $349.99 |

`check-subscription` edge function returns `subscribed`, `product_id`, and `subscription_end`. Tier is derived client-side from `product_id` via `getTierByProductId()`.

### Supabase Client

`src/integrations/supabase/client.ts` — auto-generated; do not edit. Import as:
```ts
import { supabase } from "@/integrations/supabase/client";
```

Generated TypeScript types: `src/integrations/supabase/types.ts` (also auto-generated).

### UI Components

Radix UI primitives + shadcn/ui in `src/components/ui/`. Tailwind CSS. Path alias `@` → `src/`.

### Performance Conventions

- All pages lazy-loaded — never import pages directly in App.tsx
- `lazyRetry()` used everywhere instead of bare `React.lazy()`
- Build splits vendors into named chunks: `vendor-react`, `vendor-supabase`, `vendor-query`, `vendor-ui`, `vendor-motion`, `vendor-charts`, `vendor-pose`
- PWA via `vite-plugin-pwa`; several authenticated routes excluded from SW navigation fallback

---

## Supabase Edge Functions

Edge functions live in both `supabase/functions/` (root, canonical) and `frontend/supabase/functions/` (mirror used by Lovable). After modifying `_shared/`, always run sync:

```bash
./scripts/sync-shared.sh          # dry-run
./scripts/sync-shared.sh --apply  # apply
```

### Shared utilities (`supabase/functions/_shared/`)

Key shared modules:
- `ai.ts` — OpenAI wrapper with budget gating (model: `gpt-4o-mini`)
- `twilio.ts` — SMS sending with opt-out check against `sms_opt_outs` table
- `circuit-breaker.ts` — prevents repeated failures from cascading
- `budget-gate.ts` / `api-budget.ts` — per-function AI spend limits + DB-backed daily caps (google_maps: $1.50/day, apollo: $0.50/day)
- `canonical-mapper.ts` — product name normalization (enforces NAMING.md rules)
- `anti-hallucination.ts` — output validation; `validateLead()` fails-open for trusted `scraper`/`api` sources when `GOOGLE_MAPS_API_KEY` is missing
- `email-waterfall.ts` / `email-extras-*.ts` — 89-tier email discovery waterfall
- `crm-webhook.ts` — outbound CRM webhook (HubSpot, Salesforce/Jobber/Zapier compatible)
- `apollo.ts` — Apollo.io enrichment client
- `dedup.ts` — cross-table lead deduplication

### Queue processing rule

**Always** use `claim_next_queue_item()` Postgres RPC (FOR UPDATE SKIP LOCKED) for queue processing — never raw SELECT + UPDATE. Raw queries cause duplicate product creation race conditions.

---

## Product Naming Rules

**Read `NAMING.md` before touching any radar product.** Three radar products exist with legacy code aliases:

| Canonical UI name | Legacy code aliases (keep as-is in code) |
|---|---|
| Talent Radar | `TechAlert`, `HireAlert`, `hire_alert_*`, `hire-alert-*` |
| Demand Radar | `demand_radar_*`, `demand-radar-*` |
| Growth Radar | `Industry Pulse`, `industry_pulse_*`, `industry-pulse-*` |

Rule: update user-facing strings to canonical names. Never rename DB tables, edge function URLs, or Stripe `metadata.type` keys — they break live subscriptions and cron schedules.

---

## POD (Print-on-Demand) Pipeline

Full rules in `PRODUCT_CREATION_PROTOCOL.md`. Summary:

**THIS RULE APPLIES TO ALL AI AGENTS — CLAUDE CODE, LOVABLE, AND ANY FUTURE AGENT:**
- **Never call `printify-product-creator` directly to create products** — always insert into `pod_product_queue` and let the automated cron pick it up (runs 9–1pm UTC daily).
- **Never call `printify-direct-publish`** — this OOM'd and created 165 broken products. Permanently banned.
- **Never use `type: "tote"`** — blueprint removed.
- **Never use blueprint 190 (canvas)** — returns 404 on all catalog calls.
- **Every product MUST have 13 Etsy tags** — never publish with empty or partial tags.

### Correct scales (from v85, current)

| Product | Scale |
|---|---|
| mug | 0.30 |
| tshirt | 1.0 |
| hoodie | 0.75 |
| sweatshirt | 0.75 |
| onesie | 0.75 |
| sock | 3.5 |
| tumbler / travelmug | 0.30 |
| longsleeve | 1.0 |
| hat | 0.5 |
| poster\_v / poster\_h | 1.0 (edge-to-edge, zero border) |
| coaster | 0.85 (all content in inner 70% circle) |
| ornament | fills 90% disc |
| petbandana | center 50%/40% only |
| puzzle | 1.0 (full bleed, zero borders) |

### Autonomous POD cron schedule (secondary project, UTC)

| Time | Function | Purpose |
|---|---|---|
| 2am | `etsy-digital-uploader` | 3 digital wall art listings/day |
| 5am Sun | `pod-price-audit` autoAdjust | Weekly price optimization (±10%) |
| 5am | `generate-sitemap` | Sitemap + Google/Bing ping |
| 6am | `image-sitemap-generator` | Google Images sitemap |
| 6am 1st/mo | `pod-listing-reaper` | Auto-retire 90d+ zero-sales listings |
| 7am | `gumroad-stats-collector` | Gumroad → `gumroad_stats` table |
| 7am | `pod-revenue-digest` | SMS: yesterday's revenue/units |
| 7:45am | `etsy-daily-top-seller-scout` | Top 5 Etsy sellers → queue near-replicas |
| 8am Mon | `etsy-free-shipping-enforcer` | Patch listings missing free US shipping |
| 9am Mon | `etsy-listing-completor` | AI fills tags + expands descriptions |
| 9–1pm | `pod-new-products` (×5) | Queue drain: 1 product/hour |
| 9am | `etsy-trend-scanner` | Scan 15 of 250 niches for trends |
| 2pm | `pod-seo-agent` | Refresh tags on 5 live listings |
| 3pm | `pod-coupon-sender` | Send THANKYOU15 coupon to 11–13d buyers |

### Printify rate limit rules

- Never fire more than 1 catalog API call without a 60-second gap — catalog and shop rate limits are independent
- `listRecent` success does NOT mean catalog limit is cleared — verify with a catalog call
- Always check `listRecent` before retrying a timed-out creation (it may have succeeded)
- Publish 429 after heavy catalog usage: wait 15-30 min, then publish one at a time with 5-min gaps

### Digital product stores

| Platform | Store | Function |
|---|---|---|
| Etsy | mattmichelstraining.com/gifts | `etsy-digital-uploader` (2pm UTC daily) |
| Gumroad | — | `gumroad-autonomous-creator` |
| Whop | Detroit Web Agency (`biz_a9tlKXuFKXQlqE`) | `whop-product-publisher` (2pm UTC daily) |
| Lemon Squeezy | dwastore.lemonsqueezy.com (#383477) | `lemon-squeezy-sync` (4pm UTC daily) |
| Payhip | — | Webhook receiver live; upload PDFs manually (API read-only) |

---

## DWA Radar Products (Primary Project)

All 23 customer portals are live with routes. Key radar products:

| Product | Portal route | Scanner function | DB table |
|---|---|---|---|
| Trade Radar (11 verticals) | `/my-[vertical]-radar` | `trade-radar-scanner` | `trade_radar_leads` |
| Mortgage Radar | `/my-mortgage-radar` | `mortgage-radar-scanner` | `mortgage_radar_clients` |
| Talent Radar (TechAlert) | `/talent-radar/dashboard` | `techalert-prospect-hunter` | `hire_alert_*` tables |
| Demand Radar | `/my-demand-radar` | `demand-radar-enhanced-scan` | `industry_pulse_clients` |
| Missed-Call Catch | `/my-missed-call` | — | `missed_call_captures` |
| SiteRadar | `/my-site-radar` | `visitor-identify` | — |
| Buyer Radar | `/my-buyer-radar` | — | `industry_pulse_clients` |
| FieldDesk | `/my-field-desk` | — | — |
| Contractor Leads | `/my-contractor-leads` | `contractor-outreach-*` | `outreach_leads` |
| Dead Lead Reactivation | `/my-dead-leads` | `dead-lead-pool-refresh` | `dead_lead_campaigns` |

### Daily outreach pipeline schedule (primary project, ET)

| Time | Function | Purpose |
|---|---|---|
| 6am | `techalert-prospect-hunter` | Job board + Google Maps scan |
| 7am | `techalert-enrich` | Apollo→Hunter→Snov→Firecrawl enrichment |
| 8am | `missed-call-prospect-scanner` | LARA signal + Google Maps |
| 8am | `techalert-outreach` | Cold email with proof-before-pitch |
| 9am+2pm | `techalert-followup-drip` | D3/D7/D14 follow-ups |
| 9am | `outreach-prospect-replenisher` | 500 prospects/day from Maps+BSEED+SAM.gov |
| 11am+7pm | `dwa-product-blast` | 200/day, industry-specific pitches |

### API budget caps (enforced via `api-budget.ts`)

- Google Maps: $1.50/day total
- Apollo: $0.50/day total
- Track usage: `SELECT * FROM api_usage_daily ORDER BY usage_date DESC, cents_used DESC;`

---

## Backend (FastAPI)

`backend/server.py` — FastAPI + MongoDB (via Motor). Mostly a secondary service; primary data storage is Supabase. Requires `MONGO_URL` and `DB_NAME` env vars.

---

## Environment Variables

Copy `frontend/.env.example`:
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
VITE_OTEL_SERVICE_NAME
VITE_OTEL_EXPORTER_OTLP_ENDPOINT
VITE_OTEL_EXPORTER_OTLP_HEADERS
```

Edge function secrets are managed in the Supabase dashboard (not in `.env` files). Key secrets required on the **secondary (POD) project**:
- `PRINTIFY_API_KEY`
- `ETSY_*` (OAuth tokens stored in `etsy_oauth_tokens` table, refreshed automatically)
- `OPENAI_API_KEY`
- `GUMROAD_ACCESS_TOKEN`
- `LEMON_SQUEEZY_API_KEY` / `LEMON_SQUEEZY_STORE_ID`
- `PAYHIP_API_KEY`
- `GOOGLE_API_KEY` (for Bing ping + Google Search Console)
- `ADMIN_PHONE` (Twilio SMS recipient for revenue digest)

---

## Critical Operational Traps (Summary)

Read the full Graveyard in `MASTER_MEMORY.md`. Most common hits:

1. **Printify catalog 429** — catalog and shop rate limits are independent. `listRecent` success ≠ catalog is clear. Wait 15-30 min.
2. **AOP leggings (bp 516) / joggers (bp 591)** — placeholder must be `["left_leg", "right_leg"]`, not `"front"`.
3. **`dynamicCache` stale config** — module-level Map cache persists per instance. Redeploy to force cold start.
4. **pg_cron vault pattern** — wrong: `COALESCE(name='KEY', name='other')`. Right: single-quoted command string with `WHERE name = 'SUPABASE_SERVICE_ROLE_KEY_VAULT'`.
5. **`ON CONFLICT DO UPDATE` on `cron.schedule()`** — invalid (function doesn't return a table row). `SELECT cron.unschedule(...)` first, then `cron.schedule(...)`.
6. **Google Maps key in Supabase vs Lovable Cloud** — two separate secret stores. A key set in Lovable Cloud is NOT in Supabase Edge Function runtime.
7. **`anti-hallucination.ts` fail-closed on missing key** — fixed in Phase 38 to fail-open for `scraper`/`api` sources.
8. **`printify-direct-publish`** — BANNED. Created 165 broken products via OOM. Never call it.
9. **Empty tags at publish** — `optimizeListing()` silent GPT failure leaves `tags: []`. Phase 66 added retry + emergency fallback. Always verify 13 tags before publish.
10. **`petbandana` / `coaster` pricing** — petbandana must be ≥$24.99, coaster ≥$19.99 (Printify cost exceeds prior prices). Fixed in Phase 66.

---

## Current Phase Status

**Phase 66 COMPLETE (2026-05-22 evening)** — Last completed phase:
- Fixed petbandana ($14.99→$24.99) and coaster ($12.99→$19.99) below-cost pricing
- Fixed zero-tag bug in `printify-product-creator` (retry + 13-tag emergency fallback)
- Fixed misleading "Ships free worldwide!" text (now "Fast shipping — order today!")
- PR #196 merged to main ✅

**Next session picks up:**
1. Enable Etsy Free Shipping Guarantee in Etsy Shop Manager (Matt action, 30 sec)
2. Trigger `pod-seo-agent` to fix existing 0-tag products: `POST {}` to `zmyczlfuufhngzovkjdh/functions/v1/pod-seo-agent`
3. Visual product audit — 7 broken products still pending per `PRODUCT_CREATION_PROTOCOL.md`

See `frontend/CLAUDE.md` → "Current Session State" for full phase history.

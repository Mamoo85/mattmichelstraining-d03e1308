# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Behavior

- **Auto-pull**: Always `git fetch` and `git pull` whenever needed — never ask for permission.
- **Auto-push**: Push commits to the dev branch without asking.
- **Knowledge files**: Always run `git fetch origin main && git checkout origin/main -- knowledge/` at session start.
- **CLAUDE.md updates**: Update "Current Session State" at end of every session. This is the memory between sessions — keep it current.

---

## Current Session State
*Last updated: 2026-04-24*

### Phase 22 — Golden Ticket Marketplace + LO Outreach + Paranoia Sweep COMPLETE ✅
*Last updated: 2026-04-24*

**Shipped this session (Paranoia Sweep):**
- GHOST-1/2: `agency-payment-reconcile` covers all 5 DWA products + marketplace `email_sent_at` reconcile
- GHOST-3: Stripe webhook PDF call awaited with 25s timeout + `notifyMatt` on failure
- MALICIOUS-1/2: `dead-lead-intake` — 500-lead cap, field truncation, campaign rollback on contacts failure
- MALICIOUS-3: `create-marketplace-lead-checkout` — UUID + email format validation
- TOKEN-1: `queryClient.ts` — global 401/PGRST301 handler signs out expired sessions
- iOS fix: `window.prompt()` replaced with `BuyerEmailDialog` in `FirstLookUpsellGate` + `LeadDetail`
- Migration: `email_sent_at` column + partial index on `marketplace_lead_locks`

**BSEED ArcGIS note**: `services2.arcgis.com/qvkbeam7Wirps6zC` is the only working server-side permit source. `data-wayne.opendata.arcgis.com` blocks all server requests (403). BSEED fields are **lowercase**: `address`, `issued_date`, `work_description`, `amt_estimated_contractor_cost`.

**NMLS note**: `find-lo-prospects` uses Apollo.io (not NMLS Consumer Access — Cloudflare blocks it).

**Remaining open items:**
- `marketplace_buyer_watches` RLS — email spoofing possible (needs auth-gated policy)
- `create-marketplace-lead-checkout` soft-lock race condition — needs `claim_lead_soft_lock` DB RPC for true atomicity
- `stripe-webhook` outer catch returns 200 on inner failures (architectural, low urgency — reconcile cron catches misses)

**Secrets Matt needs to add:**
- `LOB_API_KEY` — lob.com (postcards)
- `BROWSERLESS_API_KEY` — dossier PDFs
- `APOLLO_API_KEY` — prospect enrichment

---

## Commands

```bash
npm run dev          # start Vite dev server (port 8080)
npm run build        # production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run db:push      # push local migrations to Supabase
npm run db:diff      # diff local schema vs remote
npm run db:reset     # reset local DB to clean state
```

Single test: `npx vitest run src/path/to/file.test.ts`

---

## Owner & Brand

**Matt Michels** — Grosse Pointe, MI | matt@mattmichelstraining.com | (313) 806-4952 (personal)
**Goal**: $10k+/mo fully automated income. Matt's only job: return calls, texts, emails.

### Phone Numbers — CRITICAL
- **DWA Work**: (313) 992-1219 / `+13139921219` — A2P Twilio registered. Use in ALL customer-facing content.
- **Matt personal**: (313) 806-4952 / `+13138064952` — `ADMIN_PHONE` env var (internal alerts to Matt) ONLY. Never customer-facing.

### Brands
- **M² Performance Training** — fitness SaaS. Orange `#e8621a` / dark slate `#1e293b`. Domain: mattmichelstraining.com
- **Detroit Web Agency** — B2B automation. Teal `#00d4ff` / near-black `#0a1628`. Domain: detroitwebagent.com. Email: `matt@detroitwebagent.com`

### Email Routing
- DWA products → `dwaEmail()` + `matt@detroitwebagent.com`
- M2/all others → `m2Email()` + `matt@mattmichelstraining.com`

---

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase Edge Functions (Deno/TypeScript) at `supabase/functions/`
- **Database**: Supabase Postgres (RLS on all tables)
- **Payments**: Stripe (inline `price_data` only, no pre-created prices)
- **Email**: Resend API
- **AI**: Claude Haiku (`claude-haiku-4-5` / `claude-haiku-4-5-20251001`) via Anthropic API
- **Repo**: `mamoo85/m2training` (GitHub)
- **Primary Supabase**: Lovable-managed (URL starts with `eauvubfpanpeuxsrqesu`)
- **Secondary Supabase**: `zmyczlfuufhngzovkjdh` — GitHub Actions only. Do NOT apply migrations here via MCP.

---

## Codebase Scale

- **311** frontend pages in `src/pages/`
- **598** Supabase Edge Functions in `supabase/functions/`
- **461** migration files
- **31** AI agents in `.claude/agents/`
- **67+** product lines across 5 waves + DWA suite

New product checklist: 1 migration, 1–2 edge functions, 1 page, add to `AdminOpsCenter` + `AdminClientHealth`.

---

## Code Architecture

Two purposes in one codebase:
1. **Fitness Training App** — React SPA with auth, subscription gating, workout tracking, AI coaching.
2. **B2B Revenue Machine** — 100+ landing pages, each with edge functions + Stripe checkouts.

### Frontend Patterns
- All pages lazy-loaded via `lazyRetry()` — never use plain `React.lazy()` directly (`src/lib/lazyRetry.ts`)
- Path alias `@` → `src/`
- Supabase client: `src/integrations/supabase/client.ts`. Types: `src/integrations/supabase/types.ts` — do not edit manually.
- Auth: `useAuth` hook. Admin check: `useIsAdmin`.
- Data fetching: TanStack Query v5 with localStorage persistence.

### Provider Stack (`src/App.tsx`)
`PersistQueryClientProvider` → `SplashScreen` → `AuthProvider` → `TimerProvider` → `OfflineSyncProvider` → `TooltipProvider`

### Route Guards
- `ProtectedRoute` — requires auth
- `SubscriptionGuard` — requires active subscription
- `BlurGate` — blurs content without subscription
- `AgencyAdminRoute` — requires admin; wraps `/admin` and `/dwa-admin`

### Build
- Dev port: `8080`. Target: `es2020` + `safari14`
- PWA: `vite-plugin-pwa` + workbox
- Required env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Edge Function Conventions

- Every function: `supabase/functions/<name>/index.ts`, Deno runtime
- Shared utilities: `_shared/ai.ts` (generateText, generateJSON), `_shared/twilio.ts` (sendSMS + TCPA), `_shared/email-templates/`
- Checkout functions named `create-<product>-checkout/index.ts`
- Stripe: always inline `price_data`, always set `metadata.type` for webhook routing
- **SMS**: ALWAYS `import { sendSMS } from "../_shared/twilio.ts"` — never define a local sendSMS. The shared version checks `sms_opt_outs` (TCPA).
- AI calls: Claude Haiku only, `max_tokens` 800–1200
- Read env vars at module scope (top-level), not inside handlers
- Parallelize independent async ops with `Promise.all()`

---

## Migrations

- Files: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- All new tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `service_role` bypass policy
- **No manual SQL** — GitHub Actions runs `supabase db push` on every merge to main
- pg_cron: use `vault.decrypted_secrets` pattern for URLs — `current_setting('app.supabase_url')` returns NULL in cron context

---

## Deployment

- Claude commits to dev branch → Matt merges to main → Lovable auto-deploys
- GitHub Actions deploys to secondary project `zmyczlfuufhngzovkjdh` (contractor-lead-notify + missed-call-handler only)
- Secondary project is at free-tier function limit (~25) — don't add new functions there via MCP

---

## Secrets (all in Lovable Cloud)

| Group | Keys |
|---|---|
| Core | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `LOVABLE_API_KEY` |
| Google | `GOOGLE_MAPS_API_KEY`, `GOOGLE_PAGESPEED_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_PRIVATE_KEY_B64`, `GOOGLE_CALENDAR_ID` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_API_KEY` |
| Social | `META_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Data | `FIRECRAWL_API_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `HIBP_API_KEY`, `SAM_GOV_API_KEY`, `NOAA_API_KEY` |
| Automation | `N8N_MCP_URL`, `N8N_ACCESS_TOKEN` |
| Pending | `LOB_API_KEY`, `BROWSERLESS_API_KEY`, `APOLLO_API_KEY` |

Twilio webhook (voice/missed call): `https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1/missed-call-handler`

---

## Key Products Reference

> Full details in `knowledge/M2_Product_Catalog.md`. Below is the lookup table for code navigation.

### Detroit Web Agency (primary revenue focus)
| Product | Price | Tables | Webhook type |
|---|---|---|---|
| FieldDesk | $199/mo | `field_crm_clients`, `field_service_jobs`, `tech_locations` | `field_service_subscription` |
| TechAlert | $149/mo standalone · $79/mo bundle · $99/mo founders | `hire_alert_clients`, `hire_alert_candidates`, `hire_alert_runs` | `hire_alert_subscription` |
| SiteRadar | $49/mo | `field_crm_clients` (visitor_script_key), `crm_visitor_events` | — |
| Contractor Leads | $399/mo | `contractor_lead_sites`, `contractor_clients`, `contractor_leads` | `contractor_lead_subscription` |
| Dead Lead Reactivation | $50/reply | `dead_lead_campaigns`, `dead_lead_contacts`, `dead_lead_charges` | `dead_lead_billing_setup` |
| Missed-Call Catch | $99/mo | `missed_call_clients` | `missed_call_subscription` |
| Mortgage Radar | $149/mo | `mortgage_radar_clients`, `mortgage_radar_leads` | `mortgage_radar_subscription` |
| Golden Ticket Marketplace | $39–59/lead | `marketplace_prospects`, `marketplace_lead_locks`, `lo_outreach_campaigns` | `marketplace_lead_purchase` |

### Wave product migrations (search by migration date for full schema)
- Wave 1 (10 SMS/monitoring products): `20260403000000_ten_new_products.sql`
- Wave 2 (10 products): `20260403xxxxxx`
- Wave 3 (30 products): `20260404000000_thirty_new_products.sql`
- Wave 4 (8 products): `20260405080000_seven_new_products.sql`
- Wave 5 high-ticket: `20260405140000` + `20260405140001`

---

## Agents (31 total — `.claude/agents/`)

**Autonomous loop agents** (paired edge functions running 24/7): `tom-autonomous`, `oz-autonomous`, `scarlett-autonomous`, `selma-autonomous`, `ops-autonomous`

**Core**: Tom (lead hunter), Oracle (account watchdog), Ops (fulfillment)

**Specialized**: Aff, Cashier, Comply, Critic, Drill, Guard, Hype, Invest, Launch, Luna, Mirror, Mute, Nova, Pulse, Red, Ref, Rev, Scout, Shield, Solo, Trim, Upsell, Vera, Zero

> "Create an agent" = create `.md` file at `.claude/agents/[name].md`

---

## Knowledge Base

```bash
git fetch origin main && git checkout origin/main -- knowledge/
```

- `knowledge/M2_Agent_Roster.md` — all 31 agents, status, schedules
- `knowledge/M2_Admin_Controls_Guide.md` — every admin tool
- `knowledge/M2_Product_Catalog.md` — all products, pricing, margins, flows
- `knowledge/M2_Ad_Strategy_Action_Plan.md` — paid ads roadmap
- `knowledge/TechAlert_Value_Proposition.md` — TechAlert pitch, objections, ROI math

---

## Rules

- All new tables: RLS enabled + service_role bypass policy
- Stripe: inline `price_data` always; always set `metadata.type`; always `constructEventAsync` (not sync) in webhooks
- SMS: always use `_shared/twilio.ts` sendSMS — checks `sms_opt_outs` (TCPA)
- AI: Claude Haiku only (`claude-haiku-4-5`), max_tokens 800–1200
- stripe-webhook: use `sendM2Email()` and `notifyMatt()` helpers — never raw `fetch()` to Resend
- stripe-webhook: use `${SUPABASE_URL}/functions/v1/...` for function URLs — never hardcode project ref
- Auto-onboard: add welcome email template when adding new products
- Admin dashboards: add to both `AdminOpsCenter.tsx` ALL_SERVICES array AND `AdminClientHealth.tsx` SERVICE_TABLES array
- No dead code: delete unused imports/vars/functions — don't comment out
- `verify_jwt = false` in `config.toml` for public checkout/webhook endpoints — intentional
- Product filter rule: only build products that fail "Can a non-technical person replicate this with free ChatGPT in an hour?" Products that pass = content wrappers. Kill them.
- OSINT methods are never disclosed to clients — intelligence sources are proprietary
- Contractor leads: never pitch until ≥5 real leads in `contractor_leads` table

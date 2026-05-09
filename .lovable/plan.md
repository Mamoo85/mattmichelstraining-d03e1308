# Plan: TechAlert Overhaul + AmeriSteel CEO Trial + Cross-Radar Polish

This is a large, multi-phase request. To keep it shippable, I'm grouping ~30 items into 7 phases. Each phase is independently deployable and testable. Some items overlap (e.g., lead-card buttons appears twice in your list — folded into one).

Before I start, I have a few clarifying questions at the bottom — they'll change the shape of phases 2 and 3.

---

## Phase 1 — Foundation: Talent Ingest Pipeline (BLOCKING)

Everything else depends on this. Today every TechAlert scanner writes directly to `hire_alert_candidates` with inconsistent normalization, which is why "Main Content" / "Our Issues" junk keeps appearing.

**Migration** `talent_ingest_pipeline.sql`:
- `talent_ingest_raw` — raw payload, source, fetched_at, fingerprint, run_id, processed status
- `talent_ingest_runs` — run_id, source, started_at, finished_at, rows_in/out, dedupe_count, error
- Add `fingerprint text`, `source text`, `last_seen_at` to `hire_alert_candidates` and `hire_alert_companies` (create if missing)
- Unique index on `(fingerprint)` for idempotent upserts

**Edge function** `talent-ingest`:
- Accepts `{ source, run_id, candidates: RawCandidate[], companies: RawCompany[] }`
- Normalizes (existing `sanitize-candidate.ts` + stricter rules — reject "Main Content", nav fragments, single-token, all-caps >3)
- Fingerprints: `sha1(lower(name)|lower(company)|trade)` for candidates; `sha1(lower(domain||name))` for companies
- Writes raw → `talent_ingest_raw`; upserts canonical via `ON CONFLICT (fingerprint) DO UPDATE SET last_seen_at=now()`
- Returns per-source yield + dedupe stats

**Refactor all existing TechAlert scanners** (`techalert-prospect-hunter`, `signals-*`) to POST to `talent-ingest` instead of direct insert. Single shared helper `_shared/talent-ingest-client.ts`.

**Tests** (`talent-ingest/index.test.ts`):
- Normalization edge cases (junk patterns, casing, whitespace, unicode)
- Fingerprint stability across re-ingestion
- Idempotency: same payload twice → 0 new inserts, 0 dup fingerprints
- Cross-source dedupe (same person from GitHub + LinkedIn → one row)

---

## Phase 2 — 50 New TechAlert Sources + Welder/Fabricator Vertical

Add to scanner waterfall with fail-safe (try/catch per source, source provenance in `meta.source_trace`), via the new ingest pipeline. Sources fall into 5 buckets of ~10 each:

1. **Public job boards / ATS feeds** — Indeed RSS, ZipRecruiter RSS, Glassdoor sitemap, SimplyHired, JobSpider, CareerBuilder feed, USAJobs, CareerJet, Workable public, Lever public boards
2. **Federal/state license & registry** — LARA welder/fabricator licenses, OSHA fatality reports, MIOSHA citations, FMCSA driver pulls (proxy for trucking-trade churn), USCG merchant mariner, NLRB strike notices, EEOC charges, WARN Act notices (state DOL feeds × 5)
3. **Trade-specific niches** — AWS welder cert directory, AISC fabricator listings, Ironworkers Local hall postings, UA Plumbers/Pipefitters locals, IBEW locals, Operating Engineers, SMART sheet metal, Boilermakers, NACE/AMPP corrosion certs, NICET certifications
4. **OSINT / signals** — GitHub commits in trade orgs, Reddit r/Welding job posts, FB Marketplace "hiring" posts (via Firecrawl), Craigslist gigs, Nextdoor business posts, Discord trade servers, YouTube channel descriptions, Bluesky trade tags, Mastodon, Telegram public groups
5. **B2B/firmographic** — Apollo job-change events, Crunchbase hires, ZoomInfo free, BuiltWith stack changes, SimilarWeb visitor spike, BBB new accreditations, Chamber of Commerce new members, Better Contractor, Houzz Pro new pros, Angi new pros

**Welder/fabricator vertical**: extend `hire_alert_clients.trade_focus` enum and add `welder_fabricator` signal mapping. Update `MyTechAlert` filter pills.

**Data-sources dashboard upgrade** (`/dwa-admin/data-sources`): each source has status 🔴 Off / 🟡 Ready / ✅ Live. Add notify-on-promote (email + in-app toast via realtime).

**Backfill budget guard** (`_shared/enrichment-budget.ts` — already exists, extend):
- Per-source daily cap
- Per-candidate cap based on score threshold (≥7 → enrich, <7 → metadata only)
- Rate limit: 60 req/min/source

---

## Phase 3 — AmeriSteel CEO Trial Hub (FLAGSHIP DEMO)

Single 7-day no-card trial link provisioning 5 products under one login.

**Edge function** `create-trial-hub`:
- Input: `{ company, ceo_email, ceo_name, products: ['techalert','site_radar','missed_call','buyer_radar','reputation'] }`
- Creates one `trial_signups` row + per-product client rows (existing tables)
- Generates magic link → `/trial-hub?token=...`
- Idempotent on `(company, ceo_email)`

**Page** `/trial-hub`:
- Header: company name, "Day X of 7"
- 5 RadarFitCard tiles, each with deep link to `/my-techalert`, `/my-site-radar`, etc.
- Filter chips (show only SiteRadar + Growth, etc.)
- Open Graph meta per tile (`/trial-hub/og?tile=techalert&company=AmeriSteel`) — dynamic OG image edge function

**Admin tool** `/dwa-admin/trial-hub-builder`:
- Form: company, CEO contact, product checkboxes
- "Send trial email" button (idempotent)
- "Generate SMS draft" button → returns ready-to-paste SMS + short link

**AmeriSteel one-shot script**: seeds AmeriSteel CEO, sends teaser email, returns SMS text in admin UI for Matt to copy/paste.

---

## Phase 4 — Teaser Email Templates + 250-Lead List Builder

**Templates** (`_shared/email-templates/teaser-{product}.tsx`):
- TechAlert, SiteRadar, Missed-Call, Buyer Radar, Reputation
- Personalization fields: `company`, `ceo_first_name`, `industry`, `recent_signal` (e.g. "we noticed 3 welder hires in 30 days"), `peer_company`
- 7-day trial CTA → `/trial-hub?token=...`
- DWA-branded (electric teal #00d4ff)

**Edge function** `build-talent-prospect-list`:
- Pulls from new 50-source pipeline filtered for: hiring signal in last 30d + 50–500 employees + MI/OH/IN/IL
- Apollo + Hunter waterfall for CEO email
- Generates 250 rows in `talent_prospect_list` table with `cold_email_draft` (Opus-generated, personalized)
- Admin page `/dwa-admin/prospect-list` — review, approve, send

---

## Phase 5 — Lead-Card Persistence + LeadDetailDrawer Rollout

**Lead actions** (already partially built per Phase 37 — verify and complete):
- `LeadActionBar` component on every radar card: Contacted / Won / Lost / Pass / Snooze / Notes
- Persists to `{product}_lead_actions` table per radar
- Optimistic UI + toast on success/failure

**LeadDetailDrawer rollout**:
- Add to `MyDemandRadar`, `MyBuyerRadar`, `MyGrowthRadar` (currently only on TradeRadar/Mortgage)
- Generic `<RadarLeadDrawer product=... leadId=...>` reading from per-product table

---

## Phase 6 — Admin Polish + Magic-Login Consolidation

- `/dwa-admin/talent-ingest` — recent runs table, "Replay last run" per source, raw payload viewer
- "📧 Send Matt all dashboard links" button — single email with 23 magic-login buttons, idempotent (debounced 5min)
- `radar-fit-explainer` edge function (deploy + wire into `MyDemandRadar`/`MyBuyerRadar`)
- New routes: `/buyer-radar/setup`, `/demand-radar/setup`
- Fix `dashboard_token` TypeScript error in `MyTechAlert.tsx`

---

## Phase 7 — QA + Quality Report

- E2E browser test (Playwright): setup → launch → dashboard nav → lead card click → drawer → action button → DB persistence
- Run test scan via new pipeline, backfill, generate `quality-report-{date}.md`:
  - Per-source yield, dedupe %, score distribution histogram, top 10 candidates with full provenance
- Idempotency checker script: re-runs all scanners, asserts <1% new rows, 0 dup fingerprints
- Magic-link audit: every `/my-*` page loads correctly with token

---

## Out of Scope / Won't Do This Round

- New radar products (only polish existing)
- Migrating off Lovable-managed primary project
- Replacing Apollo/Hunter (waterfall stays)

---

## Clarifying Questions

1. **AmeriSteel CEO contact** — do you have name + email + phone, or should the prospect-list builder find them? (Affects whether Phase 3 ships standalone or waits on Phase 4.)
2. **50-source list** — are the 5 buckets I proposed acceptable, or do you have a specific source list you want me to use? (I can swap any bucket.)
3. **Trial Hub auth** — magic link only (no password), or full Supabase auth account with password setup at end of trial?
4. **Welder/fabricator vertical** — new vertical alongside HVAC/electrical/plumbing, or sub-tag under existing "industrial" trade?

If you answer these I'll refine the plan; otherwise I'll proceed with the defaults shown above (CEO lookup via prospect builder; the 5 buckets as listed; magic-link only; new vertical).
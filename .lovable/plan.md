

## Plan: Fill the Data Gaps — Tier 1 + Tier 2 Only (Zero New Secrets)

Ship 16 enrichment tactics using **only keys already in Lovable**. Skip Snov / Crustdata / NinjaPear (Tier 3). All work is **additive** — touches a new edge function, adds nullable columns, and a small admin UI block. No existing edge function, scoring rule, scraper, or table behavior changes.

---

### What ships

**1 new edge function:** `enrich-prospect-pool`
- Reads up to 25 `prospect_pool` rows per run where `email IS NULL OR contact_name IS NULL OR last_enriched_at IS NULL OR last_enriched_at < now() - interval '14 days'`
- Per-audience waterfall — stops as soon as email + contact_name are filled (cost control):

| Audience | Waterfall order |
|---|---|
| `senior_care` | NPI Registry → CMS Care Compare (`medicare-staffing-intel` reuse) → Sonar OSINT → Google Places |
| `industrial_mfg` / `supply_house` | Hunter `/domain-search` → Apollo people-search (extends existing `apolloOrgEnrich`) → Firecrawl `/contact` `/about` `/team` (capped 1 page, 5s timeout) → SAM.gov name match → DataForSEO SERP "owner OR president" → Sonar |
| `trade_contractor` / `healthcare_staffing` | Sonar → Hunter → Firecrawl |
| **all audiences (always run last)** | Google Places (rating, review_count) → Twilio Lookup carrier classification → HIBP domain breach |

- Each stage writes its result into a new `meta.enrichment_trace` JSONB key (which API filled which field, cost, duration) — full transparency
- Fire-and-forget calls existing `score-prospects` for the row after enrichment

**1 migration** (additive only, all nullable):
- `prospect_pool.google_rating numeric`
- `prospect_pool.review_count int`
- `prospect_pool.phone_carrier_type text`
- `prospect_pool.has_breach boolean`
- `prospect_pool.last_enriched_at timestamptz`
- `prospect_pool.enrichment_status text` (`pending` | `partial` | `enriched` | `dead_end`)
- Index: `CREATE INDEX idx_prospect_pool_enrichment_due ON prospect_pool (last_enriched_at NULLS FIRST) WHERE enrichment_status != 'dead_end';`

**1 cron** via `safe_cron_schedule()` (per the Cron Safety Layer rule):
- `enrich-prospect-pool-hourly` — runs every hour, processes 25 rows, ~$1/hr at full Firecrawl cost (capped at 200 Firecrawl scrapes/day via in-function counter against `ai_call_log`)

**1 admin UI block** in `OutreachCommandCenter.tsx`:
- **Coverage strip** at top: `Email: 0% · Contact: 0% · Reviews: 0% · Carrier: 0%` — live counts so Matt watches the gaps close
- **"🔄 Enrich Now"** button per row → invokes `enrich-prospect-pool` for that single ID, shows trace inline
- **"Enrich All"** button → kicks off a batch of 25 immediately (in addition to the cron)
- Tooltip on each filled field shows source (`Hunter` / `Sonar` / `NPI` / `Firecrawl` etc.) — comes free from the trace blob

---

### What stays untouched (the "do not break" guarantee)

- `score-prospects` — **no changes**. New columns are populated; if/when scoring is rewritten later, they're ready. For now, the 30-floor stays — but the *data* underneath now exists, so any future scoring tweak instantly produces a real spread.
- All 17+ existing scrapers (`contractor-prospector`, `industry-pulse-scanner`, `miosha-license-scraper`, `medicare-staffing-intel`, etc.) — **no changes**
- `_shared/ai.ts`, `_shared/twilio.ts`, `_shared/scraper.ts`, `cheap-extract.ts` — used as-is, not modified
- `prospect_pool` existing columns + RLS — **no changes** (migration only ADDs nullable columns)
- Stripe, webhooks, drip sequences, all client-facing pages — untouched
- TCPA suppression, opt-outs, `system_comms_log` — untouched
- Source-protection rule: enrichment trace is **admin-only** (never surfaces to client dashboards / emails / PDFs) — already enforced by `OutreachCommandCenter` being inside `/dwa-admin`

---

### Cost guardrails (zero-surprise budget)

| API | Per-row cost | Daily cap | Monthly worst case |
|---|---|---|---|
| Hunter domain-search | ~$0.04 | covered by existing plan | — |
| Apollo people-search | covered by existing plan | — | — |
| Sonar (Perplexity) | ~$0.005 | unbounded but cheap | <$5 |
| Firecrawl | ~$0.15 | **hard cap 200/day** in code | ~$30 |
| Google Places Details | ~$0.017 | unbounded | <$10 |
| Twilio Lookup | $0.005 | unbounded | <$3 |
| DataForSEO SERP | ~$0.0006 | unbounded | <$2 |
| NPI / CMS / SAM.gov / HIBP | free | — | $0 |

**Worst-case ceiling: ~$50/mo** to fully enrich the entire 186-prospect pool + ongoing top-ups.

---

### Files touched

| File | Change |
|---|---|
| `supabase/functions/enrich-prospect-pool/index.ts` | NEW — waterfall enricher, per-audience routing, trace logging, Firecrawl daily cap |
| `supabase/migrations/<new>.sql` | Add 6 nullable columns + 1 index to `prospect_pool` |
| `supabase/migrations/<new>_cron.sql` | `safe_cron_schedule()` for hourly enrichment |
| `src/components/dwa-admin/OutreachCommandCenter.tsx` | Coverage strip, Enrich Now / Enrich All buttons, source tooltips |
| `supabase/config.toml` | `verify_jwt = false` for `enrich-prospect-pool` (admin-invoked + cron) |

No new secrets. No existing edge function modified. No existing scraper modified. No scoring change. No client-facing change.

---

### Acceptance test

1. Apply migration → 186 rows show `last_enriched_at = null`, `enrichment_status = null`
2. Click **Enrich All** in OutreachCommandCenter → 25 rows process; coverage strip jumps from 0% → ~10–15% within 60s
3. Click any enriched row → tooltip shows `Email via Hunter (180ms, $0.04) · Reviews via Google Places · Carrier via Twilio`
4. Wait 8 hours (or invoke cron manually) → all 186 rows enriched at least once
5. Spot-check `prospect_pool` in DB → `google_rating`, `review_count`, `phone_carrier_type` populated for ~80%; `email`/`contact_name` populated for ~40–60% (industrial higher than senior_care)
6. Re-run `score-prospects` manually on the pool → scores still cluster at 30 (expected — scoring not changed yet) **but** `score_breakdown` now includes the new fields, ready for a one-line scoring tweak when you want it
7. Confirm no existing prospect/lead workflow broke: trigger `contractor-prospector` and `hire-alert-scanner` manually → both run clean, write to their normal tables, no errors


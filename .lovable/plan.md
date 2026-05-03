# HBS-Grade Conversion & Quality Audit

This is a multi-week scope compressed into a single phased delivery. We have **154 checkout functions**, **902 edge functions**, 11 trade-radar verticals, 8 DWA products, plus M2 fitness. Doing this responsibly requires phasing — anything else is theater. Below is the full plan; each phase ends in a verifiable artifact you can sign off on before we proceed.

---

## Phase 0 — Pricing & Offer Source-of-Truth (foundational, must come first)

**Decision required from you (one question — see clarifications below).** Then:

1. Create `_shared/offers.ts` — single source of truth:
  - `TRIAL_DAYS = 7` (no CC required)
  - `INTRO_DISCOUNT_PCT = 50` for first **3** months
  - `DEAD_LEAD_FIRST_YES_FREE = true`
  - Per-product map: `{ productKey → { trialEligible: bool, monthlyPriceCents, stripePriceLogic } }`
2. Create Stripe coupon `INTRO50_3MO` (50% off, repeating, 3 months) via stripe tool — single coupon reused across all products.
3. Refactor every `create-*-checkout` that's in scope (the **8 DWA products + Mortgage Radar + Trade Radar + TechAlert + FieldDesk + SiteRadar + Missed-Call + Contractor Leads + Bundle**) to:
  - Add `trial_period_days: 7` + `payment_method_collection: 'if_required'`
  - Apply `INTRO50_3MO` coupon by default
  - Dead Lead Reactivation: first positive-reply charge waived (flag in `dead_lead_charges`)
4. Update `cold-email-generate-row`, `cold-email-bulk-queue`, all dwa email templates, every postcard/fax/SMS template to render the offer from `offers.ts` (no hardcoded prices anywhere).

**Deliverable:** A `pricing-matrix.md` showing every product · monthly price · trial eligibility · coupon applied. You eyeball-confirm before we touch outbound.

---

## Phase 1 — Outbound Offer Consistency Sweep

1. Grep every cold-email/fax/postcard/SMS template for price strings, "trial", "free", "%" — replace with offer constants.
2. Trial CTAs in every email link to `/start-trial?product=X&utm=...` (new lightweight page that triggers the no-CC checkout via Stripe trial).
3. QR codes regenerated server-side from the same URL builder so every printed asset matches every email.
4. Audit `ad_launch_drafts` AI prompts → bake offer into Meta/Google ad copy generation.

**Deliverable:** Smoke test — fire one cold email, one fax, one postcard, one SMS, one Meta ad draft per product to your inbox/phone. You confirm copy + price + link in 15 minutes.

---

## Phase 2 — Link & Onboarding End-to-End Test Harness

Build `e2e-link-auditor` edge function (runs nightly + on-demand from admin):

- Pulls every URL referenced in: emails, dashboards, postcards (LOB), SMS, QR payloads, success_url, cancel_url, drip touches.
- HEAD-checks each URL → records 200/3xx/4xx/5xx in `link_audit_results`.
- Specifically validates per product:
  - Cold email → `/start-trial` → Stripe checkout returns 200 → success_url redirects to product dashboard → `claim-session` fires → welcome email logged in `email_send_log` with status `sent`.
  - Magic-link login from welcome email → resolves to dashboard.
  - QR codes decoded server-side, URL re-checked.
- Admin page `/dwa-admin/link-health` shows pass/fail per product with red flag for any 4xx/5xx.

**Deliverable:** Link health dashboard. Any product showing red = blocked from outbound until fixed.

---

## Phase 3 — Trial → Paid Recovery Drip

For every trial signup that doesn't convert by day 6:

- Day 3: value reminder + first-result proof (per product)
- Day 5: case study + "your trial ends in 48h" + 50% reminder
- Day 6: founder note from Matt (Opus-drafted, personal tone) + extend trial 3 days offer
- Day 8 (post-expiry): "miss us?" + reactivation 50% coupon
- Day 14: final win-back

Tables: `trial_signups`, `trial_drip_state`. Cron `trial-drip-runner` daily 9am ET. Reuses existing `_shared/twilio.ts` + `dwa-email.ts`.

**Deliverable:** Drip preview UI in admin showing the 5 touches per product.

---

## Phase 4 — Scanner & Waterfall Quality Audit ("no silent killers")

For every product with a scanner (Mortgage Radar, all 11 Trade Radars, TechAlert, Contractor Leads, SiteRadar, Marketplace):

1. Source matrix: list every data source, last-success timestamp from `agent_heartbeats`/run logs, fallback chain.
2. Run a synthetic lead through each waterfall end-to-end; assert ≥1 source per stage hit.
3. Flag any source silent >7 days; add to circuit-breaker dashboard.
4. Verify enrichment waterfall (Snov→Apollo→pattern→Hunter→PDL→site-scrape) per existing memory.
5. Lead quality gate: every new lead must satisfy product-specific minimum (e.g. Mortgage Radar: validated address + ≥2 corroborating sources for score>3 per anti-hallucination memory).

**Deliverable:** `/dwa-admin/scanner-health` matrix — green/yellow/red per source per product.

---

## Phase 5 — Cold Email Volume Optimization (deliverability-aware)

Current: 150/day frugal-mode floor (per existing economics plan).

Plan to scale safely to **2,000/day** without spam classification:

- Warm new sender domains via `mailgun`-style ramp: +10%/day, capped by 7-day rolling bounce <2% AND complaint <0.1%.
- Add 3 sending subdomains (`hi.`, `team.`, `notify.`) with separate IP pools.
- DKIM/SPF/DMARC verification check in `e2e-link-auditor`.
- `cold-email-volume-sentinel` (already exists) → extend with: bounce/complaint/spam-trap rate gates that **freeze the ramp** automatically.
- Subject-line variant testing already in cold-email-bandit-pick — pipe winners to higher-volume tier.

Keeps frugal economics (cost ceiling) intact; only volume changes when deliverability is proven.

**Deliverable:** Daily cap auto-adjuster + admin override slider with "current safe ceiling: N" indicator.

---

## Phase 6 — Bug Sweep on Recent AI-Generated Code

- Run `rg` for known AI-codegen smells: swallowed errors, missing `await`, `console.log` in prod paths, `any` casts hiding nulls, hardcoded prices/URLs.
- Per DWA Defensive Programming Protocol — fail-fast on webhooks, RPC for concurrency.
- Fix everything found; produce a delta report.

**Deliverable:** Bug-fix changelog grouped by severity.

---

## Technical implementation summary

```text
New files:
  supabase/functions/_shared/offers.ts                 (offer + price source of truth)
  supabase/functions/e2e-link-auditor/index.ts         (link + checkout E2E)
  supabase/functions/trial-drip-runner/index.ts        (5-touch recovery)
  supabase/functions/scanner-health-probe/index.ts     (source-level liveness)
  supabase/migrations/<ts>_trial_drip.sql              (trial_signups, trial_drip_state)
  supabase/migrations/<ts>_link_audit.sql              (link_audit_results)
  supabase/migrations/<ts>_volume_ramp.sql             (sender pool config + ramp state)
  src/pages/StartTrial.tsx                              (universal no-CC trial entry)
  src/pages/admin/LinkHealth.tsx
  src/pages/admin/ScannerHealth.tsx
  src/pages/admin/PricingMatrix.tsx
  pricing-matrix.md                                     (audit artifact)

Edited:
  Every create-<dwa-product>-checkout (~14 functions) → trial + coupon
  cold-email-generate-row, cold-email-bulk-queue, dwa-email.ts templates
  All postcard/fax/SMS template strings (offer constants)
  ad_launch_drafts AI prompt (offer baked in)
  cold-email-volume-sentinel (deliverability-gated ramp)
  stripe-webhook (handle trial_will_end, trial_ended events)
```

---

## Sequencing & ETA

Each phase = one user-approved batch. Estimate (assuming approval at each gate):

- Phase 0: 1 batch
- Phase 1: 1 batch
- Phase 2: 1 batch
- Phase 3: 1 batch
- Phase 4: 2 batches (scanners are big)
- Phase 5: 1 batch
- Phase 6: 1 batch

Total ~8 batches. **No phase ships until the prior phase's deliverable passes your eyeball test** — that's how we avoid silent killers.

---

## Clarifying question (one only)

**Which products get the 7-day no-CC trial + 50%/3mo combo? All radars besides hiring radars and contractor Leads and dead leads**

Default proposed (recurring SaaS only — trial doesn't make sense for one-shot):

- ✅ FieldDesk, TechAlert, SiteRadar, Mortgage Radar, all Trade Radars, Missed-Call, AI Phone Answering, Contractor Leads ($399/mo), Bundle Revenue Suite
- ❌ Dead Lead Reactivation (uses "first yes free" instead — your instruction)
- ❌ Marketplace pay-per-lead (one-shot purchases)
- ❌ Web Design ($X one-time)
- ❌ M2 Training (different brand — left alone unless you say otherwise)

Confirm or tell me to adjust, then I execute Phase 0 immediately.
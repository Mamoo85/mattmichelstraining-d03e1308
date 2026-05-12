# Autonomous Cold-Email System — Refined Plan (2026-05-12)

I pulled live DB counts and reviewed Claude's plan end-to-end. The shape of his plan is right, but several assumptions are wrong. Below is the corrected reality + a leaner build order.

---

## Part 1 — Actual DB Inventory (live numbers, not estimates)


| Table                        | Total     | Quality / Enriched                    | Emailed                                           | Replied |
| ---------------------------- | --------- | ------------------------------------- | ------------------------------------------------- | ------- |
| `techalert_prospect_targets` | **1,520** | 74 with owner_email                   | 63                                                | 0       |
| `trade_radar_leads`          | **2,538** | 2,185 score≥7                         | 0 outreach (B2C — homeowners, not for cold email) | —       |
| `mortgage_radar_leads`       | **716**   | 634 score≥7                           | 0                                                 | —       |
| `outreach_leads`             | **2,880** | 1,182 with email                      | 951 contacted                                     | 0       |
| `hire_alert_candidates`      | 304       | 39 (B2C — candidates, not businesses) | —                                                 | —       |
| `contractor_leads`           | 24        | 24 (B2C — homeowners)                 | —                                                 | —       |
| `dead_lead_contacts`         | **0**     | 0                                     | 0                                                 | —       |
| `marketplace_prospects`      | **0**     | 0                                     | 0                                                 | —       |


**Trade Radar by vertical:** HVAC 395 / Roofing 341 / Demo-Junk 308 / Electrical 246 / Exterior 233 / Plumbing 214 / Tree 199 / Gutters 199 / Pest 171 / Restoration 151 / Foundation 81. All 2,000+ score ≥7.

**Last 30 days email volume:** 1,500+ sent across 20+ templates. Top: cold_outreach 311, multi_service_pitch_1 285, contractor_drip_d0 258, web_drip_d1 227, techalert_cold_d0 114.

### Corrections to Claude's quality thresholds

- **Trade Radar / Mortgage Radar / Contractor Leads / Dead Lead = B2C homeowner data**, not cold-email prospects. They feed *paying customers*, not outbound sales. Confidence threshold means "enough leads to deliver to a buyer," which we already have for Trade Radar (every vertical has 80+ quality). **Mortgage Radar needs more — 634 is fine but only ~15 are fresh per week.**
- **TechAlert owner_email count = 74/1,520 = 5% enrichment.** This is the real bottleneck. We have 1,500 trade businesses identified but only 74 we can email. Enrichment, not discovery, is the limiter.
- **outreach_leads has 2,880 rows with 1,182 emails** — Claude assumed this was thin. It isn't; we just haven't been blasting it hard.
- **dead_lead_contacts is literally 0.** Dead Lead product has no source data. Either scrap or build.

---

## Part 2 — Customer Readiness (matches Claude's findings)

7-day trials: confirmed broken on TechAlert (`create-hire-alert-checkout` has no `trial_period_days`). All others set. **This is the single highest-priority 5-minute fix.**

Lovable deploy backlog from Phase 45 still pending — must be cleared first.

---

## Part 3 — Volume Reality

Daily theoretical cap: ~1,055/day. Actual recent 30d run rate: ~50/day. We are **20× under our own cap**, not because pools are empty but because:

1. `dwa-product-blast` + `siteradar-cold-blast` send rich HTML → spam → conversions ≈ 0 → no point increasing volume
2. No enrichment pressure on `techalert_prospect_targets` (only 5% have emails)
3. Resend free tier limits real ceiling to 100/day until plan upgraded

**Resend plan check is action #1.** No point planning 1,000/day sends on a 100/day plan. We have paid plan now let's use it! 

---

## Part 4 — Refined Build Order

### Phase A — Quick wins (today, ~2 hrs)

1. **Check Resend plan** — confirm we're on paid ($20/mo, 50k/month). If not, upgrade before any volume work.
2. **TechAlert trial fix** — add `subscription_data: { trial_period_days: 7 }` to `create-hire-alert-checkout`.
3. **Deploy Lovable backlog** (Phase 45 + healthcare scanner fixes already in git).
4. **Convert `dwa-product-blast` + `siteradar-cold-blast` to plainMode** via existing `dwaColdEmail()` helper (same pattern as techalert-outreach fix).

### Phase B — Enrichment over discovery (this week)

Claude jumped to "build a prospect replenisher." Wrong order. We already have **1,520 TechAlert + 2,880 outreach_leads** prospects sitting unenriched. Discovery isn't the bottleneck; **email-finding is.**

5. **Crank `outreach-leads-enrich**` — it drains 20/day. Raise to 200/day. Same with `techalert-enrich`. Both already exist; just need higher caps and more frequent cron (every 2 hrs instead of daily).
6. **Wire the full email-waterfall.ts** (Tiers 7–89 — already built in `_shared/`) into both enrich functions. Currently they only run Apollo → Hunter → Firecrawl. The 70+ free sources in `email-extras-*.ts` are sitting unused.

Expected result: in 5 days, TechAlert email coverage goes from 5% → 40%+ on existing pool. No new sourcing needed yet.

### Phase C — Quality-based dynamic caps (next week)

7. Build `outreach-quality-scorer` (nightly) + `outreach_quality_scores` table — Claude's design is right.
8. **Cap formula correction:** Claude's `pool_size * 0.10 * (quality/100)` will starve drips. Better:
  ```
   cap = min(MAX, eligible_unsent * 0.20, daily_resend_budget_share)
  ```
   where `daily_resend_budget_share` = (Resend monthly cap / 30) × (product priority weight). This explicitly prevents Resend overrun.
9. SMS alert to Matt when any product has <30 eligible-to-send.

### Phase D — Replenisher + drip parity (week 3)

10. **Then** build `outreach-prospect-replenisher` — but with deduplication against `email_send_log` so we never re-source someone we already burned.
11. `**outreach-followup-drip**` (D3/D7/D14 for outreach_leads) — Claude's design correct, copy techalert-followup-drip pattern.
12. Industry-specific Missed-Call pitch subtypes in `dwa-product-blast`.

### Phase E — Personalization (week 4)

13. Per-prospect personalization: pass `business_name`, `recent_signal` (e.g., "saw your BSEED roofing permit last week"), and `local_proof` ("3 other [city] [trade] companies use this") into the LLM. Currently `dwa-product-blast` uses static industry templates — that's not personalization, that's segmentation.
14. A/B subject line testing across all products.

---

## Part 5 — Things Claude got wrong / missed


| Claude said                                                                           | Reality                                                                                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "outreach_leads pool may be near empty"                                               | 2,880 rows, 1,182 with emails. Pool is fine.                                                          |
| "TechAlert enriched 40+ = confident"                                                  | We have 74 enriched out of 1,520 — discovery is solved, enrichment is the gap                         |
| "Build replenisher first (Phase B)"                                                   | Backwards. Enrichment first; we already have ~4,400 prospects sitting unenriched                      |
| "Resend free = 100/day"                                                               | Correct, but didn't make this action #1. No outbound plan works until plan is confirmed.              |
| Missed `email-waterfall.ts` Tiers 7–89                                                | 70+ free email sources already in `_shared/` — never wired into the enrich functions                  |
| Quality formula `pool × 0.10 × quality`                                               | Doesn't account for Resend budget. Will overshoot if pools are large.                                 |
| "Trade Radar / Mortgage Radar / Contractor / Dead Lead need cold-email source counts" | These are B2C buyer-product data, not outbound prospects. Conflates two pipelines.                    |
| dead_lead_contacts = 0                                                                | Claude didn't notice. Dead Lead product literally has no source data. Decision needed: scrap or seed. |


---

## Part 6 — One question I need answered before building

**Dead Lead Reactivation** has 0 source contacts in DB. Three options:

- (a) Scrap the product
- (b) Build a one-time importer for Matt's old contractor contact lists / CSVs
- (c) Auto-seed from `outreach_leads` rows that have phone + no reply after D14

Need Matt's call before allocating effort. Everything else above I can execute without further input. C and lets also keep this in the cold email loop. Im not getting rid of this product.

---

## Approval needed

- OK to start with Phase A (Resend check, TechAlert trial, plainMode conversions, Lovable deploy)?
- Decision on Dead Lead (a/b/c)?
- Any product I should deprioritize (e.g., is Foundation Trade Radar at 81 leads worth keeping aggressive on)? Your call. Im not sure.
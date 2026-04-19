

# Production Readiness Audit — Demand Radar, TechAlert, FieldDesk/Contractor Leads

## 1. Cron & Edge Function Health

**Cron schedule (verified 25 active jobs across the 3 products):**
- `hire-alert-scanner-4h` — firing every 4h ✅ (5 runs / 0 fails / 48h)
- `industry-pulse-scanner-daily` — firing daily 10am ET ✅
- `candidate-deep-enrich-30min` — 73 runs / 0 fails ✅
- `cron-sentinel-6h` — watchdog active ✅

**🚨 SILENT KILLER #1 — `lara-fast-scanner-30min` is fully broken**
- 41 runs / **41 failures** in 48h — 100% failure rate
- Error: `null value in column "url" of relation "http_request_queue"` (Phase 17 vault-lookup pattern that the memory file explicitly bans). It was never fixed in the Phase 17 migration.
- HTTP responses last 24h: 157 × 200, **49 × 400**, 1 × 401, 1 × 404. The 49 × 400 align with this cron + a few PDL probe failures.
- Impact: zero ill effect on alerts (the 4h scanner still runs), but `agent_heartbeats` reports a constantly-failing job.

**Checkpoint table is working** — `hire_alert_scanner_checkpoints` shows MiWorks, TradeMags, SOSDiss, FieldNation, HandyTR all `status=ok`, last completed normally — no 150s timeouts observed.

## 2. The Silent Killers — Data Quality

**🚨 SILENT KILLER #2 — `industry_pulse_signals.signal_type` is 100% NULL**
- 105 rows total, every single one has `signal_type=NULL`, `sector=NULL`, `vertical=NULL`, `expansion_type=NULL`, `vendor_fit_score=NULL`.
- The schema additions exist; the writer never populates them.
- Filtering/segmenting Demand Radar by signal type or sector currently returns nothing — UI features that depend on these columns are dead.

**🚨 SILENT KILLER #3 — `is_company_name` filter is leaking trash into hot leads**
- Of the 13 hottest candidates (score ≥ 8) in the last 7 days, **9 are flagged `is_company_name=true`** — meaning we KNOW they're company names, scored them 8–10 anyway, and they qualify for "hot alert" SMS.
- Names: "A1 Bargain" (10), "Rocket Pros" (9), "Mr Pipey" (9), "Plumb Pros" (8), "Keitz and Appliance" (8), "Marvin and Son" (8). Mr Pipey is back, despite the existing filter.
- Root cause: the score function doesn't gate on `is_company_name`, and the alert dispatcher doesn't filter it out either. Every TechAlert client could receive "Hot candidate: Mr Pipey" SMS.

**🚨 SILENT KILLER #4 — Scanner is finding 0 new candidates per run**
- Last 15 `hire_alert_runs`: every row shows `candidates_found=0, new_candidates=0, alerts_sent=0`.
- The scanner is firing on schedule but the source scrapers aren't returning data. Either the source sites changed shape, or the scrapers are silently catching errors and writing `0`.
- Existing 157 candidates were inserted by the per-source checkpoint writers (MiWorks/TradeMags/etc.), not the main 4h scanner.

**Source breakdown (157 total candidates / all from last 7 days):**
- miosha: 101 rows, avg score 3.04, only 1 email, 25 phones
- building_permits: 28 rows, avg 4.86, 5 emails, 14 phones
- yelp: 27 rows, avg 5.07, 5 emails, 11 phones
- phcc: 1 row

## 3. Enrichment Waterfall Match Rates

**ai_call_log shows only 1 provider used in 7 days:** `lovable / google/gemini-2.5-flash-lite` (14 calls, 100% success, 1979ms avg). **No NPI, PDL, Hunter, Snov, Lusha, Sonar, or Clay calls have been logged.** Either the waterfall is short-circuiting at stage 1 or those callers aren't logging into `ai_call_log` (which is for AI calls only, not data APIs — so this is partly expected, but still suggests low enrichment activity).

**Field-fill rates on the 157 candidates:**

| Field | Filled | % |
|---|---|---|
| has phone | 50 | 32% |
| has email | 11 | 7% |
| has personal_email_primary | **0** | **0%** |
| has linkedin_url | 10 | 6% |
| has current_employer | 47 | 30% |

By enrichment_status: `complete` (73), `exhausted` (83), `enriching` (1).
- Of the 83 `exhausted` (waterfall ran all 8 stages and gave up): **0 emails, 0 phones, 0 LinkedIn**. 100% miss.
- Of the 73 `complete`: 11 emails, 49 phones, 10 LinkedIn — phone is the only stage performing.

**True contactability (excluding company-name junk, n=122 real people):** 36 / 122 = **29.5% reachable by ANY channel**. PDL premium key is verified live but `personal_email_primary` is 0/122 — PDL is not being written into the waterfall result yet.

## 4. AI Scoring Accuracy

- 0 candidates default to score=0. 22/157 score ≥ 7. Avg ~3.5.
- Reasons strings look legit: `phone, phone-valid, email-personal, employer, trade-known, metro-detroit, experienced, flight:high_flight_risk`.
- **But:** the company-name leak (#3 above) means scores are not trustworthy. "A1 Bargain LLC" scoring 10/10 with `flight:high_flight_risk` is nonsense.

## 5. Billing & Fulfillment

- `dashboardToken` bug is **fixed** — properly hoisted at line 886 of `stripe-webhook/index.ts` and used in welcome email at line 982.
- The webhook handler signature pattern uses `if/else if` chains (not `switch case`), so my regex search returned 0; manual review of the file shows all 4 product types (`hire_alert_subscription`, `field_service_subscription`, `contractor_lead_subscription`, `missed_call_subscription`) have handlers with `notifyMatt()` fallback + 500-on-failure retries.
- `auto-onboard` welcome SMS templates include the `_subscription` variants per recent fixes.
- Live state: 1 active TechAlert client, 6 contractor_clients, 6 field_crm_clients, 29 contractor_leads (29 marked bidding-mode). FieldDesk + Contractor Leads have real customers.

## Production Readiness Scores

| Product | Score | Why |
|---|---|---|
| **TechAlert** | **45 / 100** | Scanner runs but finds 0 new per run; company-name junk reaches "hot" tier; PDL premium isn't writing personal_email; 29.5% contactability. Will deliver bad alerts to paying customers without intervention. |
| **Demand Radar** | **55 / 100** | 105 signals exist with rich pitches, BUT signal_type/sector/vertical 100% NULL — segmentation broken. Cross-referenced flagging works. Daily scanner healthy. Email digest can ship; UI filters cannot. |
| **FieldDesk / Contractor Leads** | **80 / 100** | Stripe webhooks clean, dashboardToken fixed, 6 active clients, 29 leads, lead-notify cron solid (147/147 in 48h). The strongest of the three. Not customer-blocking issues. |

## Recommended Fixes (in priority order)

1. **Kill `lara-fast-scanner-30min`** — unschedule the broken cron, OR rewrite it with the approved hardcoded URL+anon-JWT pattern from `mem://tech/cron-sentinel-and-monitoring`.
2. **Add `is_company_name=true` exclusion** to the alert dispatcher in `hire-alert-scanner` (and to the score cap) so company names never reach hot tier.
3. **Investigate why hire_alert_runs shows 0 candidates** — source scrapers likely silently catching errors. Add per-source error logging to the runs row.
4. **Wire signal_type/sector/vertical writes** into `industry-pulse-scanner` so Demand Radar segmentation works.
5. **Wire PDL into the candidate-deep-enrich waterfall** to populate `personal_email_primary` (premium key is verified, just unused).
6. **Bump Firecrawl extraction `max_tokens` from 600 → 2000** (carried over from prior session — still pending).

Apply 1–3 first; they're surgical and unblock the demos.


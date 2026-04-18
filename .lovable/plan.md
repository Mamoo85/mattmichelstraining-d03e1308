

## Plan: Three-Part Intelligence + Revenue Build

Building three connected features. All read-only research done — sources confirmed (`industry_pulse_signals`, `candidate-quality-scorer`, `hire_alert_candidates`, `dwa-closer`, existing Twilio/Resend helpers).

---

### Part 1: Flight Risk Cross-Reference (candidate-quality-scorer upgrade)

**File:** `supabase/functions/candidate-quality-scorer/index.ts`

- For each candidate with `current_employer`, query `industry_pulse_signals` filtered by employer match (ILIKE on company/location/event_summary) within last 60 days, `confidence >= 6`.
- Compute `employer_pulse_score`:
  - **>= 2 high-confidence signals** → `flight_risk = "hard_to_poach"` (employer hiring/expanding — candidate is comfortable)
  - **0 signals + employer present** → `flight_risk = "high_flight_risk"` (stagnant employer — candidate likely receptive)
  - **1 signal or no employer** → `flight_risk = "neutral"`
- Write to existing `score_reason` field + new column `flight_risk` + `flight_risk_proof` (1-line evidence string for the dossier).
- Add migration: `ALTER TABLE hire_alert_candidates ADD COLUMN flight_risk text, ADD COLUMN flight_risk_proof text`.
- Surface `flight_risk_proof` in the "Tangible Proof" section of the v5 PDF dossier generator.

**Source protection:** Output uses generic phrasing — "Employer shows expansion signals" / "No recent growth signals detected" — never names Sonar, Industry Pulse, or any vendor.

---

### Part 2: API Cost-Control Audit (Sunday SMS report)

**New table:** `candidate_enrichment_log` (if not present — quick check shows `ai_call_log` exists but is AI-only; enrichment APIs need their own log).
- Columns: `id`, `candidate_id`, `provider` (pdl/hunter/snov/lusha/clay/sonar/npi), `cost_cents`, `success` (bool — did it return contact data?), `response_summary`, `created_at`.
- Backfill instrumentation into `candidate-deep-enrich` to log every paid API call.

**New edge function:** `enrichment-cost-report-weekly`
- Cron: Sunday 9pm ET.
- Aggregates last 7 days from `candidate_enrichment_log`:
  - Per-provider: calls made, hits, hit rate %, total cost, cost-per-successful-lead.
  - Flag providers with hit rate < 5% as "kill candidates."
- Sends SMS to ADMIN_PHONE (+13138064952) via `_shared/twilio.ts`. Format: short summary + link to full HTML email digest.

**Migration:** new cron via approved hardcoded-URL pattern (per `cron-sentinel-and-monitoring.md`).

---

### Part 3: Blind Teaser Engine (FCRA-safe staffing agency outreach)

**New edge function:** `automated-blind-teaser-generator`
- Cron: Daily 8:00 AM ET.
- Queries `hire_alert_candidates` where `created_at >= now() - 48h` AND `license_issue_date IS NOT NULL`, ordered by score desc, limit 3.
- **Strict redaction:** strips `full_name`, `name`, `phone`, `email`, `linkedin_url`, `facebook_url`, `current_employer`, `npi_number`. Keeps only `trade`, `city`, `license_issue_date`, generic license type.
- Generates HTML email (dark DWA branding, matches existing `dwaEmail` wrapper):
  - Subject: `Market Alert: 3 New Licenses Issued in Metro Detroit`
  - 3 redacted "Event" cards
  - Stripe CTA button → new edge function `create-blind-teaser-checkout` ($399, one-time, metadata.type = `blind_teaser_unlock`, stores the 3 candidate IDs in metadata for fulfillment)
  - Hardcoded FCRA disclaimer footer (exact text from prompt)
- Routes finalized payload to `dwa-closer` queue table for dispatch to staffing-agency prospect list (re-uses existing closer dispatch — no direct sends, respects manual-approval mandate per `outreach-compliance-standards`).

**Stripe webhook handler:** add `blind_teaser_unlock` case to `stripe-webhook` — on payment, emails buyer the 3 unredacted candidate dossiers + 7 bonus matches from same trade/city.

**Compliance:**
- Honors TCPA manual-only mandate — teaser emails route through `dwa-closer` queue for Matt's approval, not auto-blast.
- FCRA disclaimer hardcoded, cannot be edited per-send.
- Source protection — no vendor names anywhere in email body.

---

### Files to be created/edited

**New:**
- `supabase/functions/enrichment-cost-report-weekly/index.ts`
- `supabase/functions/automated-blind-teaser-generator/index.ts`
- `supabase/functions/create-blind-teaser-checkout/index.ts`
- 1 migration: `flight_risk` columns + `candidate_enrichment_log` table + 2 crons (cost report Sunday 9pm, teaser daily 8am)

**Edited:**
- `supabase/functions/candidate-quality-scorer/index.ts` (flight risk logic)
- `supabase/functions/candidate-deep-enrich/index.ts` (log every paid API call)
- `supabase/functions/stripe-webhook/index.ts` (add `blind_teaser_unlock` handler)
- v5 dossier generator (surface `flight_risk_proof` in Tangible Proof section)

**Memory updates:** new file `mem://features/flight-risk-and-blind-teaser.md` documenting the FCRA-safe model, flight risk taxonomy, and API kill-criteria thresholds.


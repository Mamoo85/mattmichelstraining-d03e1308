---
name: Phase 18 Briefing (read this before acting)
description: >
  Cross-agent briefing on Phase 18 (Apr 2026) — Revenue Ops 50-item shipment,
  scanner architecture rewrite, new enrichment APIs, pricing, and known silent
  killers. All agents (Tom, Oracle, Vera, Tom-autonomous, Oz, Selma, Scarlett,
  Shield, Pulse, Comply, Cashier, Mute, Hype) should treat this as authoritative.
last_updated: 2026-04-19
---

# Phase 18 Cross-Agent Briefing

## What Changed in the Last 7 Days

### 1. TechAlert / HireRadar pricing (LIVE)
- Standalone: **$149/mo** (was $99 — raised against LinkedIn Recruiter Lite at $170)
- Bundle with FieldDesk: **$79/mo** (was $49 — sharper bundle math)
- Founders' lock-in: **$99/mo** for first 10 clients (use this in cold outreach as scarcity)
- High-Volume Buyer (NEW): blind teaser dispatch model — agencies pay per unlock, not per month

### 2. Scanner architecture (NEW — 3-tier)
The old monolith `hire-alert-scanner` is being phased out. New flow:
1. `hire-alert-dispatcher` — runs every cron, enqueues per-source jobs into `pgmq.scrape_jobs`
2. `queue-worker-scrape` — consumes queue, dispatches to per-source workers
3. Per-source workers: `miosha-license-scraper`, `lara-fast-scanner` (real-time license radar, 30-min cron)
4. NEW: every per-source worker writes to `hire_alert_runs` + `hire_alert_scanner_checkpoints` so admin tables are honest
5. Legacy `hire-alert-scanner` still runs but should be deprecated by next session — **do not pitch features that depend only on it**

### 3. Enrichment waterfall (Items 1–22, FCRA-safe)
For every candidate the scanner emits, this enrichment runs in order:
- **NPI Registry** (free) — taxonomy + business phone for healthcare candidates
- **Sonar (Perplexity)** — LinkedIn/Facebook/Indeed boolean OSINT — never disclosed to clients
- **Hunter.io** — corporate email verification (`HUNTER_API_KEY` secret)
- **Snov.io** — HR contact lookup (`SNOV_USER_ID` + `SNOV_CLIENT_ID/SECRET`)
- **People Data Labs** — mobile phone + personal email (`PDL_API_KEY`)
- **HIBP** — paste/breach domain check (`HIBP_API_KEY`) — surfaces stale orgs
- **Apollo** — org enrichment + size_tier
- **Twilio Lookup v2** — carrier classification, DNC risk flag
Trade vertical contactability ceiling is ~17%. Don't promise more.

### 4. Industry Pulse signals (Items 23–32)
`industry-pulse-scanner` now writes triple-confirmed signals when 3+ sources agree:
- Sonar competitor intel
- DOL H-2B visa filings
- Google Places review-score trends
- Apollo decision-maker map
- Michigan SOS new-business velocity
- NOAA storm × permit lag correlation
- BSEED permit surge harvesting
TechAlert clients get this free for 90d as retention; spinning out at $149/mo once 2–3 testimonials land.

### 5. Dead Lead Reactivation hardening (Items 34–48)
- `dead-lead-intake` now runs Twilio Lookup v2 → tags `phone_carrier_type` + `is_dnc_risk`
- `dead-lead-drip` re-enriches via Sonar before drip 1 — skips contacts marked `project_completed_at`
- 18-month TCPA EBR cutoff enforced; expired contacts → terminal status

### 6. Contractor Lead Notify (Items 40–48)
- Hunter validates contractor email
- PDL person enrich badge in notification
- HIBP domain breach in subject line
- Twilio carrier type stored in lead row
- Permit surge market context appended

### 7. New secrets (already added to Lovable Cloud)
- `HUNTER_API_KEY` ✅
- `SNOV_CLIENT_ID` + `SNOV_CLIENT_SECRET` ✅
- `PDL_API_KEY` ✅
- `HIBP_API_KEY` ✅ (rate-limited — cap at 5 req/run)
- `NOAA_API_KEY` ✅
- `GOOGLE_MAPS_API_KEY` ✅ (now also used for review scores in industry-pulse-scanner)

## Known Silent Killers (CRITICAL — cite if user reports problems)

1. **`hire_alert_runs` showed 0/0/0 indefinitely** — FIXED 2026-04-19. Per-source workers now log their own rows. Until next deploy, the legacy `hire-alert-scanner` cron's rows will still be 0; the truth is in per-source rows tagged `miosha`, `lara_val`, etc.
2. **Two scanner checkpoints stuck in `processing`** — `miosha` + `lara_val` were stuck since launch (workers ran but never reported back). Code now releases the lock on completion. Dispatcher's STALE_MS=30min auto-re-dispatches.
3. **Phone enrichment empty** — Hunter/Snov/PDL only run inside legacy `hire-alert-scanner`. Per-source workers don't yet call the enrichment waterfall. **TODO next session**: extract the waterfall into `_shared/enrichment.ts` and call from each worker.
4. **Older candidates (April 15–18) lack phone enrichment** — backfill candidate set is from before secrets were added. Run a one-shot backfill before pitching.

## How Each Agent Should Act on This

- **Tom / tom-autonomous** — pitch the new pricing ($149 standalone, $79 bundle, $99 founders' lock). Mention HIBP/Hunter/Snov/PDL enrichment as proof of OSINT depth without naming methods. Use Industry Pulse signals as conversation starters (e.g., "I saw your competitor lost 2 estimators last week — want the alert feed?").
- **Oracle** — when checking TechAlert health, query BOTH `hire_alert_runs` AND `hire_alert_scanner_checkpoints`. If `last_completed_at` > 30 min ago for any source, that source is silently down. Also check `hire_alert_candidates` `created_at` directly — that's ground truth.
- **Vera** — score lower if `is_dnc_risk = true` or `phone_carrier_type = 'voip'`. Score higher if NPI/PDL/Hunter all hit (corroboration ≥ 2).
- **Selma / Scarlett** — the founders' $99 lock-in offer is now the lead ad hook. Cap at 10 sign-ups; add scarcity counter to landing page when 5+ are claimed.
- **Cashier** — new revenue stream: High-Volume Buyer paid unlocks (per-event Stripe charge). Watch `blind_teaser_dispatches.paid_unlocks` and reconcile against `agency_candidate_assignments.charged_at`.
- **Comply / Mute** — `dead_lead_contacts.is_dnc_risk` and `phone_carrier_type` are NEW. Reject sends to `is_dnc_risk = true` regardless of opt-out status.
- **Shield** — TechAlert clients on the $99 founders' lock are highest churn risk if no candidate is delivered in week 1. Check `hire_alert_client_candidates` daily for first-touch latency.
- **Pulse** — add `hire-alert-dispatcher`, `queue-worker-scrape`, `lara-fast-scanner` to your monitored set. Old `hire-alert-scanner` still runs but treat it as legacy — alarms there matter less than dispatcher health.

## Source-Protection Rule (UNCHANGED — always enforce)

OSINT methodology is NEVER disclosed to clients. Never name Sonar, Perplexity, NPI, Hunter, Snov, PDL, HIBP, Apollo, Twilio Lookup, Crustdata, or Apify in client-facing copy, emails, SMS, dashboards, or PDF dossiers. Use vague language: "intelligence engine," "verified source," "industry signal," "background check."

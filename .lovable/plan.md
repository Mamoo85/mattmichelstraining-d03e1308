# DWA Intelligence Platform — Final Build Plan

## Talent Signal + Demand Radar + Multi-Vertical Predictive Sales

---

## Strategic Overview

Two products, one engine, multiple buyer personas:

| Product | Buyer | Price | Signal |
|---|---|---|---|
| **DWA Talent Signal** | Staffing agencies | $250/interview or $3,500/mo | Who is available to hire |
| **Demand Radar** | Equipment/supply reps, contractors, sales teams | $99–$499/mo | Who is expanding and will need supplies / who's a hot sales lead |
| **Territory Lock bundle** | Agencies who want both | $3,500/mo | Both feeds, exclusive by county |

**Demand Radar is sold as BOTH:**
1. **Sales lead intelligence** for B2B sellers (Ameristeel reps, Ferguson account managers, equipment distributors) — "which companies are about to need what you sell"
2. **Hiring expansion signal** bundled into Talent Signal Territory Lock for agencies — "which companies are about to need who you place"

Same engine, different framing per buyer. Marketing copy on `/demand-radar` leads with the **sales lead** angle (bigger TAM); agency bundle is a secondary use case.

**The "Perfect Storm" play:** Demand Radar detects Company X is expanding → Talent Signal has a candidate in the same vertical + county → combined card in agency portal: "They're hiring AND we have someone. Fast-Track for $250."

**The Ameristeel play:** Steel service center reps guess which fab shops to call. Demand Radar tells them which ones just won contracts and are tooling up. "$149/mo — your reps stop cold-calling blind."

---

## PHASE 0 — Health Check (Do This First)

**0a. Audit `boiler-sector-intel`** — last cron run, signals to DJ in past 30d, last SMS sent.
**0b. Audit `industrial-growth-intel`** — currently manual-invoke only; check last run + signal quality + errors.
**0c. Audit `medicare-staffing-intel`** — confirm cron + signals reaching admin panel.
**0d. Output:** SMS to ADMIN_PHONE per engine: "[Engine]: OK/DEAD, last run [date], [N] signals in 7 days". If any dead → stop and fix before Phase 1.

---

## PHASE 1 — Finish Talent Signal (90 min)

### 3 Original Gaps
- **A1.** `supabase/config.toml` — add 5 agency function entries with `verify_jwt = false`
- **A2.** `stripe-webhook` — handler on `payment_intent.succeeded` where `metadata.type === "agency_interview_charge"`. Update `agency_candidate_assignments.charged_at` + `stripe_charge_id`. `notifyMatt()` if assignment not found.
- **A3.** Language scrub — 7 violations (MIOSHA / LARA / Apollo / NPI / LinkedIn → generic terms). See file:line table in conversation.

### 10 Improvements
1. **Master test account sinkhole** — `is_test_account` boolean on `staffing_agency_clients`; route comms to `system_comms_log` with `status='sinkhole'`. Seed one test agency covering all verticals.
2. **Collision lock** — atomic `UPDATE ... WHERE id=$1 AND status='delivered' RETURNING id`. Zero rows = "already claimed."
3. **Ghosting credit** — `fast_track_credits` on agency, `ghosted_at` on assignment, "Mark No-Show" button + `agency-mark-ghosted` function. `agency-fast-track-interview` burns credit before Stripe charge.
4. **CSV export** — client-side blob; opaque `verification_id`, signal_strength, vertical, county, interview_booked_at. No source/scores.
5. **TCPA opt-out** — append "Reply STOP to opt out" to all candidate SMS; STOP webhook sets `do_not_contact = true`; checked before send.
6. **Demo token** — `/agency-portal?token=DWA_DEMO_MASTER` loads 4 hardcoded demo candidates with DEMO badge, no DB.
7. **agency-monthly-flip SMS** — `sendSMS(ADMIN_PHONE, ...)` alongside email.
8. **Stripe reconciliation cron** — `agency-payment-reconcile`, daily 11pm ET, Stripe→DB diff, SMS Matt on discrepancy.
9. **Behavioral scoring** — out-of-state license = +1 (relocation); lapsed-then-renewed = +1 (recommitment). Drop arbitrary tenure floor.
10. **Naming scrub (agency-facing only)** — "TechAlert" → "DWA Talent Signal" in `AgencyPortal.tsx`, `TalentIntelligence.tsx`, `AdminAgencyOutreach.tsx`, agency edge functions. Internal `hire_alert_*` table names stay.

---

## PHASE 2 — Demand Radar Production-Ready (90 min)

11. **Automate `industrial-growth-intel`** — `config.toml` cron daily 6am ET, write to `industry_pulse_signals`. Gate: skip Sonar call if zero active subscribers; log skip to `system_comms_log`.
12. **Schema decision** — check `industry_pulse_subscribers` first. If it has vertical + territory + plan → just add `buyer_type` column (`recruiter | supplier | contractor | sales_rep`). Else create `demand_radar_clients`.
13. **Demand Radar admin tab** in `/dwa-admin` — live signal feed, color-coded confidence badges (green ≥8, yellow 6-7, gray <6), company/expansion/county/source, "Manual Enrich" button, SMS alert log.
14. **DWA dark theme on `DemandRadar.tsx`** — `#00d4ff` on `#0a1628`, matches `/talent-intelligence` visually. **Marketing copy leads with sales-lead angle**: "Know which companies are about to buy from you, 30-90 days before they call." Hiring/agency angle is secondary.
15. **"Perfect Storm" cross-signal card** — `agency-distribute-candidates` queries `industry_pulse_signals` for territory + vertical match, `confidence >= 8`, past 48h. Prepends to morning briefing. Logs match.
16. **Territory Lock includes Demand Radar** — `demand_radar_access` boolean on `staffing_agency_clients`, "📡 Market Signals" tab in `/agency-portal`, feature line on Territory Lock pricing card.
17. **Demand Radar standalone email digest** — daily 7am to active subscribers, dark DWA branding, top 5 signals by confidence for their territory.

---

## PHASE 3 — Multi-Vertical Predictive Sales (120 min)

*Build the engine + portal. Skip vertical landing pages until first prospect conversation demands one.*

18. **Extend `industrial-growth-intel`** — accept `vertical` param. Templates per vertical:
    - `steel`, `plumbing_supply`, `roofing_supply`, `hvac_supply`, `electrical_supply`, `concrete`, `lumber`, `industrial_general` (existing)
19. **Buyer portal: `/demand-radar-portal?id={client_id}`** — mirrors `/agency-portal` (today's signals, confidence badges, "Mark Contacted", CSV export). Steel demo: `?token=STEEL_DEMO` loads 3 hardcoded Wayne County manufacturer expansion signals with DEMO badge.
20. **Stripe checkout** — extend `create-industry-pulse-checkout` (or new `create-demand-radar-checkout`). Tiers: $99/mo (1 vertical, 1 territory), $499/mo (all verticals, 5-county). Webhook handler: `demand_radar_subscription`.
21. **`AdminDemandRadarOutreach`** — new `/dwa-admin` tab. Pulls high-confidence signals + target supplier list (Ameristeel, Alro, Ferguson, ABC Supply). "Generate Pitch" → `agency-outreach-draft` with `buyer_type=supplier`. Copy button only, no auto-send.
22. **Tom agent extension** — `Tom.agent.md` section for supplier outreach. Personas: outside sales reps at steel/plumbing/roofing/HVAC distributors. Hook: "Your reps are guessing which shops to call. I have something that tells them 30 days in advance." Pricing: $149/rep, $499/5-rep bundle. First target: Ameristeel.

---

## PHASE 4 — Verification

- [ ] Phase 0: all 3 engines confirmed alive via SMS
- [ ] `/talent-intelligence`: zero forbidden words, Demand Radar on Territory Lock card
- [ ] `/demand-radar`: dark brand, **sales-lead-first copy** (not hiring-only)
- [ ] `/agency-portal?token=DWA_DEMO_MASTER`: demo cards, no DB
- [ ] `/demand-radar-portal?token=STEEL_DEMO`: 3 demo signals, no DB
- [ ] Collision lock: A claims → B's feed loses candidate
- [ ] Ghosting: No-Show grants credit → next Fast-Track burns it (no Stripe charge)
- [ ] CSV export: opaque IDs, no source fields
- [ ] Master test account: comms sinkholed to `system_comms_log`
- [ ] Stripe webhook handles `agency_interview_charge`
- [ ] `agency-monthly-flip` texts AND emails Matt
- [ ] `agency-payment-reconcile` cron + SMS on discrepancy
- [ ] Demand Radar 6am cron + skip when no subscribers
- [ ] `/dwa-admin` Demand Radar tab live
- [ ] Territory Lock → "Market Signals" tab visible in `/agency-portal`
- [ ] "Perfect Storm" card on confidence ≥ 8 morning briefings
- [ ] `AdminDemandRadarOutreach` generates Opus pitch with signal sample
- [ ] Grep scrubbed files for MIOSHA/LARA/Apollo/NPI/LinkedIn → zero
- [ ] Schema decision documented (extended `industry_pulse_subscribers` vs new `demand_radar_clients`)

---

## Session Plan

| Session | Work | Time |
|---|---|---|
| 1 | Phase 0 health check + Phase 1 (finish Talent Signal) | 90 min |
| 2 | Phase 2 (Demand Radar production-ready + Perfect Storm) | 90 min |
| 3 | Phase 3 (multi-vertical engine + buyer portal + Tom) | 120 min |
| 4 | Phase 4 polish + full verification | 30 min |

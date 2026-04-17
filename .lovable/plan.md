

User wants Batch 3 — next 20 Radar enhancements (5 per Radar). Batches 1-2 shipped 40 of 80 total. PDF catalog has 40 remaining. Pick the next highest-leverage ones that build on what's already in DB.

# Batch 3: Next 20 Radar Upgrades (5 per Radar)

## Why this batch
Batches 1-2 shipped DB schema + scanner expansion + new dashboards/crons. Batch 3 focuses on **conversion + retention mechanics** — the stuff that turns alerts into revenue: SMS dispatch, claim flows, ROI proof, referral hooks.

---

## Talent Radar (TR-11 → TR-15)
- **TR-11** SMS alert dispatch on SCORCHING candidates (score ≥9) — Twilio send to client phone with claim link
- **TR-12** Candidate "claim" button on alert email — locks candidate to client for 48h (uses existing `hire_alert_client_candidates`)
- **TR-13** Weekly "ones you missed" digest — candidates client viewed but didn't contact
- **TR-14** Client ROI tracker — "$X saved vs LinkedIn Recruiter" badge on dashboard (math: hires × $8k avg fee saved)
- **TR-15** Referral hook — "Refer another agency, get 1 month free" button + unique code per client

## Demand Radar (DR-11 → DR-15)
- **DR-11** SMS push for confidence ≥9 signals (same Twilio path as TR-11)
- **DR-12** "Pitch draft" button — Gemini generates 3-line cold email per signal (uses `recommended_pitch` field already in DB)
- **DR-13** Signal feedback loop — thumbs up/down per signal, trains future scoring per client
- **DR-14** "Companies to watch" saved list — pin specific MI companies for daily monitoring
- **DR-15** Weekly executive summary email — top 5 signals + week-over-week trend chart

## Growth Radar (GR-11 → GR-15)
- **GR-11** Map view in dashboard — pin signals on MI map by lat/long (use existing location field)
- **GR-12** Industry vertical filters in dashboard (manufacturing/construction/healthcare/govt)
- **GR-13** Slack/Teams webhook integration — push signals to client's workspace
- **GR-14** Saved searches — client defines keyword + county combos, gets pushed alerts only on matches
- **GR-15** Competitor monitoring — track when competitors win contracts in client's territory

## Lead Radar (LR-11 → LR-15)
- **LR-11** Contractor leaderboard — public stats (response time, claim rate) builds trust + gamifies
- **LR-12** Lead "preview" mode — show partial info (trade + city + budget range) before purchase
- **LR-13** Subscription credit packs — buy 10 leads upfront at discount, auto-deduct on claim
- **LR-14** SMS lightning notifications enhancement — include `quality_score` badge in SMS body
- **LR-15** Referral kickback — contractor refers another contractor, both get $50 credit

---

## Files Touched (~10)

**Edge functions (5)**:
- `talent-radar-sms-dispatch` NEW (TR-11) — Twilio scorching candidate push
- `claim-candidate` NEW (TR-12) — atomic 48h lock
- `demand-radar-pitch-generator` NEW (DR-12) — Gemini cold email draft
- `growth-radar-slack-push` NEW (GR-13) — webhook dispatcher
- `lead-radar-credit-pack` NEW (LR-13) — Stripe credit purchase + deduction

**Frontend (4)**:
- `MyTechAlert.tsx` (TR-13, TR-14, TR-15) — missed digest section + ROI badge + referral button
- `MyIndustryPulse.tsx` (DR-13, DR-14) — feedback thumbs + watchlist UI
- `GrowthRadarDashboard.tsx` (GR-11, GR-12, GR-14) — map view + filters + saved searches
- `LeadRadarDashboard.tsx` NEW or `ContractorLeads.tsx` (LR-11, LR-12, LR-14) — leaderboard + preview + SMS upgrade

**Migration (1)**:
- `radar_enhancements_v3.sql` — `referral_codes`, `signal_feedback`, `companies_watchlist`, `saved_searches`, `lead_credit_packs`, `claim_locks` columns

## Sequence
1. Migration v3 (5 min)
2. 5 new edge functions (~30 min)
3. 4 frontend updates (~40 min)
4. QA at 390px + 1280px
5. Deliverable: `/mnt/documents/DWA_Radar_Batch3_Shipped_2026-04-17.pdf`

## What's Left After This
20 enhancements remain (5 per Radar) — Batch 4 = the polish/long-tail (advanced analytics, AI agents, multi-language). Ship after this batch validates with first paying clients.

Total scope: ~90 min.


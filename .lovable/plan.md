

User wants the next batch after the top-20 (5 per Radar) that just shipped in Phase 1. The PDF catalog has 60 remaining (15 per Radar). Next logical batch: ship the next 5 per Radar = 20 more, prioritizing UI integration of Phase 1 DB schema (territory_counties, freshness_score, quality_score, vendor_fit_score columns are now in DB but not yet wired into UI/scanners).

# Batch 2: Next 20 Radar Upgrades (5 per Radar)

## Why this batch
Phase 1 shipped the DB schema + Growth Radar statewide expansion. Most new columns (`freshness_score`, `quality_score`, `agency_priority`, `vendor_fit_score`, `territory_counties`) are sitting unused. This batch wires them into scanners and UI so they actually do work.

---

## Talent Radar (TR-6 → TR-10)

- **TR-6** Wire `freshness_score` into `hire-alert-scanner` — license issued <30d = +2 boost, surface SCORCHING tier in alert emails
- **TR-7** Statewide MIOSHA scope in `hire-alert-scanner` (kill remaining "Metro Detroit" Sonar prompts — ~8 spots)
- **TR-8** `MyTechAlert.tsx` auto-fade contacted candidates after 7d (uses existing `client_action='contacted'` + timestamp)
- **TR-9** Agency 24h head-start filter — alert dispatcher checks `agency_priority=true` clients first, holds non-agency alerts 24h
- **TR-10** Source diversity badge in candidate cards ("Found via 3 sources") — Black Box rule, never names them

## Demand Radar (DR-6 → DR-10)

- **DR-6** Statewide MI scope in `industry-pulse-scanner` (West MI, Lansing, Flint, TC, UP)
- **DR-7** Confidence threshold slider in `MyIndustryPulse.tsx` (default ≥7, persists per client)
- **DR-8** "Predicted spend window" badge (14d/30d/60d) — add to Sonar prompt + render badge on signal cards
- **DR-9** Cross-reference with Talent Radar — flag SCORCHING combo (same company hiring + expanding) at top of feed
- **DR-10** Vendor-fit score input on signup ("what do you sell?") → AI scores each signal 1-10 for fit

## Growth Radar (GR-6 → GR-10)

- **GR-6** New `GrowthRadarDashboard.tsx` page — client-facing feed (currently admin-only)
- **GR-7** Daily 7am consolidated digest (`growth-radar-digest` edge function — one email, not 8)
- **GR-8** County multi-select on signup — filters digest by `territory_counties`
- **GR-9** One-click CSV export (HubSpot/Salesforce/Pipedrive format)
- **GR-10** SAM.gov MI gov contracts cron — daily pull into `growth_radar_signals`

## Lead Radar (LR-6 → LR-10)

- **LR-6** Wire `lead_quality_score` — new `lead-quality-scorer` edge function (phone-verified + value + urgency = 1-10)
- **LR-7** Statewide MI lead capture — kill Wayne/Oakland/Macomb lock in `ContractorLeads.tsx` form + intake
- **LR-8** Bid-up mode on high-value leads (`bidding_mode=true` flag triggers auction UI in claim flow)
- **LR-9** Auto-refund cron — `lead-auto-refund` daily, credits `refund_credits_cents` if 3 attempts unreachable
- **LR-10** Admin `AdminCoverageMap.tsx` heatmap — where contractors needed vs where leads land

---

## Files Touched (~12)

**Edge functions (5)**:
- `hire-alert-scanner` (TR-6, TR-7) — freshness scoring + statewide
- `industry-pulse-scanner` (DR-6, DR-8, DR-10) — statewide + spend window + cross-ref
- `growth-radar-digest` NEW (GR-7, GR-8) — 7am cron, county-filtered
- `lead-quality-scorer` NEW (LR-6)
- `lead-auto-refund` NEW (LR-9) — daily cron
- `sam-gov-mi-pull` NEW (GR-10) — daily cron

**Frontend (5)**:
- `MyTechAlert.tsx` (TR-8, TR-10) — auto-fade + source badges
- `MyIndustryPulse.tsx` (DR-7, DR-9) — slider + cross-ref banner
- `GrowthRadarDashboard.tsx` NEW (GR-6, GR-9) — client feed + CSV export
- `ContractorLeads.tsx` (LR-7, LR-8) — statewide + bid-up UI
- `AdminCoverageMap.tsx` NEW (LR-10) — heatmap admin tab
- Signup forms (DR-10, GR-8) — vendor-fit input + county multi-select

**Migration (1)**:
- `radar_enhancements_v2.sql` — `confidence_threshold` column on industry_pulse_clients, alert dispatch timestamps for agency head-start, growth_radar_signals table for SAM.gov

## Sequence

1. Migration v2 (5 min)
2. 5 edge functions — scanner upgrades + 3 new crons (~30 min)
3. 5 frontend pages + 1 admin tab (~45 min)
4. QA at 390px + 1280px on new dashboards
5. Deliverable: `/mnt/documents/DWA_Radar_Batch2_Shipped_2026-04-17.pdf` summary

## What's Left After This

40 enhancements remain (10 per Radar) — Batches 3 + 4. Documented in the master PDF with priority scores. Ship in two more passes after this lands.

Total scope: ~90 min.


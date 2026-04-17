

The user wants 20 enhancements per Radar (Talent, Demand, Growth, Lead) = 80 total. This is a research/strategy + implementation request. Given the scale (80 enhancements), I need to be thoughtful: not all 80 should ship as code in one pass — some are copy/UX, some are new tables, some are new edge functions.

Plan: deliver all 80 as a written enhancement catalog (PDF + chat), then ship the highest-leverage 20 (5 per Radar) as code immediately. Rest queued for follow-up builds.

# 80 Radar Enhancements — Catalog + Ship Top 20

## Deliverables

**1. Strategy doc**: `/mnt/documents/DWA_Radar_80_Enhancements_2026-04-17.pdf`
- 20 enhancements per Radar (80 total)
- Each rated: Impact (1-5) × Effort (1-5) → Priority Score
- Grouped by: Quick Win / Medium Build / Heavy Lift
- Includes copy-paste sales angle for each

**2. Code ship (Top 5 per Radar = 20 total)** — highest Impact/Effort ratio:

### Talent Radar (ship 5)
- TR-1: Statewide MIOSHA scope expansion in `hire-alert-scanner` (kill "Metro Detroit" lock)
- TR-2: Candidate freshness badge (license <30d = SCORCHING tier in scoring)
- TR-3: Agency 24h head-start flag on `hire_alert_clients` + filter in alert dispatcher
- TR-4: Auto-fade contacted candidates (visual dim after 7d in `MyTechAlert.tsx`)
- TR-5: Source diversity badge ("Found via 3 sources") — never names them (Black Box rule)

### Demand Radar (ship 5)
- DR-1: Statewide MI scope in `industry-pulse-scanner` (West MI, Lansing, Flint, TC, UP)
- DR-2: Confidence threshold slider in client portal (default ≥7)
- DR-3: "Predicted spend window" badge (14d/30d/60d) — Sonar prompt addition
- DR-4: Cross-reference with Talent Radar — surface SCORCHING combo signals
- DR-5: Vendor-fit score input field on signup ("what do you sell?")

### Growth Radar (ship 5)
- GR-1: Statewide expansion + SAM.gov MI gov contracts vertical
- GR-2: Equipment-specific scanning (Cat/Trumpf/CNC keywords)
- GR-3: Territory carve — county multi-select on signup
- GR-4: Daily 7am consolidated digest (one email, not 8)
- GR-5: One-click CSV pipeline export

### Lead Radar (ship 5)
- LR-1: Statewide MI lead capture (kill Wayne/Oakland/Macomb lock)
- LR-2: Coverage heatmap admin view (where contractors needed vs leads landing)
- LR-3: Bid-up mode flag for high-value leads
- LR-4: Lead quality score (phone-verified + value + urgency)
- LR-5: Auto-refund credit if 3 attempts unreachable

## Files Touched (~15)

**Migrations (1)**:
- `radar_enhancements_v1.sql` — territory column, freshness_score, agency_priority flag, lead_quality_score, refund_credits, vendor_fit_input, county arrays

**Edge functions (~6)**:
- `hire-alert-scanner` (statewide + freshness)
- `industry-pulse-scanner` (statewide + spend window)
- `industrial-growth-intel` (statewide + SAM.gov + equipment keywords)
- `growth-radar-digest` (NEW — 7am consolidated)
- `lead-quality-scorer` (NEW)
- `lead-auto-refund` (NEW — cron daily)

**Frontend (~7)**:
- `MyTechAlert.tsx` (auto-fade + source badges + agency banner)
- `MyIndustryPulse.tsx` (confidence slider + spend window)
- New `GrowthRadarDashboard.tsx`
- `ContractorLeads.tsx` / `LeadRadar.tsx` (statewide copy)
- New admin tab `AdminCoverageMap.tsx`
- Signup forms: territory multi-select + vendor-fit input
- Add CSV export button

## Sequence

1. Generate 80-enhancement PDF catalog (research + writing)
2. Ship migration
3. Ship 6 edge function changes
4. Ship 7 frontend changes
5. QA via 1280px + 390px screenshots of new admin tabs
6. Final summary + PDF delivery

## What Won't Ship This Pass

The other 60 enhancements (15 per Radar) are documented in the PDF with priority scores. We ship the next 20 (next highest priority) in the following build cycle. Avoids a 4-hour mega-build that overlaps with your launch push.

Total scope: ~2 hours. PDF first (so you can read while I code), then the 20 code ships.


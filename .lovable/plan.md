

Final batch — 20 remaining (5 per Radar). Batches 1-3 shipped DB schema, scanner expansion, dashboards, SMS dispatch, claim flows, ROI, referrals. Batch 4 = polish + long-tail: advanced analytics, AI agents, integrations, multi-language.

# Batch 4: Final 20 Radar Upgrades (5 per Radar)

## Why this batch
Closes out the 80-enhancement catalog. Focuses on **stickiness + intelligence** — the features that make clients renew at month 6 and refer peers.

---

## Talent Radar (TR-16 → TR-20)
- **TR-16** AI Recruiter Agent — auto-drafts personalized outreach per candidate (uses existing `generate-outreach-draft` pattern)
- **TR-17** Candidate enrichment expansion — pull LinkedIn + GitHub via Sonar OSINT for tech roles
- **TR-18** Interview scheduler — Calendly-style booking link in alert emails
- **TR-19** Hire confirmation flow — "Did you hire this candidate?" SMS at 14d, feeds ROI ledger
- **TR-20** Multi-seat support — agencies add recruiter teammates to one account

## Demand Radar (DR-16 → DR-20)
- **DR-16** Trend analytics dashboard — week-over-week signal volume by vertical
- **DR-17** AI signal summarizer — daily 3-bullet brief at top of dashboard
- **DR-18** HubSpot/Salesforce CRM push — one-click send signal to CRM as deal
- **DR-19** Signal expiry — auto-archive signals after 30d (keeps feed fresh)
- **DR-20** Vertical pivot — let client switch industries mid-subscription

## Growth Radar (GR-16 → GR-20)
- **GR-16** Permit watch integration — cross-ref with existing `permit_watch_clients` data
- **GR-17** Slack daily digest (uses Batch 3 webhook infrastructure)
- **GR-18** Multi-state expansion — Ohio + Indiana option (paid add-on)
- **GR-19** Signal scoring transparency — "Why this scored 9/10" tooltip
- **GR-20** Export to PDF — client-branded weekly intelligence report

## Lead Radar (LR-16 → LR-20)
- **LR-16** Geographic territory lock — contractor pays for exclusive county+trade combo
- **LR-17** Lead routing rules — contractor sets max budget, blocks low-value pings
- **LR-18** Win/loss tracking — contractor logs which leads converted, trains future scoring
- **LR-19** Auto-response templates — pre-written SMS sent on claim (saves 30s per lead)
- **LR-20** Annual subscription tier — pay 10 months, get 12 (locks renewal)

---

## Files Touched (~10)

**Edge functions (5)**:
- `talent-radar-recruiter-agent` NEW (TR-16) — Gemini outreach drafts
- `talent-radar-hire-confirm` NEW (TR-19) — 14d SMS check
- `demand-radar-summarizer` NEW (DR-17) — daily AI brief
- `growth-radar-pdf-report` NEW (GR-20) — weekly client-branded export
- `lead-radar-territory-lock` NEW (LR-16) — Stripe exclusive territory checkout

**Frontend (4)**:
- `MyTechAlert.tsx` — multi-seat invite UI + hire confirm prompt
- `MyIndustryPulse.tsx` — trend chart (recharts) + AI brief banner
- `GrowthRadarDashboard.tsx` — score transparency tooltips + PDF export button
- `LeadRadarEnhancements.tsx` — territory lock card + win/loss logger + auto-response templates

**Migration (1)**:
- `radar_enhancements_v4.sql` — `team_members`, `hire_confirmations`, `signal_archives`, `territory_locks`, `lead_outcomes`, `auto_response_templates`, `annual_subscriptions`

## Sequence
1. Migration v4 (5 min)
2. 5 new edge functions (~25 min)
3. 4 frontend updates (~30 min)
4. QA at 390px + 1280px
5. Deliverable: `/mnt/documents/DWA_Radar_Batch4_Shipped_2026-04-17.pdf` + master `DWA_Radar_All_80_Complete.pdf`

## What's Next After This
All 80 catalog enhancements shipped. Post-Batch 4 work shifts to **validation**: onboard first 10 paying clients, gather feedback, prioritize fixes from real usage. No more speculative builds.

Total scope: ~75 min.


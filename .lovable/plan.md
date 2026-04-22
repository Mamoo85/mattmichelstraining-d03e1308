

## Plan: Outreach Command Center + Admin Sidebar Cleanup

You've got most of the pieces already (`prospect_pool`, `targeting-prospect-scraper`, postcard, fax, SMS drafts, LinkedIn Blitz, blocklist) — they're just scattered across **~50 sidebar tabs in 7 groups**. This plan bolts them into one **Contractor/Prospect Outreach Command Center** and trims the sidebar to ~25 tabs in 5 groups.

---

### Part 1 — New: "Outreach Command Center" tab

A single screen built around `prospect_pool` (shared targeting brain) with 4 sub-tabs:

**Sub-tab 1 — Find Prospects (Targeting Engine)**
- Search filters: **audience** (HVAC / Plumbing / Roofing / Electrical / Nursing Home / Supply House / Healthcare Staffing / Industrial Mfg / Senior Care), **county** (any US county, not just MI), **city/zip**, **min lead_score**, **channel hint** (email / postcard / fax / phone), **has email**, **has fax**, **has mailable address**, **has phone**, **suppression-clean**.
- "Run Scrape" button → invokes `targeting-prospect-scraper` for the chosen audience+geo (existing function), then re-queries `prospect_pool`.
- Re-uses existing `score-prospects` edge function to refresh lead_score on demand.

**Sub-tab 2 — Ranked Pool (results table)**
- Sortable, paginated table of prospects (business, city, score, channels available, intel notes, last contacted, status).
- Bulk-select + bulk action bar: **Add to Email Campaign · Add to Postcard Campaign · Add to Fax Campaign · Add to Call Sheet · Suppress · Export CSV**.
- Row click → side drawer with full contact card, comms history (`system_comms_log` join), and per-channel "Draft now" buttons.

**Sub-tab 3 — Active Campaigns**
- Single unified campaign list across **email / postcard / fax / SMS** with channel badges, send counts, delivered/opened/replied, cost-to-date, "Resend Failed", "Pause".
- Reads from existing tables (`postcard_campaigns`, `fax_campaigns`, `email_send_log`, `system_comms_log`) — no new schema.

**Sub-tab 4 — Compliance & Suppression**
- Combined view of `sms_opt_outs`, `suppressed_emails`, `fax_opt_outs`, postcard returns.
- Single "Add to all blocklists" input.
- Pulls TCPA quiet-hours stats from existing `compliance-stats` function.

**File**: `src/components/dwa-admin/OutreachCommandCenter.tsx` (~600 lines, uses existing tables + edge functions; no DB migration needed).

---

### Part 2 — Sidebar consolidation (50 → ~25 tabs)

Current sidebar has duplicates and dead-weight. New structure:

```text
REVENUE
  📊 Overview          (AdminDWAOverview)
  💰 Revenue           (AdminDWARevenueDashboard)
  🟢 Leads E2E         (AdminContractorLeadsStatus)
  📍 Prospect Tracker  (AdminProspectTracker)
  🤖 Agent Toolkit     (AgentToolkit)

OUTREACH  ← NEW unified hub replaces 9 separate tabs
  🎯 Command Center    (NEW — Find/Ranked/Campaigns/Compliance)
  💬 SMS Inbox         (AdminSMSInbox)
  ✍️ Pending Drafts    (AdminPendingSMSDrafts)
  📞 Daily Call Sheet  (AdminCallList)
  💼 LinkedIn Blitz    (AdminLinkedInBlitz)
  🚀 Ad Launcher       (AdminAdLauncher)
  📨 Agency Outreach   (AdminAgencyOutreach)

CUSTOMERS  ← consolidated
  🏗️ Contractor Leads        (AdminContractorLeads)
  🤝 Contractor Onboarding   (AdminContractorOnboarding)
  ♻️ Dead Leads              (AdminDeadLeads)
  🛠️ FieldDesk Clients       (AdminFieldCRMClients)
  🎯 TechAlert Clients       (AdminHireAlertClients via TalentRadarHub)
  👥 All Clients / CRM       (DWAClientRoster + AdminCRMDashboard merged into one tab)

INTEL & RADARS  ← merge "Radars" + "Market Intel" + "Intel"
  🎯 Talent Radar      (TalentRadarHub)
  📈 Demand Radar      (DemandRadarHub)
  📦 High-Volume Buyers(AdminHighVolumeBuyer)
  📡 Growth Signals    (AdminGrowthSignals — also absorbs Medicare + Industrial intel as filters)
  👁️ Visitor Intel     (VisitorIntelFeed)
  📡 The Wire          (AdminTheWire)
  🗺️ Coverage Map      (AdminCoverageMap)

OPS & TOOLS  ← collapsed from "Tools" (was 16 items)
  🛡️ Health & Compliance  (NEW wrapper tab with 4 sub-tabs:
                           Service Resilience · Cron Sentinel + Status · TCPA · LARA Health · Error Logs)
  🧪 Simulation Suite     (AdminSimulationSuite — also absorbs Labs as a sub-tab)
  📖 Playbook & Strategy  (NEW wrapper: Playbook · Strategy · Sales Guide as sub-tabs)
  ⚙️ Field Ops            (NEW wrapper: Field Stats · Jobs · Assets · Contracts · Import as sub-tabs)
  🎛️ Command Deck         (DWACommandDeck)
```

**Removed from sidebar (still exist as components, just not top-level tabs):**
- `Postcards`, `Faxes`, `Targeting`, `Outbox`, `Supplier Outreach`, `Blocklist`, `TechAlert Prospects`, `Trojan Log`, `Community Drop`, `Referral Kickback`, `Ad Spend Tracker`, `Ad Optimizer Log`, `Medicare Intel`, `Industrial Intel` → all reachable as sub-tabs inside Command Center, Growth Signals, or Outreach hub.

Net effect: **7 groups → 5 groups**, **~50 tabs → 25 tabs**.

---

### Part 3 — Audit findings on top products (no rebuild needed, fixes only)

| Product | Outreach gap | Fix in this plan |
|---|---|---|
| Contractor Leads ($399/mo) | No way to find/cold-pitch HVAC/plumbing contractors at scale across cities | Command Center → Find Prospects audience = "Contractor", multi-city, push to email + postcard + fax in one flow |
| TechAlert ($149/mo) | Nursing home / staffing agency targeting was siloed in 2 separate tabs | Command Center audience = "Nursing Home" / "Healthcare Staffing" → unified |
| FieldDesk ($199/mo) | No prospect pipeline at all | Command Center audience = "Industrial Mfg" / "Trades" → fed into existing pipelines |
| Dead Lead Reactivation | Self-serve `/dead-lead-intake` works, but no admin-driven outbound to *new* contractors | Command Center → Contractor audience → "Add to Email Campaign" with dead-lead-pitch template (existing in `contractor-prospector`) |

No new edge functions or DB migrations needed — the targeting brain (`prospect_pool` + `targeting-prospect-scraper` + `score-prospects`) is already built and producing data.

---

### Files touched

- **NEW**: `src/components/dwa-admin/OutreachCommandCenter.tsx`
- **NEW**: `src/components/dwa-admin/HealthComplianceHub.tsx` (wrapper tab)
- **NEW**: `src/components/dwa-admin/PlaybookHub.tsx` (wrapper tab)
- **NEW**: `src/components/dwa-admin/FieldOpsHub.tsx` (wrapper tab)
- **EDITED**: `src/pages/DWAAdmin.tsx` — sidebar groups + tab routing
- No DB migrations, no new edge functions, no Stripe changes

Estimated build: 1 pass, ~700 lines of new TSX, ~80 lines removed from `DWAAdmin.tsx`.


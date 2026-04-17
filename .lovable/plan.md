

# Phase 4 — Targeting: Fix Search, Score the List, Mail 5 to Your House

## Root cause of what you saw

**Why no staffing agencies / no nursing homes show up in the Postcards tab:**
The Postcards tab reads from ONE table (`postcard_prospects`) which is fed by TWO scrapers — `lara-business-scraper` and `lara-accela-scraper`. Both are hard-coded to query Michigan LARA for **Mechanical / Boiler / Plumbing / Electrical / Refrigeration contractor licenses only**. There is literally no code path that adds a nursing home, healthcare staffing agency, or trades staffing agency to that table. That's why you saw HVAC/plumbing/mechanical and nothing else, regardless of which "Audience Type" dropdown you picked. The dropdown only changes the postcard COPY, not the search.

Nursing home data already exists in the codebase — `medicare-staffing-intel` (CMS API, free) and `fax-prospect-finder` (CMS + NPI). They write to `fax_prospects`, not `postcard_prospects`. The two systems are siloed.

## What I'll build

### 1. Fix search — one prospect pool, real sources per audience

Make Audience Type actually drive the search, not just the copy. New unified scraper `targeting-prospect-scraper` routes by audience:

```text
Audience Type           Real source                            County filter
─────────────────────── ───────────────────────────────────── ───────────────
Healthcare Staffing     NPI Registry (taxonomy = staffing)     ZIP prefix
                        + Sonar fallback                       
Trades Staffing         Sonar (Google + BBB scrape)            County name
Nursing Home/Facility   CMS Medicare Care Compare (free)       ZIP prefix
HVAC/Plumb/Electrical   LARA Accela (existing, kept)           County
Supply House            Sonar (industry directory scrape)      County
General Contractor      LARA + Sonar                           County
+ NEW: Industrial Mfg   SAM.gov + Sonar manufacturing list     County
+ NEW: Senior Care      CMS home-health + assisted-living      ZIP
+ NEW: Schools/Dist.    MI Dept of Education public CSV        County
```

All write to a unified `prospect_pool` table with `audience_type` + `channel_hint` (postcard vs fax) + `source` + `verified_address` + `verified_fax`. The Postcards tab and Fax tab both read from this one table filtered by audience + channel_hint.

### 2. Add prospect scoring — "Most Likely" ranked tab

New column `lead_score` (0-100) computed by a `score-prospects` function that runs after every scrape. Inputs:

```text
Signal                                                      Weight
─────────────────────────────────────────────────────────── ──────
CMS staffing rating 1★ or 2★ (nursing home pain)            +25
Active job postings on Indeed/ZipRecruiter (Sonar check)    +20
Cross-referenced Demand Radar signal in their county        +15
Recent license issued or expiring (LARA)                    +15
Verified mailable address present                           +10
Verified fax number present (for fax channel)               +10
Phone listed                                                +5
Website looks outdated (Firecrawl, optional)                +5
Penalty: in suppressed_emails or fax_opt_outs               -100
```

New tab "🥇 Most Likely" with sorted list, filters by audience + county + score range. One-click "Add to Postcard Run" or "Add to Fax Run" buttons.

### 3. Outbound: postcard + fax with all-relevant-services and proof

Postcard and fax templates get rebuilt per audience to include:

- The **specific service** that fits them (Healthcare staffing → TechAlert CNA pack; Nursing home → TechAlert + Demand Radar; Industrial → FieldDesk + TechAlert bundle; Trades agency → TechAlert; Supply house → Demand Radar)
- "My promise to prove it" — Matt's photo, direct phone (313) 992-1219, and the offer ("First 10 names free / first month free / call me and I'll prove it")
- QR code → `/staffing?industry=...&src=postcard` deep-linked to the right landing page

### 4. Five sample postcards to your house — sandbox mode

New admin button "📬 Send Sample Pack to My House" in the Postcards tab. It:

1. Picks the top-scored prospect from each of 5 different audiences (healthcare staffing, nursing home, trades agency, contractor, supply house)
2. Renders each postcard with that prospect's data so you see the real personalization
3. Overrides the mailing address with **YOUR** address (one-time `MATT_HOME_ADDRESS` env var you'll add)
4. Sends 5 postcards via Lob (~$4.25 total)
5. Logs to a new `sample_sends` table so it doesn't double-send

You get 5 different postcards in your mailbox in ~5 business days. Same for fax — "Send Sample Fax Pack to my home fax / personal fax-to-email" if you want it.

### 5. GovTribe — what it is and my recommendation

**What it does:** Federal contracting intelligence platform. Every RFP, contract award, agency budget, vendor history, NAICS code activity. Mostly federal (DoD, GSA, VA), some state.

**Useful for us when:** You want to fax/mail contractors right after a local federal facility (Selfridge ANG, VA hospital, Coast Guard, Detroit Arsenal) awards a maintenance/HVAC/staffing contract — those primes need subs in 30-90 days.

**Cost:** $2,400-15,000/yr depending on tier. No public free tier.

**My recommendation: don't pay for it yet.** SAM.gov (free, already have `SAM_GOV_API_KEY` per your CLAUDE.md) + USAspending.gov (free) cover ~80% of the same signals for Metro Detroit. I'll wire those into a new `federal-contract-intel` scraper that feeds `prospect_pool` with score boost when a contract award matches an audience's territory. If those prove valuable and you want deeper data (vendor history, agency forecasts), then GovTribe.

## More tools you asked for

I'll add these into Targeting Brain so each prospect shows ALL relevant intel before you commit to mailing:

| Tool | Source | Cost | What it adds |
|------|--------|------|--------------|
| Federal contract awards | SAM.gov (have key) | Free | Buyer intent in their county |
| OSHA inspections | OSHA public API | Free | Safety violations = staffing/training need |
| Building permits | Detroit ArcGIS (have integration) | Free | New construction = subs needed |
| Hiring posts | Indeed via Sonar (have key) | Already paid | Job ad volume per company |
| Website scrape | Firecrawl (have key) | Already paid | Is their site outdated? |
| Reviews | Yelp API (have key) | Already paid | Reputation signal |
| Manufacturing directory | Sonar | Already paid | NAICS + size + employees |

Total new spend to enable everything above: **$0**. GovTribe stays optional.

## Files I'll touch

```text
NEW   supabase/functions/targeting-prospect-scraper/index.ts   ← unified router
NEW   supabase/functions/score-prospects/index.ts              ← scoring engine
NEW   supabase/functions/send-sample-postcards/index.ts        ← 5-to-your-house
NEW   supabase/functions/federal-contract-intel/index.ts       ← SAM.gov
NEW   supabase/migrations/<ts>_prospect_pool.sql               ← unified table + score
EDIT  src/components/admin/AdminPostcardCampaigns.tsx          ← real audience search
EDIT  src/components/admin/AdminCampaignTargeting.tsx          ← Most Likely tab + filters
EDIT  src/components/admin/AdminFaxCampaigns.tsx               ← read prospect_pool
EDIT  supabase/functions/send-postcards/index.ts               ← per-audience templates with proof block
EDIT  supabase/functions/send-fax-phaxio/index.ts              ← per-audience message templates
```

## What I need from you to ship

1. **Approve this plan** so I can switch to build mode.
2. **Your home mailing address** — I'll save it as `MATT_HOME_ADDRESS` secret so it's never in code.
3. Confirm the 5 audiences for the sample pack: Healthcare Staffing, Nursing Home, Trades Staffing, Contractor (HVAC), Supply House. Swap any if you want.

Sample cost when you click the button: **~$4.25** (5 × $0.85 Lob).


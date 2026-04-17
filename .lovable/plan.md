

## The Blunt Answer First

### TechAlert / HireAlert — Do we have enough data?

**No, not yet — but the pipeline exists. Here's the truth from the DB right now:**

| Metric | Reality |
|---|---|
| Total candidates in DB | **148** |
| Candidates with phone OR email | **10** (6.7%) |
| Score ≥ 7 ("hot") | **0** |
| Score ≥ 5 ("warm") | **0** |
| Distinct trades populated | **0** (all NULL — `trade` field never written) |
| Distinct states | **1** (MI only) |
| Last 7 days new | **148** (all batch-loaded same day) |
| Active TechAlert clients | **1** |

**Verdict:** You have raw license records but **the enrichment pipeline (scoring + contact info) is broken/cold**. The 148 are LARA license issuances with no scoring, no phone numbers, no roles assigned. You CANNOT sell either the $399 sheet or $499/mo today and fulfill it. **You'd run out instantly because effectively you have 10 contactable candidates statewide.**

What needs to happen first (assuming you fund APIs):
- Run `hire-alert-scanner` daily for **7-14 days** to build a contactable pool
- Backfill `trade`, `score`, scoring reasons on existing 148 records
- Target volume to safely sell: **50+ contactable, score ≥ 7 candidates per trade per region**

---

### Demand Radar — Do we have enough data?

**Better. Real signals exist. Here's the truth:**

| Metric | Reality |
|---|---|
| Total Demand Radar / Industry Pulse signals | **58** |
| Signals with confidence ≥ 8 | **~6** (e.g. Third Coast Electric = 10, Multiple Employers HVAC = 8) |
| Signals with confidence ≥ 6 | **~30** |
| Distinct verticals/sectors populated | **0** (vertical/sector fields NULL — pulled from `hiring_roles` instead) |
| Counties populated | **0** (county field NULL — uses `location` instead, e.g. "Detroit, MI", "Royal Oak, MI") |
| All signals detected | **2026-04-16** (one batch, one day) |
| Active Demand Radar clients | **0** |
| Active Industry Pulse clients | **0** |

**What works:** The signals are *real and high-quality* — Third Coast Electric in Royal Oak hiring 2 electricians, predicted needs include "hand tools, power tools, ladders, electrical testing equipment, conduit, junction boxes" + a custom AI-generated pitch. This is genuinely sellable intelligence.

**What's broken:**
- `vertical`, `sector`, `county` columns are NULL — filtering won't work
- Only one scan day on record — daily intake rate unknown (target: 5-15/day)
- No active subscribers means zero validation

**Verdict:** Demand Radar has enough signal quality for a soft launch (5-10 paying pilots) but the cron isn't running daily and the categorization fields need backfilling.

---

## What I'm Going to Do

### Step 1: Inventory & Throughput Math (research deliverable in chat)

For **both products**:
- Real DB counts (just shown)
- Required pipeline runtime to reach safe sellable inventory
- Burn-rate math: at $X/mo with N clients, how fast does inventory deplete vs. replenish
- Concrete answer: "max concurrent clients per territory before we run out"

### Step 2: Two Sample Demand Radar Deliverables (PDFs)

Mirror what we did for TechAlert — generate from REAL data:

**Sample A: $99 One-Time Demand Snapshot** (`/mnt/documents/sample-demand-radar-snapshot-99.pdf`)
- 5 highest-confidence signals
- Company name, location, hiring activity, predicted needs (top 5), confidence score, recommended pitch (truncated to 200 chars)
- Source URL hidden ("Verified public source")
- "What you DON'T get without subscription" teaser at bottom
- Legal disclaimer block

**Sample B: $199/mo Pro Tier — Weekly Digest** (`/mnt/documents/sample-demand-radar-weekly-199.pdf`)
- 15-25 signals from past 7 days
- Full predicted needs lists
- Full pitches
- Cross-referenced badge (when hiring + expansion both confirmed)
- County-exclusivity note
- Real data sourced from `industry_pulse_signals` table

**Sample C: $499/mo Enterprise Brief** (`/mnt/documents/sample-demand-radar-enterprise-499.pdf`)
- Monthly executive briefing
- Sector breakdown (HVAC, Electrical, Manufacturing)
- Top 50 signals
- API access mock JSON sample
- White-label preview

### Step 3: Pricing Model Recommendation (chat deliverable)

Three options with pros/cons + my recommendation:

**A. Pure Monthly ($99 / $199 / $499 — current setup)**
- Pro: Predictable MRR, lower customer commitment
- Con: At current intake rate, can sustain ~5 active Pro clients per Metro Detroit county before signal duplication

**B. Pure One-Time ($99 snapshot, $399 quarterly brief)**
- Pro: Easier first sale, no churn risk, no ongoing FCRA-style concern (these aren't people, they're businesses — different legal landscape than TechAlert)
- Con: No MRR, must constantly re-sell

**C. Hybrid (recommended): $99 one-time snapshot → $199/mo Pro → $499/mo Enterprise**
- $99 snapshot is the trial/wedge → upgrade to Pro for live alerts
- Closest to Apollo/ZoomInfo SMB land-and-expand playbook
- Demand Radar = B2B intel about COMPANIES (not consumers) → **NO FCRA concern**, much easier legally than TechAlert
- TCPA only applies if outreach is to mobile numbers — most signals provide office lines and web forms

### Step 4: Onboarding Walkthrough (chat deliverable)

Step-by-step "Customer Journey" for both products:

**Demand Radar onboarding (today's state vs. ideal):**
1. Customer hits `/demand-radar` → picks tier → Stripe checkout
2. Webhook fires → row inserted in `industry_pulse_clients` → `dashboard_token` generated
3. Welcome email with magic link to `/demand-radar-portal?token=...`
4. Daily 7am ET digest via `demand-radar-digest` edge function (already exists)
5. Dashboard shows live signal feed, filterable by county/vertical/confidence

I'll audit each step and flag what's missing.

### Step 5: Inventory Sustainability (chat deliverable)

Honest math table:
- Demand Radar at 5 clients/county = sustainable today
- Demand Radar at 20 clients/county = needs 3x daily intake increase first
- Recommended: cap at 3 Pro tier subscribers per county initially → creates exclusivity + scarcity ("Only 1 spot left in Wayne County")

### Step 6: NO Code Changes This Round

Pure research + sample generation. After you review the samples and pricing, you tell me which to ship. Then in a build round I'd:
- Add the `vertical` + `county` backfill migration so filtering works
- Tweak Demand Radar landing copy with per-tier sample previews
- Add the territory-cap counter to landing page ("3 of 3 Pro spots left in Wayne County")

---

## Files & Deliverables

**Generated files (`/mnt/documents/`):**
1. `sample-demand-radar-snapshot-99.pdf` — one-time $99 snapshot, 5 signals
2. `sample-demand-radar-weekly-199.pdf` — Pro tier weekly digest, ~20 signals
3. `sample-demand-radar-enterprise-499.pdf` — Enterprise monthly brief, 50 signals + API mock
4. `techalert-and-demand-radar-inventory-report.md` — full math, sustainability tables, pricing recommendation

**Chat deliverables:**
- Blunt verdict per product (already shown above)
- Step-by-step customer journey for Demand Radar
- Pricing model recommendation
- "Will we run out?" math
- Honest gaps list (what to fix before scaling)

### Out of Scope

- No code/UI changes (pure research)
- No new pricing pushed to live checkout
- No TechAlert changes (covered last round)
- No FieldDesk / fitness app touched


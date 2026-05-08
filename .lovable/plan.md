# Audit Answers + Expansion Plan

## 1. Do we already have `/start-trial`?

**Yes — fully built.** `src/pages/StartTrial.tsx` already:

- Reads `?product=` from query params (21 canonical keys + ~50 aliases)
- Preselects product, shows tailored price + promise + 3 bullets per product
- Falls back to a curated picker grid if no/unknown product
- Pre-fills email/business/phone/website from URL params
- Auto-redirects products with dedicated landing pages (e.g. dead-lead → `/dead-lead-intake`)
- Routes all trial sign-ups through `start-radar-trial` edge function (no CC, magic link)
- Tracks funnel events (`view`, `picker_view`, `picker_select`)

The trial re-engagement campaign we just shipped already points every prospect at `/start-trial?product=<key>&email=<email>` so it works as-is. **No code change needed.**

## 2. Is the 300+ missed-call segment getting the right trial?

The 945 queued prospects break down as:


| Product                        | Count | Sample industries                                                    |
| ------------------------------ | ----- | -------------------------------------------------------------------- |
| `missed_call_catch`            | 323   | cleaning, law firm, dentist, restaurant, urgent care, chiropractic   |
| `site_radar`                   | 251   | machine shop, manufacturing, accountant, commercial RE, deck builder |
| `trade_radar_*` (10 verticals) | 371   | HVAC 75, electrical 86, plumbing 66, roofing 76, tree 31, etc.       |


**The 323 missed-call prospects are correctly mapped.** Service businesses with phone-driven booking (lawyers, dentists, restaurants, urgent care, chiropractic, cleaning) are exactly who benefits most — every missed call = direct lost revenue. No better-fit trial exists.

**Optional upsell to consider later:** AI Phone Answering ($149) for the law firms and urgent cares specifically (higher avg call value). I'd keep the trial as Missed-Call Catch for now since it's a 7-day no-CC trial vs. AI Phone Answering's paid setup.

## 3. Is Mortgage Radar sending?

**No.** Mortgage Radar has 593 leads + 3 enrolled clients — but **zero LOs in the trial resend queue**. The seed query only pulled from `outreach_leads`, `contractor_outreach_prospects`, `techalert_business_prospects`, `roofing_prospects` — none of which contain mortgage brokers. We never built an LO prospect list at scale.

**Fix:** Run a new seeding pass that pulls LOs from Apollo (existing `find-lo-prospects` function uses Apollo people-search for `title=Mortgage Loan Officer`). Target 200–500 Michigan + national LOs, dedupe against suppression, queue with `product_key='mortgage_radar'`.

## 4. Mortgage Radar — 10 ways to expand beyond LOs

Mortgage Radar's underlying signals (FSBO listings, court records, SOS filings, BSEED permits, probate, foreclosure, divorce filings, deed transfers, license expirations) are **homeowner intent + financial-life-event** signals. Same data, different buyers:


| #   | New buyer persona                             | Signal angle                                                         | Pricing                                                           |
| --- | --------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | **Real Estate Agents** (buy-side)             | FSBO + price reductions = listing-conversion targets                 | $149/mo — already in product catalog under `real_estate` industry |
| 2   | **Real Estate Investors / Wholesalers**       | Probate + foreclosure + tax-delinquent = motivated sellers           | $199/mo (higher value) — new product `investor_radar`             |
| 3   | **Title Companies**                           | New deed transfers + FSBO = title-order pipeline                     | $249/mo                                                           |
| 4   | **Home Insurance Agents**                     | New deed transfers + new permits = policy-rewrite triggers           | $99/mo                                                            |
| 5   | **Estate Sale / Junk-Haul (already partial)** | Probate + estate sales — pipe to existing `trade_radar_demo_junk`    | existing                                                          |
| 6   | **Moving Companies**                          | Deed transfers + FSBO = move-date prediction                         | $99/mo                                                            |
| 7   | **Solar Installers**                          | New permits + new homeowners (new owners install solar 3× more)      | $149/mo                                                           |
| 8   | **Property Managers**                         | Multi-unit deed transfers + LLC formations = new landlord onboarding | $149/mo                                                           |
| 9   | **Estate Attorneys**                          | Probate filings + property transfers post-death                      | $199/mo (low volume, high LTV)                                    |
| 10  | **Reverse Mortgage Specialists**              | Senior homeowners with paid-off pre-1990 homes (parcel data)         | $199/mo                                                           |


**Easiest 3 to ship:** Real Estate Agents (data already there, just rename product), Real Estate Investors (probate + foreclosure exists), Solar Installers (new permits + new homeowners exists).

## 5. Talent Radar — why are we not filling the DB with sellable leads?

Current state: **273 candidates, 39 emails (14%), 88 phones (32%), only 65 with score ≥7.** Trades distribution: boiler 76, HVAC 56, electrical 43, plumbing 35, nursing 10, home health 2.

**Root cause (already documented in `knowledge/talent-radar-v5/talent-radar-enrichment-v5.md`):** MIOSHA license records expose name + license + city only — **no employer**. Hunter/Snov/Apollo/Lusha all need a company domain or employer name. Only ~21% of candidates have an employer, and trade workers are underrepresented in PDL's LinkedIn-skewed DB. Sonar OSINT (`perplexity/sonar-pro`) is the **only** paid API producing results — at $0.005/candidate it's basically free, but ceiling is ~17.5% contactability.

**Why so few candidates total:** scanner is gated to MI licensing data + a few job-board sources. Healthcare (nursing/home health) only has 12 candidates because we never wired up the NPI-based scanner properly for nurses (NPI works for some healthcare but skews physician/dentist).

**What to fix:**

1. **Add nurse + home-health licensure board scanners** — Michigan LARA nursing license database (240k+ active RNs in MI alone) → 100× current nursing volume
2. **Add CDL/truck-driver licensure** — FMCSA SAFER + state DOT — huge staffing market
3. **Add electrician journeyman/master license expirations** — already have electrician scanner, expand to "renewal-due-in-90-days" (job-change predictor)
4. **Phone enrichment via Twilio Lookup** — we have 88 phones, validate them (mobile vs landline) and gate sales by mobile-only ($0.005/lookup)
5. **Sonar prompt tuning** — current Sonar pulls "current employer" sometimes; tighten prompt to also extract LinkedIn URL for downstream Apollo enrichment hop
6. **Job-board scrape expansion** — Indeed/ZipRecruiter "looking for" signals (currently sparse)

Realistic ceiling after fixes: 1,500–3,000 candidates with 25–30% contactability.

## 6. Concrete implementation plan (this build)

Three deliverables — all backend / data:

### A. Seed Mortgage Radar LOs into trial resend queue

- Edge function: invoke existing `find-lo-prospects` to pull 300 MI LOs from Apollo
- Insert into `trial_resend_queue` with `product_key='mortgage_radar'`, `source_table='find_lo_prospects'`
- Apply existing suppression filter (suppression list, blocklist, past trials, unsubscribes)
- Daily cron continues delivering 50/day at 14:00 UTC

### B. Talent Radar nurse + CDL expansion

- New scanner: `talent-radar-nurse-scanner` (LARA nursing license DB) — adds RN/LPN candidates with license + city
- New scanner: `talent-radar-cdl-scanner` (FMCSA SAFER drivers) — adds CDL drivers + carrier name (carrier name = employer, unlocks Hunter/Apollo)
- Hourly cron, dedupe on `license_number`
- Adds Twilio Lookup mobile validation pass on existing 88 phones (`talent-radar-phone-validate`)

### C. Mortgage Radar product variants (data only, no UI yet)

- Add 3 new `start-radar-trial` product slugs: `investor_radar`, `realtor_radar`, `solar_radar`
- Map to same `mortgage_radar_leads` table but filter by signal type:
  - `investor_radar` → probate, foreclosure, tax-delinquent
  - `realtor_radar` → FSBO, price-reductions
  - `solar_radar` → new permits + new homeowners (deed transfer < 12 months)
- Add to `StartTrial.tsx` PRODUCTS map + PRODUCT_PITCH (one-line code change per product)
- No new scanners needed — same data, three new buyer audiences

## 7. Open questions before building

1. **Mortgage Radar LO seed** — go national (1000+) or Michigan-only (300)? If we can get leads for each location we claim to have leads for then add as many cities as we can handle. I want as many as we can find the sufficient information for!
2. **Nurse scanner** — Michigan only, or all 50 states (LARA equivalents exist)? If they exist, HELL YA! EXPAND, OUR TROJAN HORSE IS THE FREE TRIAL IF WE CAN PROVE ITS WORTH IT THEN WE WIN.
3. **3 new Mortgage Radar variants** — ship all 3 (investor/realtor/solar), or just investor first? ALL 3 BUT MAKE SURE WE TEST EVERYTHING AFTER. END TO END, CLICK TESTS. WE HAVE HAD SO MANY ERRORS.

Once you pick those three, I'll execute A + B + C. MAKE SURE THIS IS TOP OF THE LINE, PREMIUM, 10 MILLION DOLLAR COMPANY EVAL LEVEL BUILD. OH THAT REMINDS ME. SHOULD OUR BACKGROUND ON ALL OUR DASHBOARDS BE WHITE? SHOW ME 1 TOP 10 SOFTWARE THAT ISNT WHITE. IF YOU CAN, THEN IM OPEN TO KEEPING THE TEAL, BUT I THINK WHITE OR BLACK IS KINDA THE STANDARD FOR PROFESSIONAL DASHBOARDS, DO YOU AGREE? WE NEED OUR TEXT OR FONT TO BE WHATEVER IS MOST PROFESSIONAL AND HIGHER RESOLUTION. CAN YOU INCREASE THE RESOLUTION OF OUR UI AND STUFF?
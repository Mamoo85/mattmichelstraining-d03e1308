

# Credit Triggers — What They Are, Why The Old Game Is Dead, And What We Can Sell Your Brother

## Direct answer first

**Yes, credit triggers exist. No, we cannot legally resell them anymore.** A federal law just killed the entire model. But there's a better, legal play we can build that does the same job — find people in-market for a mortgage **before** they pull credit — and sell it to your brother as a recurring product.

---

## What a credit trigger actually is

When someone applies for a mortgage (or auto loan, credit card, etc.), the lender pulls a hard credit inquiry from one of the three bureaus — **Experian, TransUnion, Equifax**. The bureaus historically packaged that inquiry within ~24 hours into a "trigger lead" record (name, address, phone, FICO band, loan type) and sold it in near real-time to **any other lender** willing to pay $3–$15 per lead. That's why people who apply for a mortgage suddenly get 40+ calls in 48 hours from lenders they never contacted.

**The ripple chain looked like this:**
```text
Borrower applies → Lender A pulls credit → Bureau flags inquiry
   → Bureau sells "trigger" feed to Lenders B, C, D, E…
   → Borrower's phone explodes within 24h
```

## Why we can't just go buy them

**HR 2808 — the Homebuyers Privacy Protection Act** — was signed by Trump and is **now in effect (early 2026)**. The law:

- Bans credit bureaus from selling mortgage-inquiry-triggered data to any lender who isn't already affiliated with the borrower's original application.
- Even credit-bureau-licensed data brokers (LeadsOnline, iSoftpull, Certified Credit, etc.) are out of the resale game for unaffiliated lenders.
- Penalties = FCRA violations ($1,000+ per consumer + class-action exposure).

**Bottom line:** if your brother is not the lender the borrower applied to, he is legally locked out of the bureau-trigger feed. Period. Anybody still selling these post-2026 is selling a lawsuit.

## What's still 100% legal — the "pre-trigger" play

The law bans **bureau-sourced credit data**. It does **not** ban catching the same people earlier in their journey using **public records + behavioral signals**. This is what we already do for trade hiring (TechAlert) and supplier intent (Buyer Radar). Same playbook, new vertical.

**Legal in-market mortgage signals we can hunt:**

| Signal | Source | What it means |
|---|---|---|
| New home purchase / sale | County assessor + Zillow MLS feed | Just bought = needs HELOC in 6–18 mo |
| Property-tax delinquency curing | County treasurer public records | Refinance candidate |
| Building permit pulled (kitchen, addition, roof) | BSEED + city permit ArcGIS feeds | Renovation = HELOC/cash-out refi |
| Divorce filing | County court e-filings (public) | Forced refinance / equity buyout |
| New business registration (LLC) | Michigan SOS LARA business filings | Self-employed mortgage = niche product |
| FSBO listing | Zillow/Redfin scrape | Will need a new mortgage when they buy next |
| Foreclosure notice / lis pendens | County recorder public records | Pre-foreclosure refi or short-sale lead |
| Job change at $100k+ employer | LinkedIn + payroll signals via Sonar | Relocation buyer |
| Large equity position + low rate (assumable) | Public mortgage records + rate lookup | Cash-out refi candidate |

We **already run 8 of these scanner types** for other products. The pipes are built. We just point them at "in-market for mortgage" instead of "in-market for hiring."

---

## What I'd build for your brother — "Mortgage Radar"

A productized SaaS at `/mortgage-radar` priced **$399/mo per loan officer** (or $899/mo for a 5-LO team). Net-new vertical. Zero touch on existing scanners.

### Daily output for him

- **10–25 fresh in-market leads/day** from his ZIP radius, scored 1–10
- Each lead: name, address, phone (when public), trigger reason ("permit pulled 3 days ago for kitchen reno — likely cash-out refi"), best-time-to-call, suggested opening line
- SMS alert when a 9–10 score hits
- Weekly digest of "warm but not hot" pipeline
- One-click "I'm working this lead" lock so he doesn't double-call

### Why it beats the dead trigger model

- **Earlier in the funnel** — we catch them weeks before they pull credit, not hours after (when 47 other LOs already called)
- **No bureau dependency** — 100% public + opt-in behavioral data, FCRA-clean
- **Geography-locked** — exclusive to one LO per ZIP (urgency + price defensibility)
- **TCPA-safe outreach drafts** — his job: copy/paste/text. Same manual-only mandate as TechAlert.

### What he sells / pays for

- $399/mo subscription via Stripe (same checkout pattern as Buyer Radar)
- 7-day free trial, cancel anytime
- ZIP exclusivity = max ~30 LOs per metro = clean scarcity

### Files (additive — zero risk to existing products)

- `src/pages/MortgageRadar.tsx` — sales page (Grease Slide format)
- `src/pages/MyMortgageRadar.tsx` — LO dashboard (lead feed, lock buttons, SMS draft modal)
- `supabase/functions/create-mortgage-radar-checkout/index.ts` — Stripe
- `supabase/functions/mortgage-radar-scanner/index.ts` — daily cron, hits the 9 sources above in parallel via `Promise.allSettled()` (same arch as `industry-pulse-scanner`)
- `supabase/functions/mortgage-radar-digest/index.ts` — weekly email
- `stripe-webhook` — append `mortgage_radar_subscription` handler
- Migration: `mortgage_radar_clients`, `mortgage_radar_leads`, `mortgage_radar_lead_locks`
- 1 new tab in `/dwa-admin` — "🏠 Mortgage Radar" QA + client roster

### What stays untouched

Every other scanner, every other product, every Stripe handler, all contractor leads / TechAlert / FieldDesk / Buyer Radar code. This is a clone of the Buyer Radar shape pointed at a new vertical.

---

## Compliance disclosure (must be in TOS + UI tooltip)

> "Mortgage Radar uses public records and behavioral signals only. We do not access, purchase, or resell credit bureau data, soft-pull data, or trigger-lead inquiries. All outreach drafts must be manually sent by the licensed loan officer in compliance with TCPA and FCRA."

This mirrors the TechAlert compliance mandate already in your memory.

---

## What I need from you to start

Two yes/no answers and we ship:

1. **Build it as `Mortgage Radar` at $399/mo, 5 ZIPs included, +$50/extra ZIP** — yes / change pricing?
2. **Brother gets a free founder seat (NMLS + name) so we have a live testimonial in 30 days** — yes / no?

Once you confirm I'll build the full stack: scanner + dashboard + checkout + webhook + admin tab + sales page + 1-pager PDF. Same shape as Buyer Radar, ~1 build session.


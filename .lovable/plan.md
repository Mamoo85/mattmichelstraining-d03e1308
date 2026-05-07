## What's happening with "Claim 7d"

The "Claim 7d" button on the Mortgage Radar lead cards is a placeholder. The handler in `src/pages/MyMortgageRadar.tsx` (line 167) just shows that toast — there's no LO login flow built yet. The dashboard authenticates you with a magic-link `email` + `token` from your weekly digest, not with an LO account, so there's nowhere to "log in as LO" today.

Two options for fixing it:

**A. Remove the dead button (recommended for now)** — replace "Claim 7d" with "Mark as working" that just flips the lead's `pipeline_stage` to `working` for this client. No login required, uses the magic-link auth you already have. Honest, unblocks you immediately.

**B. Build a real LO account system** — sign-up/login (email+password + Google), per-LO claim ownership in DB, soft-lock so two LOs can't claim the same lead. ~3–5 hours of work, requires the user-profiles decision (auth knowledge says I must ask before adding auth).

Going with A in this plan since you have a single-LO setup right now (it's just you / your client). If you want a real multi-LO marketplace later, we'll do B.

## Pictures on the top leads

`mortgage_radar_leads.street_view_url` already exists in the DB and the scanner populates it (Phase 36 work). The lead card just isn't showing it.

I'll add a Street View thumbnail to every lead card (not just top 5 — all of them, since it's free data we already have). Layout:

```text
┌────────────────────────────────────────┐
│ [Street View 120×90]  456 OAK AVE  10/10│
│                       Royal Oak · FSBO  │
│                       ×5 signals        │
│                                         │
│ ▾ Why score 10/10?                      │
│ Suggested opener: "Hi {name}…"          │
│ [Mark working] [Draft SMS] [Draft email]│
└────────────────────────────────────────┘
```

Plus an expandable "More details" section per lead showing what we already have but hide today: `intel_highlights`, `year_built`, `building_sqft`, `last_sale_price_cents`, `last_sale_date`, `estimated_equity`, full `signal_history`, and a bigger Street View image (480×320). Click the thumbnail or the "More details" chevron to expand.

## Changes

1. **`src/pages/MyMortgageRadar.tsx`** — replace `claimLead` with `markWorking` that updates `pipeline_stage='working'` directly on the row. Button label changes from "Claim 7d" → "Mark working" (or "Working ✓" once set).

2. **New component `src/components/mortgage/MortgageLeadCard.tsx`** — extracts the lead card into its own file with:
   - Street View thumbnail (120×90) on the left, falls back to a map-pin placeholder if `street_view_url` is null
   - Expandable "More details" disclosure showing year built, sqft, last sale, equity range, full signal history, and the larger Street View image
   - Existing buttons (Mark working, Draft SMS, Draft email) preserved

3. **Trade Radar parity** — `src/components/trade-radar/TradeRadarLeadCard.tsx` already shows Street View per Phase 36; I'll only touch it if you want the same expandable details panel there too (not in this plan unless you say so).

No DB migration needed — `street_view_url` and the intel columns already exist.

## Out of scope

- Real LO accounts / multi-tenant claim system (option B above)
- Photos beyond Street View (no Zillow/MLS photo source wired up; would need a paid API)
- Trade Radar card changes

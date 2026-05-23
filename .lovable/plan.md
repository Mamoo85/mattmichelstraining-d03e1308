# Resume DWA Operations — $5/week Hard Budget Cap

Goal: turn all DWA automation back ON, but enforce a global $5/week spend ceiling so we never repeat a $1k Google Cloud bill. Cap auto-lifts the moment the first paying DWA customer lands.

## 1. New global budget kill-switch

New table `dwa_spend_ledger`:
- `id`, `function_name`, `provider` (google_maps / firecrawl / apollo / hunter / openrouter / twilio / resend / lob / browserless / dataforseo / clearbit / snov / noaa / etc.), `cost_usd numeric`, `created_at`
- Indexed on `(created_at)` for fast weekly rollup.

New table `dwa_budget_state` (single row):
- `weekly_cap_usd` (default `5.00`)
- `week_start` (Monday 00:00 ET, auto-rolls)
- `spent_this_week_usd`
- `paused` boolean
- `auto_lift_on_first_sale` boolean (default `true`)
- `lifted_at`, `lifted_reason`

## 2. Shared gate: `_shared/dwa-budget-gate.ts`

Single helper every paid API call must hit BEFORE spending:
```
await assertDwaBudget(provider, estCostUsd)
```
- Reads current week total from `dwa_spend_ledger`.
- If `spent + est > weekly_cap` → throws `BudgetExceeded` (function returns 200 with `{skipped:'budget'}`, no SMS spam).
- After the call succeeds, logs actual cost to ledger.
- Reuses existing `_shared/budget-gate.ts` pattern but with a single global pool, not per-function.

Per-provider cost estimates (hardcoded constants):
- Google Maps Places: $0.017/req, Address Validation: $0.005
- Firecrawl: $0.002/scrape
- Apollo people search: $0.05, org enrich: $0.10
- Hunter find: $0.02, verify: $0.005
- OpenRouter Sonar: ~$0.01/call
- Twilio SMS: $0.0083, Lookup: $0.005
- Lob postcard: $0.99
- Browserless: $0.01/PDF
- DataForSEO / Clearbit / Snov / NOAA CDO: actual or estimate

## 3. Wire the gate into every paid call site

Edit each `_shared/*.ts` helper that hits a paid API (not the function entry points — one place each):
- `_shared/firecrawl.ts`, `apollo.ts`, `hunter.ts`, `twilio.ts` (SMS + Lookup), `address-validation.ts`, `email-waterfall.ts` (gates the priced tiers, free tiers pass through), `email-extras-*.ts` (free — no gate), `opus.ts` (Anthropic direct), `ai.ts` (Lovable Gateway — free for us, no gate), `firecrawl-scrape.ts`, `crm-webhook.ts` (free), Lob postcard sender, Browserless PDF, DataForSEO, Clearbit, Snov.

Free sources (Census, NOAA NWS, SPC, FEMA, BSEED/ArcGIS, gov registries, county GIS, CourtListener, USGS, SeeClickFix, SAM.gov, USASpending, USPTO, SEC EDGAR, GitHub, LARA, Detroit Open Data, etc.) are NOT gated — scanners keep running on free data.

## 4. Resume crons

All scanner / digest / outreach crons stay scheduled as-is (Phases 42–45). They will simply skip paid enrichment when the cap is hit and continue using free signal sources. Re-enable any disabled ones:
- TechAlert outreach (D0, D3/D7/D14 drips)
- Dead lead drip
- Mortgage radar AM digest
- Trade radar scanner (11 verticals) + AM digest
- Channel prospector + follow-up
- Outreach leads enrich (Apollo waterfall — gated)
- Weekly admin digest

No code change needed — gate handles the throttling.

## 5. Auto-lift on first paying customer

Add to `stripe-webhook/index.ts` `checkout.session.completed` handler:
- If `metadata.type` matches any DWA product (FieldDesk, TechAlert, SiteRadar, Contractor Leads, Dead Lead, Missed-Call, Mortgage Radar, Trade Radar ×11, Marketplace, Bundle), and `dwa_budget_state.auto_lift_on_first_sale = true` and `lifted_at IS NULL`:
  - Set `weekly_cap_usd = 500`, `lifted_at = now()`, `lifted_reason = 'first_sale:<product>:<email>'`
  - SMS Matt: "💰 First DWA sale ($X from <product>) — budget cap lifted to $500/wk."

## 6. Admin visibility

Add to `DWAAdmin.tsx` a small "Budget" card:
- This-week spent / cap, % used, top 5 providers by cost, last 20 ledger entries.
- Manual override buttons: Pause all paid calls / Set cap ($5/$25/$100/$500/Unlimited) / Reset week.
- SMS Matt at 80% ($4.00) and 100% ($5.00) of cap once per week.

## 7. Out of scope

- No changes to free-source scanners' logic or signal coverage.
- No changes to product pricing or Stripe configs.
- No new product launches.

## Technical notes

- Single migration: `20260523000000_dwa_budget_cap.sql` (2 tables + RLS + seed row with $5 cap).
- New shared file: `supabase/functions/_shared/dwa-budget-gate.ts`.
- Edits: ~10 shared API helpers + `stripe-webhook/index.ts` + 1 admin page.
- Zero changes to migrations history or any existing cron schedules.
- Ledger write is fire-and-forget (`.then()` no await) so it never blocks the calling function.
- Weekly rollover: gate function checks if `now() >= week_start + 7 days` and resets `spent_this_week_usd` + `week_start`.

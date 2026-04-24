

## Golden Ticket Marketplace v2 — FINAL Build Plan (Locked)

This is the locked plan. Lovable's v2 plan + Claude's 50 zero-cost enhancements + technical guardrails. Built in 2 sessions.

---

### Session 1 — Visible Marketplace (no payment yet)

**Goal:** Cards live with real data so Matt can see them before we wire payment.

**1. Migration: `supabase/migrations/<ts>_marketplace_v2.sql`**
- Tables: `marketplace_lead_locks`, `marketplace_buyer_views`, `marketplace_lead_pdfs`, `marketplace_lead_shares`, `signal_strength_rules`, `marketplace_saved_searches`, `marketplace_dismissals`, `marketplace_watches`
- Storage buckets: `lead-provenance-screenshots` (90d cleanup), `lead-dossier-pdfs` (30d cleanup, signed URLs)
- Columns added to `mortgage_radar_leads` + `industry_pulse_signals` + `hire_alert_candidates`:
  - `equity_range_low_cents`, `equity_range_high_cents`, `year_built`, `last_sale_price_cents`, `last_sale_date`
  - `signal_strength_tier text` ('hot'|'warm'|'cool')
  - `human_summary text`, `buyer_type text`, `suggested_opener jsonb`
  - `provenance_source_urls jsonb`, `provenance_screenshot_paths jsonb`
  - `signal_velocity numeric`, `zip_heat_index int`, `days_on_radar int`, `nearby_signal_count int`
  - `est_loan_low_cents`, `est_loan_high_cents`, `score_percentile int`
  - `tcpa_clear boolean` (computed from `sms_opt_outs` join)
  - `alert_prefs jsonb` on `mortgage_radar_clients`
- Seed `signal_strength_rules`: signal_type + age bracket → Hot/Warm/Cool (deterministic, no ML)
- Cleanup crons: 90d screenshots, 30d PDFs, 30d expired locks
- Unified view: `unified_lead_marketplace_view` (security_invoker=true) joining all 3 source tables into single shape

**2. Edge function: `marketplace-lead-equity-enrich`**
- BSEED ArcGIS (`services2.arcgis.com/qvkbeam7Wirps6zC`) + Detroit ArcGIS parcel layer
- Backfills 24 existing mortgage leads + runs after every scanner
- Writes equity range (bracket, not exact), year built, last sale, lot/building sqft

**3. Edge function: `marketplace-lead-summarize`**
- Gemini 2.5 Flash via `_shared/cheap-extract.ts`
- Generates: 1-line `human_summary`, `suggested_opener` (SMS + email + voicemail), `buyer_type` chip
- Rule-based `signal_strength_tier` from seed table (AI just formats, never predicts)
- Backfills 370 existing leads on first run

**4. Edge function: `marketplace-track-view`**
- Public POST, anonymous count only — no buyer company attribution
- Powers "4 buyers viewing now" counter (honest)

**5. Tailwind extensions: `tailwind.config.ts`**
- Keyframes: `shimmer`, `scanline`, `seal-stamp`, `dossier-glow`, `pulse-flame`
- New colors: `intel-teal`, `seal-gold`

**6. Frontend components (`src/components/marketplace/`)**
- `GoldenTicketCard.tsx` — base dossier with sub-components: `<BuyerChip>`, `<FreshnessBadge>`, `<ScoreBars>`, `<TriggerTimeline>`, `<IntelPanel>`, `<RoiPanel>`, `<ProvenanceTooltip>`
- `LockedDossierCard.tsx` — pre-purchase: blurred Street View, wax seal, anonymous viewer count, single 🎟 CTA
- `UnlockedDossierCard.tsx` — post-purchase: full contact, copy buttons, **TCPA consent banner above opener**, export PDF, share button
- `SoldDossierCard.tsx` — explicit sold state for marketplace integrity
- `ProvenanceTooltip.tsx` — hover any data point → source URL + scanner run ID + timestamp

**7. Pages + routing**
- `src/pages/Marketplace.tsx` — `?product=mortgage|talent|demand|growth|supply` filter, sort/filter chips, keyboard shortcuts (J/K/Enter/C/B/Esc), watch/dismiss
- `src/pages/LeadDetail.tsx` — `/lead/:slug` standalone full-page card (a la carte sales surface)
- `src/App.tsx` — 5 marketplace routes + `/lead/:slug`
- One free unlocked sample lead per product (score 6-7, age 7d+) for first-time visitors

---

### Session 2 — Payment + Sharing + PDFs

**Matt action before Session 2:** create free account at browserless.io, add `BROWSERLESS_API_KEY` to Lovable secrets.

**8. Edge function: `create-marketplace-lead-checkout`**
- Body: `{ lead_id, product, buyer_email }`
- Soft-locks lead in `marketplace_lead_locks` for 10 min
- Stripe session, `metadata.type = 'marketplace_lead_purchase'` + product + lead_id

**9. Stripe webhook handler: `marketplace_lead_purchase`**
- Atomic claim via `marketplace_lead_locks` (race-safe like contractor PPL)
- Fires `marketplace-generate-dossier-pdf` async
- Emails buyer the unlocked dossier + signed-URL PDF
- SMS Matt
- Returns 500 on DB failure (Stripe retries)

**10. Edge function: `marketplace-generate-dossier-pdf`**
- Browserless.io HTTP API renders the live Tailwind card to PDF
- Uploads to `lead-dossier-pdfs` Supabase Storage bucket
- Returns 30-day signed URL
- Caches per (lead_id + buyer_email) in `marketplace_lead_pdfs`

**11. Edge function: `marketplace-share-token`**
- Issue: single-use signed token, 7-day expiry
- Redeem: returns redacted view (full intel visible, contact info masked) — prevents free-view loophole
- Logged in `marketplace_lead_shares`

**12. Edge function: `marketplace-lead-blast` (admin only)**
- Manual trigger from admin hub
- SMS-blast top 3 high-score leads to per-product prospect list
- TCPA-compliant (manual trigger, opted-in lists only, dedup via `system_comms_log`)

**13. Edge function: `marketplace-saved-search-notifier`**
- Cron every 15 min
- Match new leads to `mortgage_radar_clients.alert_prefs` (ZIP + min score + signal type)
- Fire SMS within 5 min of match
- Powers FOMO + retention

**14. Admin: `src/components/dwa-admin/MortgageRadarHub.tsx`**
- Provenance audit tab (every lead + source URLs, re-screenshot button)
- Blast button (per product)
- Share-token audit (who shared what to whom, expiry status)
- Marketplace stats row (views, locks, sales, revenue per product)

---

### The 50 Zero-Cost Enhancements — Phased In

**Session 1 includes (highest leverage, no extra APIs):**
- DB-computed (#11–25): signal velocity, ZIP heat, multi-signal stacking, days on radar, rarity, age bucket, est. deal size, percentile, break-even tracker, time-to-expiry, lead age bucket, score-trend arrow
- UI/UX (#26–37): all 12 frontend-only enhancements (keyboard, sort, filter, watch, compare, mobile swipe, dark mode, dismissal memory, "new since last visit", inline score explainer, copy-all opener, fullscreen)
- Trust (#46–50): TCPA badge, source icons, scanner provenance, freshness per field, free sample lead

**Session 2 includes (notifications + free APIs):**
- Free APIs (#1–10): FRED rate, Census ZIP demographics, NOAA storm cross-ref, SAM.gov, BSEED full history, USPS standardization, HUD FMR, MI SOS LLC status, EPA ECHO, NPI Registry
- Notifications (#38–45): saved search alerts, score-bump alerts, 7-day re-engagement, purchase confirmation SMS, hot zone alerts, Friday scorecard, welcome sequence, price-drop alerts

---

### Technical Guardrails (LOCKED — non-negotiable)

- **No Zillow.** BSEED + Detroit ArcGIS only.
- **No pdf-lib.** Browserless.io only.
- **No fake ML.** Hot/Warm/Cool tier from rule table, never "% likely".
- **No competitor firm names.** Anonymous viewer count only.
- **No HIBP on cards.** Wrong tool.
- **No Mapbox.** `GOOGLE_MAPS_API_KEY` for Street View + tiles (already in secrets).
- **No Wayne County ArcGIS.** Blocks server-side (403 confirmed).
- **No raw `fetch` to Resend.** Use `dwaEmail()` helper.
- **No local `sendSMS`.** Always import from `_shared/twilio.ts`.
- **Model string:** `claude-haiku-4-5-20251001` (exact).
- **TCPA consent banner** required above every Suggested Opener copy button.
- **Sold state** required on marketplace card after claim.
- **PDF signed URLs** expire 30 days.
- **Existing functions (DO NOT REBUILD):** `mortgage-radar-enrich`, `mortgage-radar-outreach`, `mortgage-radar-digest` — wire into, don't recreate.

---

### Behavior Matt sees after both sessions

- 5 public marketplaces live: `/mortgage-leads` · `/talent-leads` · `/demand-leads` · `/growth-leads` · `/supply-leads`
- ~370 existing leads instantly purchasable, each rendered as a sealed dossier
- Standalone `/lead/<slug>` URLs — text one to a prospect, they buy in 2 taps, dossier hits inbox as PDF
- Saved-search SMS alerts within 5 min of new matching lead
- Hot Zone alerts when 3+ leads stack in same ZIP
- Friday weekly scorecard email per buyer
- Provenance receipt on every claim — disputes die in 30 seconds
- Realistic ceiling: ~$9k from existing inventory + recurring upsell engine to $399/mo subscriptions

---

### Build estimate (honest)

```text
Session 1 — ~9 hrs
  Migration + buckets + crons + view              60 min
  Equity enrich + backfill 24 leads               90 min
  Summarize fn (opener + tier + summary)          75 min
  Tailwind keyframes + tokens                     30 min
  GoldenTicketCard + 8 sub-components            210 min
  Locked/Unlocked/Sold variants + TCPA banner     90 min
  Marketplace + LeadDetail + 5 routes + filters   75 min
  DB-computed enhancements (#11-25, #26-37, #46-50)  90 min

Session 2 — ~9 hrs
  Checkout fn + webhook handler                    90 min
  Browserless PDF gen + Storage upload             75 min
  Share-token system (issue + redeem + redact)     75 min
  Saved search notifier cron                       60 min
  10 free-API integrations (#1-10)                120 min
  8 notification enhancements (#38-45)             75 min
  Admin provenance + blast + share audit           60 min
  End-to-end QA on /mortgage-leads                 75 min
```

**Total: ~18 hrs across 2 sessions.** Reply "ship it" and Session 1 starts.

